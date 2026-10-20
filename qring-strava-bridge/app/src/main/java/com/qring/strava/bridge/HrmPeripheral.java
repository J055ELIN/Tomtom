package com.qring.strava.bridge;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.ParcelUuid;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Fait du téléphone un PÉRIPHÉRIQUE BLE exposant le profil Heart Rate standard
 * (service 0x180D / caractéristique 0x2A37), afin que Strava (ou toute app
 * compatible capteur FC BLE) le détecte comme ceinture cardiaque.
 *
 * ⚠️ Correction du blocage documenté dans le SOP v1 :
 *   `BluetoothManager.openGattServer(Context, GattServerCallback)` est une API
 *   PUBLIQUE d'Android depuis l'API 18 — aucun root n'est nécessaire.
 *   Il faut simplement :
 *     1. la permission BLUETOOTH_CONNECT (Android 12+) / BLUETOOTH_ADMIN (≤ 11),
 *     2. la permission BLUETOOTH_ADVERTISE (Android 12+) pour être visible,
 *     3. un premier plan (foreground service) pour rester actif écran éteint.
 */
public class HrmPeripheral {

    public interface Listener {
        void onPeripheralLog(String message);

        void onAdvertisingStarted(boolean ok, String detail);

        void onClientCountChanged(int count);
    }

