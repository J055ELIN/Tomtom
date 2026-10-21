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
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import java.util.ArrayDeque;
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
    public static final UUID CHAR_HR_CONTROL_POINT = UUID.fromString("00002A39-0000-1000-8000-00805F9B34FB");

    public static final UUID SVC_BATTERY = UUID.fromString("0000180F-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_BATTERY_LEVEL = UUID.fromString("00002A19-0000-1000-8000-00805F9B34FB");

    public static final UUID SVC_DEVICE_INFO = UUID.fromString("0000180A-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_MANUFACTURER = UUID.fromString("00002A29-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_MODEL = UUID.fromString("00002A24-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_SERIAL = UUID.fromString("00002A25-0000-1000-8000-00805F9B34FB");
    public static final UUID CHAR_FIRMWARE = UUID.fromString("00002A26-0000-1000-8000-00805F9B34FB");

    public static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB");

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
    private volatile boolean servicesReady = false;

    private final ArrayDeque<BluetoothGattService> servicesToAdd = new ArrayDeque<>();
    private BluetoothGattService pendingService;
    private final Handler gattHandler = new Handler(Looper.getMainLooper());

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

        if (server != null) {
            try {
                server.clearServices();
                server.close();
            } catch (SecurityException ignored) {
            }
            server = null;
            log("Ancien serveur GATT fermé (nettoyage)");
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
        running = true;
        // ⚠ Android n'accepte qu'UN SEUL addService à la fois : il faut attendre
        // le callback onServiceAdded() avant d'ajouter le suivant, sinon les
        // services ne sont jamais enregistrés (un client connecté ne voit alors
        // aucun service — c'était la cause du « Strava ne trouve pas le capteur »).
        servicesToAdd.clear();
        servicesToAdd.add(hrService);
        servicesToAdd.add(batteryService);
        servicesToAdd.add(buildDeviceInfoService());
        addNextService();
        return true;
    }

    // ==================================================================
    // Enregistrement séquentiel des services GATT
    // ==================================================================

    private void addNextService() {
        if (server == null) {
            return;
        }
        BluetoothGattService next = servicesToAdd.poll();
        if (next == null) {
            servicesReady = true;
            log("✔ Serveur GATT prêt : services FC 0x180D + batterie 0x180F + infos 0x180A enregistrés");
            if (!advertised) {
                startAdvertising();
            }
            return;
        }
        pendingService = next;
        log("Enregistrement du service " + shortUuid(next.getUuid()) + "…");
        boolean initiated;
        try {
            initiated = server.addService(next);
        } catch (SecurityException e) {
            initiated = false;
            log("addService refusé : " + e.getMessage());
        }
        if (!initiated) {
            log("⚠ addService a échoué pour " + shortUuid(next.getUuid()));
            pendingService = null;
            addNextService();
            return;
        }
        // filet de sécurité : si le callback n'arrive pas (pile Bluetooth
        // capricieuse), on continue quand même au bout de 3 s.
        gattHandler.removeCallbacks(serviceTimeout);
        gattHandler.postDelayed(serviceTimeout, 3000L);
    }

    private final Runnable serviceTimeout = new Runnable() {
        @Override
        public void run() {
            if (pendingService != null) {
                log("⚠ Pas de confirmation du système pour le service "
                        + shortUuid(pendingService.getUuid()) + " (3 s) — on continue");
                pendingService = null;
                addNextService();
            }
        }
    };

    private static String hexBytes(byte[] data) {
        if (data == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : data) {
            sb.append(String.format(Locale.US, "%02X ", b & 0xFF));
        }
        return sb.toString().trim();
    }

    private static String shortUuid(UUID uuid) {
        String s = uuid.toString().toUpperCase(Locale.US);
        if (s.startsWith("0000") && s.endsWith("-0000-1000-8000-00805F9B34FB")) {
            return "0x" + s.substring(4, 8);
        }
        return s;
    }

    public void stop() {
        running = false;
        advHandler.removeCallbacksAndMessages(null);
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
        servicesToAdd.clear();
        pendingService = null;
        servicesReady = false;
        gattHandler.removeCallbacksAndMessages(null);
        BridgeState.subscribed = false;
        listener.onClientCountChanged(0);
        log("Serveur GATT arrêté");
    }

    // ==================================================================
    // Construction des services GATT
    // ==================================================================

    private void buildServices() {
        hrService = new BluetoothGattService(SVC_HEART_RATE,
                BluetoothGattService.SERVICE_TYPE_PRIMARY);

        // READ en plus de NOTIFY : certaines applications (dont Strava) lisent la
        // dernière valeur avant de s'abonner.
        hrMeasurement = new BluetoothGattCharacteristic(
                CHAR_HR_MEASUREMENT,
                BluetoothGattCharacteristic.PROPERTY_READ
                        | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ);
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

        BluetoothGattCharacteristic controlPoint = new BluetoothGattCharacteristic(
                CHAR_HR_CONTROL_POINT,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE);
        controlPoint.setValue(new byte[]{0x00});
        hrService.addCharacteristic(controlPoint);

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
    //
    // Trois variantes sont essayées l'une après l'autre : certains téléphones
    // refusent la publicité dès qu'elle dépasse 31 octets (UUID + nom), d'autres
    // n'acceptent pas de scan response. En cas d'échec total, une nouvelle
    // tentative est programmée toutes les 15 s (le pont GATT reste actif).
    // ==================================================================

    private static final int ADVERTISE_RETRY_MS = 15000;
    private static final int ADVERTISE_REFRESH_MS = 60000;

    private final Handler advHandler = new Handler(Looper.getMainLooper());
    private int advStrategy = 0;
    private boolean advRetryScheduled = false;

    private final Runnable advRefresh = new Runnable() {
        @Override
        public void run() {
            if (!running) {
                return;
            }
            // relance la publicité régulièrement : certains contrôleurs l'arrêtent
            // silencieusement au bout d'un moment
            if (advertised) {
                try {
                    if (advertiser != null) {
                        advertiser.stopAdvertising(advertiseCallback);
                    }
                } catch (SecurityException ignored) {
                }
                advertised = false;
                log("Rafraîchissement de la publicité BLE (périodique)");
                advStrategy = 0;
                startAdvertising();
            }
            advHandler.postDelayed(this, ADVERTISE_REFRESH_MS);
        }
    };

    private final Runnable advRetry = new Runnable() {
        @Override
        public void run() {
            advRetryScheduled = false;
            if (running && !advertised) {
                log("Nouvelle tentative de publicité BLE…");
                advStrategy = 0;
                startAdvertising();
            }
        }
    };

    private void startAdvertising() {
        if (adapter == null) {
            return;
        }
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

        AdvertiseData data;
        AdvertiseData scanResponse = null;
        String label;

        // Réplique exacte de ce qu'émettent les ceintures FUSE (relevé nRF Connect) :
        //   02 01 06              flags (LE General Discoverable, BR/EDR not supported)
        //   03 03 0D 18           liste complète des UUID 16 bits = 0x180D
        //   0A 09 51 52 69 6E 67 20 48 52   nom complet « QRing HR »
        final byte[] hrServiceData = new byte[]{0x00, (byte) (BridgeState.bpm > 0
                ? Math.min(BridgeState.bpm, 255) : 0)};

        switch (advStrategy) {
            case 0:
                // structure identique à NEW-FUSE / Joss-FUSE : 0x180D + nom
                data = new AdvertiseData.Builder()
                        .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                        .setIncludeDeviceName(true)
                        .setIncludeTxPowerLevel(false)
                        .build();
                scanResponse = null;
                label = "0x180D + nom (comme les ceintures FUSE)";
                log("   trame visée : 02 01 06 03 03 0D 18 <nom> " + hexBytes(localName().getBytes()));
                break;
            case 1:
                // + batterie 0x180F
                data = new AdvertiseData.Builder()
                        .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                        .addServiceUuid(new ParcelUuid(SVC_BATTERY))
                        .setIncludeDeviceName(true)
                        .setIncludeTxPowerLevel(false)
                        .build();
                scanResponse = null;
                label = "0x180D + 0x180F + nom";
                break;
            case 2:
                // + service data 0x180D (flags + bpm)
                data = new AdvertiseData.Builder()
                        .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                        .addServiceData(new ParcelUuid(SVC_HEART_RATE), hrServiceData)
                        .setIncludeDeviceName(true)
                        .setIncludeTxPowerLevel(false)
                        .build();
                scanResponse = null;
                label = "0x180D + serviceData FC + nom";
                break;
            case 3:
                // nom uniquement en réponse de scan
                data = new AdvertiseData.Builder()
                        .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                        .build();
                scanResponse = new AdvertiseData.Builder()
                        .setIncludeDeviceName(true)
                        .build();
                label = "UUID publicité + nom en réponse de scan";
                break;
            default:
                data = new AdvertiseData.Builder()
                        .addServiceUuid(new ParcelUuid(SVC_HEART_RATE))
                        .build();
                scanResponse = null;
                label = "UUID seul";
                break;
        }

        log("Publicité BLE : tentative « " + label + " »");
        try {
            advertiser.startAdvertising(settings, data, scanResponse, advertiseCallback);
        } catch (SecurityException e) {
            log("startAdvertising refusé (BLUETOOTH_ADVERTISE) : " + e.getMessage());
            listener.onAdvertisingStarted(false, "Permission BLUETOOTH_ADVERTISE manquante");
        } catch (IllegalArgumentException e) {
            log("startAdvertising invalide : " + e.getMessage());
            nextStrategyOrRetry("paramètres refusés");
        }
    }

    private void stopAdvertising() {
        advHandler.removeCallbacks(advRetry);
        advHandler.removeCallbacks(advRefresh);
        advRetryScheduled = false;
        if (advertiser != null) {
            try {
                advertiser.stopAdvertising(advertiseCallback);
            } catch (SecurityException ignored) {
            }
        }
        advertised = false;
    }

    private void nextStrategyOrRetry(String reason) {
        advStrategy++;
        if (advStrategy < 4) {
            log("Publicité refusée (" + reason + ") → variante suivante");
            startAdvertising();
            return;
        }
        advStrategy = 0;
        log("✘ Aucune variante de publicité acceptée (" + reason + ")");
        listener.onAdvertisingStarted(false, reason);
        scheduleAdvRetry();
    }

    private void scheduleAdvRetry() {
        if (advRetryScheduled || !running) {
            return;
        }
        advRetryScheduled = true;
        advHandler.postDelayed(advRetry, ADVERTISE_RETRY_MS);
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            advertised = true;
            log("✔ Publicité BLE active — capteur FC 0x180D visible sous le nom « "
                    + localName() + " »");
            log("   → dans Strava : Capteurs → Fréquence cardiaque → « " + localName() + " »");
            listener.onAdvertisingStarted(true, "Publicité active (" + localName() + ")");
            advHandler.removeCallbacks(advRefresh);
            advHandler.postDelayed(advRefresh, ADVERTISE_REFRESH_MS);
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
                    detail = "trop de publicités actives (une autre app occupe la publicité BLE)";
                    break;
                case ADVERTISE_FAILED_ALREADY_STARTED:
                    detail = "publicité déjà démarrée";
                    break;
                case ADVERTISE_FAILED_INTERNAL_ERROR:
                    detail = "erreur interne du Bluetooth";
                    break;
                case ADVERTISE_FAILED_FEATURE_UNSUPPORTED:
                    detail = "non supporté par le matériel";
                    break;
                default:
                    detail = "code " + errorCode;
            }
            log("✘ Publicité BLE en échec : " + detail);
            if (errorCode == ADVERTISE_FAILED_ALREADY_STARTED) {
                // une publicité existe déjà : on la considère comme active
                advertised = true;
                listener.onAdvertisingStarted(true, "publicité déjà active");
                return;
            }
            if (errorCode == ADVERTISE_FAILED_FEATURE_UNSUPPORTED) {
                listener.onAdvertisingStarted(false, detail);
                return;
            }
            nextStrategyOrRetry(detail);
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
                String cname;
                try {
                    cname = device.getName();
                } catch (SecurityException e) {
                    cname = null;
                }
                log("Central BLE connecté : " + device.getAddress()
                        + (cname != null ? " (« " + cname + " »)" : "")
                        + " (" + clients.size() + " client(s))");
                if (!servicesReady) {
                    // Un client qui se connecte avant l'enregistrement des services
                    // mémorise une base GATT vide et reste bloqué. On le déconnecte
                    // pour qu'il réessaie proprement.
                    log("   ⚠ connecté avant l'enregistrement des services → reconnexion forcée");
                    final BluetoothDevice early = device;
                    gattHandler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                if (server != null) {
                                    server.cancelConnection(early);
                                }
                            } catch (SecurityException ignored) {
                            }
                        }
                    }, 400L);
                    listener.onClientCountChanged(clients.size());
                    return;
                }
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
            gattHandler.removeCallbacks(serviceTimeout);
            pendingService = null;
            if (status == BluetoothGatt.GATT_SUCCESS) {
                log("✔ Service enregistré : " + shortUuid(service.getUuid()));
            } else {
                log("✘ Service refusé : " + shortUuid(service.getUuid()) + " (status=" + status + ")");
            }
            addNextService();
        }

        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset,
                                                BluetoothGattCharacteristic characteristic) {
            byte[] value = characteristic.getValue();
            if (value == null) {
                value = new byte[]{0};
            }
            log("Lecture " + shortUuid(characteristic.getUuid()) + " par " + device.getAddress());
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
                    BridgeState.subscribed = true;
                    BridgeState.notifyListeners();
                    log("✔ Abonnement FC activé par " + device.getAddress()
                            + " (une appli — Strava ? — vient de se connecter)");
                    // envoie immédiatement la dernière valeur connue
                    int bpm = BridgeState.bpm;
                    if (bpm > 0) {
                        byte[] hr = new byte[]{0x00, (byte) (bpm & 0xFF)};
                        hrMeasurement.setValue(hr);
                        try {
                            server.notifyCharacteristicChanged(device, hrMeasurement, false);
                            log("   → FC " + bpm + " bpm envoyée immédiatement");
                        } catch (SecurityException ignored) {
                        }
                    }
                } else {
                    subscribed.remove(k);
                    BridgeState.subscribed = !subscribed.isEmpty();
                    BridgeState.notifyListeners();
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

    /** Nom Bluetooth du téléphone : c'est celui que Strava affichera dans la liste des capteurs. */
    private String localName() {
        try {
            String n = adapter != null ? adapter.getName() : null;
            return n != null && !n.isEmpty() ? n : "téléphone";
        } catch (SecurityException e) {
            return "téléphone";
        }
    }

    private void log(String message) {
        Logs.add("[pont] " + message);
        listener.onPeripheralLog(String.format(Locale.US, "%s", message));
    }
}