    public static final UUID SVC_HEART_RATE = UUID.fromString("0000180D-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_HR_MEASUREMENT = UUID.fromString("00002A37-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_BODY_SENSOR_LOCATION = UUID.fromString("00002A38-0000-1000-8000-00805F9B34FB");

    public static final UUID SVC_BATTERY = UUID.fromString("0000180F-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_BATTERY_LEVEL = UUID.fromString("00002A19-0000-1000-8000-00805F9B34FB");

    public static final UUID SVC_DEVICE_INFO = UUID.fromString("0000180A-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_MANUFACTURER = UUID.fromString("00002A29-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_MODEL = UUID.fromString("00002A24-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_SERIAL = UUID.fromString("00002A25-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_FIRMWARE = UUID.fromString("00002A26-0000-1000-8000-00805F9B34FB");

    public static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB");

    private static final String DEVICE_NAME = "QRing HRM";

    private final Context context;
    private final Listener listener;

    private BluetoothManager btManager;
    private BluetoothAdapter adapter;
    private BluetoothGattServer server;
    private BluetoothLeAdvertiser advertiser;

    private BluetoothGattService hrService;
    private BluetoothGattService batteryService;
    private BluetoothGattCharacteristic hrMeasurement;
    private BluetoothGattCharacteristic bodySensorLocation;
    private BluetoothGattCharacteristic batteryLevel;

    private final Set<BluetoothDevice> clients = new CopyOnWriteArraySet<>();
    private final Set<String> subscribed = new CopyOnWriteArraySet<>();

    private volatile boolean running = false;
    private volatile boolean advertised = false;

    public HrmPeripheral(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    public boolean isRunning() {
        return running;
    }

    public boolean isAdvertising() {
        return advertised;
    }

    // ==================================================================
    // Démarrage
    // ==================================================================

    public boolean start() {
        if (running) {
            return true;
        }
        btManager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = btManager != null ? btManager.getAdapter() : null;
        if (adapter == null) {
            log("Bluetooth non disponible sur cet appareil");
            listener.onAdvertisingStarted(false, "Bluetooth absent");
            return false;
        }
        if (!adapter.isEnabled()) {
            log("Bluetooth désactivé");
            listener.onAdvertisingStarted(false, "Bluetooth désactivé");
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && context.checkSelfPermission("android.permission.BLUETOOTH_CONNECT")
                != PackageManager.PERMISSION_GRANTED) {
            log("Permission BLUETOOTH_CONNECT manquante");
            listener.onAdvertisingStarted(false, "Permission BLUETOOTH_CONNECT manquante");
            return false;
        }
        if (!adapter.isMultipleAdvertisementSupported()) {
            log("⚠ Matériel sans support multi-publicité BLE — la publicité peut échouer");
        }

        try {
            server = btManager.openGattServer(context, serverCallback);
        } catch (SecurityException e) {
            log("openGattServer refusé : " + e.getMessage());
            listener.onAdvertisingStarted(false, "Permission refusée");
            return false;
        }
        if (server == null) {
            log("openGattServer() a renvoyé null");
            listener.onAdvertisingStarted(false, "Serveur GATT indisponible");
            return false;
        }

        buildServices();
        boolean ok = server.addService(hrService);
        ok &= server.addService(batteryService);
        ok &= server.addService(buildDeviceInfoService());
        if (!ok) {
            log("⚠ Au moins un service n'a pas pu être ajouté");
        } else {
            log("Serveur GATT prêt : FC 0x180D, batterie 0x180F, infos 0x180A");
        }

        running = true;
        startAdvertising();
        return true;
    }

    public void stop() {
        running = false;
        stopAdvertising();
        if (server != null) {
            try {
                server.clearServices();
                server.close();
            } catch (SecurityException ignored) {
            }
            server = null;
        }
        clients.clear();
        subscribed.clear();
        listener.onClientCountChanged(0);
        log("Serveur GATT arrêté");
    }

    // ==================================================================
    // Construction des services GATT
    // ==================================================================

    private void buildServices() {
        hrService = new BluetoothGattService(SVC_HEART_RATE,
                BluetoothGattService.SERVICE_TYPE_PRIMARY);

        hrMeasurement = new BluetoothGattCharacteristic(
                CHAR_HR_MEASUREMENT,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                0);
        hrMeasurement.addDescriptor(cccd());
        hrMeasurement.setValue(new byte[]{0x00, 0x00});
        hrService.addCharacteristic(hrMeasurement);

        // 3 = « doigt » dans l'énumération Body Sensor Location
        bodySensorLocation = new BluetoothGattCharacteristic(
                CHAR_BODY_SENSOR_LOCATION,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ);
        bodySensorLocation.setValue(new byte[]{0x03});
        hrService.addCharacteristic(bodySensorLocation);

        batteryService = new BluetoothGattService(SVC_BATTERY,
                BluetoothGattService.SERVICE_TYPE_PRIMARY);
        batteryLevel = new BluetoothGattCharacteristic(
                CHAR_BATTERY_LEVEL,
                BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ);
        batteryLevel.addDescriptor(cccd());
        batteryLevel.setValue(new byte[]{(byte) 100});
        batteryService.addCharacteristic(batteryLevel);
    }

    private BluetoothGattService buildDeviceInfoService() {
        BluetoothGattService dis = new BluetoothGattService(SVC_DEVICE_INFO,
                BluetoothGattService.SERVICE_TYPE_PRIMARY);
        dis.addCharacteristic(utf8Char(CHAR_MANUFACTURER, "QRing/Colmi ring + Android bridge"));
        dis.addCharacteristic(utf8Char(CHAR_MODEL, "QRing HR Bridge"));
        dis.addCharacteristic(utf8Char(CHAR_SERIAL, "QRB-000001"));
        dis.addCharacteristic(utf8Char(CHAR_FIRMWARE, "3.0"));
        return dis;
    }

    private static BluetoothGattCharacteristic utf8Char(UUID uuid, String value) {
        BluetoothGattCharacteristic c = new BluetoothGattCharacteristic(
                uuid,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ);
        c.setValue(value);
        return c;
    }

    private static BluetoothGattDescriptor cccd() {
        BluetoothGattDescriptor d = new BluetoothGattDescriptor(
                CCCD,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE);
        d.setValue(BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE);
        return d;
    }

    // ==================================================================
    // Publicité BLE
    // ==================================================================

    private void startAdvertising() {
        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) {
            log("Publicité BLE non supportée par cet appareil (émulateur ?) — "
                    + "le pont GATT reste actif pour un client déjà appairé");
            listener.onAdvertisingStarted(false, "Publicité BLE non supportée");
            return;
        }

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                .setConnectable(true)
                .setTimeout(0)
                .build();

        AdvertiseData data = new AdvertiseData.Builder()
                .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                .setIncludeTxPowerLevel(false)
                .build();

        AdvertiseData scanResponse = new AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                .build();

        try {
            // Nom visible dans le gestionnaire Bluetooth / Strava
            if (adapter.getName() == null || !DEVICE_NAME.equals(adapter.getName())) {
                adapter.setName(DEVICE_NAME);
            }
            advertiser.startAdvertising(settings, data, scanResponse, advertiseCallback);
        } catch (SecurityException e) {
            log("startAdvertising refusé (BLUETOOTH_ADVERTISE) : " + e.getMessage());
            listener.onAdvertisingStarted(false, "Permission BLUETOOTH_ADVERTISE manquante");
        }
    }

    private void stopAdvertising() {
        if (advertiser != null) {
            try {
                advertiser.stopAdvertising(advertiseCallback);
            } catch (SecurityException ignored) {
            }
        }
        advertised = false;
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            advertised = true;
            log("✔ Publicité BLE active — « " + DEVICE_NAME + " » visible comme capteur FC (0x180D)");
            listener.onAdvertisingStarted(true, "Publicité active");
        }

        @Override
        public void onStartFailure(int errorCode) {
            advertised = false;
            String detail;
            switch (errorCode) {
                case ADVERTISE_FAILED_DATA_TOO_LARGE:
                    detail = "données de publicité trop volumineuses";
                    break;
                case ADVERTISE_FAILED_TOO_MANY_ADVERTISERS:
                    detail = "trop de publicités actives";
                    break;
                case ADVERTISE_FAILED_ALREADY_STARTED:
                    detail = "publicité déjà démarrée";
                    break;
                case ADVERTISE_FAILED_INTERNAL_ERROR:
                    detail = "erreur interne";
                    break;
                case ADVERTISE_FAILED_FEATURE_UNSUPPORTED:
                    detail = "non supporté par le matériel";
                    break;
                default:
                    detail = "code " + errorCode;
            }
            log("✘ Publicité BLE en échec : " + detail);
            listener.onAdvertisingStarted(false, detail);
        }
    };

    // ==================================================================
    // Notification des mesures
    // ==================================================================

    /** Envoie la FC (bpm) aux centraux abonnés (Strava, Wahoo, Garmin…). */
    public void notifyHeartRate(int bpm) {
        if (!running || hrMeasurement == null || bpm <= 0 || bpm > 255) {
            return;
        }
        // flags = 0x00 → format uint8, capteur non connecté… (valeur brute)
        byte[] value = new byte[]{0x00, (byte) (bpm & 0xFF)};
        hrMeasurement.setValue(value);
        notifySubscribers(hrMeasurement, value);
    }

    public void notifyBattery(int percent) {
        if (!running || batteryLevel == null || percent < 0) {
            return;
        }
        byte[] value = new byte[]{(byte) Math.min(percent, 100)};
        batteryLevel.setValue(value);
        notifySubscribers(batteryLevel, value);
    }

    private void notifySubscribers(BluetoothGattCharacteristic characteristic, byte[] value) {
        if (server == null) {
            return;
        }
        String charUuid = characteristic.getUuid().toString();
        for (BluetoothDevice device : new ArrayList<>(clients)) {
            if (!subscribed.contains(key(device, charUuid))) {
                continue;
            }
            try {
                server.notifyCharacteristicChanged(device, characteristic, false);
            } catch (SecurityException e) {
                log("Notification refusée : " + e.getMessage());
            }
        }
    }

    private static String key(BluetoothDevice device, String charUuid) {
        return device.getAddress() + "/" + charUuid;
    }

    // ==================================================================
    // Callback serveur GATT
    // ==================================================================

    private final BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                clients.add(device);
                log("Central BLE connecté : " + device.getAddress()
                        + " (" + clients.size() + " client(s))");
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                clients.remove(device);
                for (String k : new ArrayList<>(subscribed)) {
                    if (k.startsWith(device.getAddress())) {
                        subscribed.remove(k);
                    }
                }
                log("Central BLE déconnecté : " + device.getAddress());
            }
            listener.onClientCountChanged(clients.size());
        }

        @Override
        public void onServiceAdded(int status, BluetoothGattService service) {
            log("Service ajouté : " + service.getUuid() + " (status=" + status + ")");
        }

        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset,
                                                BluetoothGattCharacteristic characteristic) {
            byte[] value = characteristic.getValue();
            if (value == null) {
                value = new byte[]{0};
            }
            try {
                server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset,
                        slice(value, offset));
            } catch (SecurityException ignored) {
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                                                 BluetoothGattCharacteristic characteristic,
                                                 boolean preparedWrite, boolean responseNeeded,
                                                 int offset, byte[] value) {
            if (responseNeeded) {
                try {
                    server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                } catch (SecurityException ignored) {
                }
            }
        }

        @Override
        public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset,
                                            BluetoothGattDescriptor descriptor) {
            byte[] value = descriptor.getValue();
            if (value == null) {
                value = BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE;
            }
            try {
                server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            } catch (SecurityException ignored) {
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId,
                                             BluetoothGattDescriptor descriptor,
                                             boolean preparedWrite, boolean responseNeeded,
                                             int offset, byte[] value) {
            if (descriptor != null && CCCD.equals(descriptor.getUuid())) {
                descriptor.setValue(value);
                String k = key(device, descriptor.getCharacteristic().getUuid().toString());
                boolean enable = value != null && value.length > 0 && value[0] != 0x00;
                if (enable) {
                    subscribed.add(k);
                    log("Abonnement FC activé par " + device.getAddress());
                } else {
                    subscribed.remove(k);
                    log("Abonnement FC désactivé par " + device.getAddress());
                }
            }
            if (responseNeeded) {
                try {
                    server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                } catch (SecurityException ignored) {
                }
            }
        }

        @Override
        public void onMtuChanged(BluetoothDevice device, int mtu) {
            log("MTU négocié : " + mtu + " octets");
        }
    };

    private static byte[] slice(byte[] data, int offset) {
        if (offset <= 0 || offset >= data.length) {
            return data;
        }
        byte[] out = new byte[data.length - offset];
        System.arraycopy(data, offset, out, 0, out.length);
        return out;
    }

    private void log(String message) {
        Logs.add("[pont] " + message);
        listener.onPeripheralLog(String.format(Locale.US, "%s", message));
    }
}
