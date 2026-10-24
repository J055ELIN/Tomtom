package com.qring.strava.bridge;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Build;

import java.util.List;
import java.util.UUID;

/**
 * Client d'un capteur de fréquence cardiaque STANDARD (profil BLE Heart Rate,
 * service 0x180D, mesure 0x2A37).
 *
 * Sert à utiliser comme source de FC :
 *  - une montre / bracelet qui diffuse sa FC (Huawei Band 9, Amazfit, Garmin…) ;
 *  - une ceinture pectorale (Polar H10, Wahoo TICKR, Garmin HRM…).
 *
 * Aucun protocole propriétaire n'est nécessaire : ces appareils exposent le profil
 * standard, celui-là même que Strava sait lire.
 */
public class HrmClient {

    public interface Listener {
        void onHrmConnected(BluetoothDevice device);

        void onHrmDisconnected();

        void onHrmHeartRate(int bpm);

        void onHrmLog(String message);
    }

    public static final UUID SVC_HEART_RATE = UUID.fromString("0000180D-0000-1000-8000-00805F9B34FB");
    public static final UUID CHR_MEASUREMENT = UUID.fromString("00002A37-0000-1000-8000-00805F9B34FB");
    public static final UUID CHR_BODY_SENSOR_LOCATION = UUID.fromString("00002A38-0000-1000-8000-00805F9B34FB");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB");

    private final Context context;
    private final Listener listener;
    private BluetoothGatt gatt;
    private volatile boolean connected;
    private String deviceName = "";

    public HrmClient(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    public boolean isConnected() {
        return connected;
    }

    /** Vrai si cet appareil expose (ou annonce) le profil Heart Rate standard. */
    public static boolean advertisesHeartRate(java.util.List<android.os.ParcelUuid> uuids) {
        if (uuids == null) {
            return false;
        }
        for (android.os.ParcelUuid u : uuids) {
            if (SVC_HEART_RATE.equals(u.getUuid())) {
                return true;
            }
        }
        return false;
    }

    @SuppressLint("MissingPermission")
    public void connect(BluetoothDevice device) {
        if (device == null) {
            listener.onHrmLog("[hrm] appareil invalide");
            return;
        }
        disconnect();
        try {
            deviceName = device.getName() != null ? device.getName() : device.getAddress();
        } catch (SecurityException e) {
            deviceName = device.getAddress();
        }
        listener.onHrmLog("[hrm] connexion à " + deviceName + "…");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            gatt = device.connectGatt(context, true, callback, BluetoothDevice.TRANSPORT_LE);
        } else {
            gatt = device.connectGatt(context, true, callback);
        }
    }

    @SuppressLint("MissingPermission")
    public void disconnect() {
        connected = false;
        if (gatt != null) {
            try {
                gatt.disconnect();
                gatt.close();
            } catch (SecurityException ignored) {
            }
            gatt = null;
        }
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                listener.onHrmLog("[hrm] connecté (" + deviceName + "), découverte des services…");
                try {
                    g.discoverServices();
                } catch (SecurityException e) {
                    listener.onHrmLog("[hrm] découverte refusée : " + e.getMessage());
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connected = false;
                listener.onHrmDisconnected();
                listener.onHrmLog("[hrm] déconnecté (status " + status + ")");
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                listener.onHrmLog("[hrm] découverte en échec (status " + status + ")");
                return;
            }
            List<BluetoothGattService> services = g.getServices();
            BluetoothGattService hr = g.getService(SVC_HEART_RATE);
            if (hr == null) {
                StringBuilder sb = new StringBuilder();
                for (BluetoothGattService s : services) {
                    sb.append(s.getUuid().toString().substring(4, 8)).append(' ');
                }
                listener.onHrmLog("[hrm] service 0x180D ABSENT. Services vus : " + sb);
                listener.onHrmLog("[hrm] → sur une montre, activer la diffusion de la FC "
                        + "(réglages de l'appareil), sinon aucun profil standard n'est exposé");
                return;
            }
            BluetoothGattCharacteristic ch = hr.getCharacteristic(CHR_MEASUREMENT);
            if (ch == null) {
                listener.onHrmLog("[hrm] caractéristique 0x2A37 absente");
                return;
            }
            try {
                g.setCharacteristicNotification(ch, true);
                BluetoothGattDescriptor d = ch.getDescriptor(CCCD);
                if (d != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        g.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    } else {
                        d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                        g.writeDescriptor(d);
                    }
                } else {
                    listener.onHrmLog("[hrm] CCCD absent — notifications peut-être déjà actives");
                    connected = true;
                    listener.onHrmConnected(g.getDevice());
                }
            } catch (SecurityException e) {
                listener.onHrmLog("[hrm] abonnement refusé : " + e.getMessage());
            }

            BluetoothGattCharacteristic loc = hr.getCharacteristic(CHR_BODY_SENSOR_LOCATION);
            if (loc != null) {
                try {
                    g.readCharacteristic(loc);
                } catch (SecurityException ignored) {
                }
            }
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
            if (CCCD.equals(descriptor.getUuid())) {
                boolean ok = status == BluetoothGatt.GATT_SUCCESS;
                connected = ok;
                listener.onHrmLog("[hrm] abonnement FC " + (ok ? "activé" : "en échec (" + status + ")"));
                if (ok) {
                    listener.onHrmConnected(g.getDevice());
                }
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
            if (CHR_MEASUREMENT.equals(ch.getUuid())) {
                int bpm = parseHeartRate(ch.getValue());
                if (bpm > 0) {
                    listener.onHrmHeartRate(bpm);
                }
            }
        }

        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
            if (CHR_BODY_SENSOR_LOCATION.equals(ch.getUuid())) {
                byte[] v = ch.getValue();
                if (v != null && v.length > 0) {
                    listener.onHrmLog("[hrm] position du capteur : " + sensorLocation(v[0]));
                }
            }
        }
    };

    /**
     * Format de la mesure 0x2A37 : drapeaux (bit 0 = valeur 16 bits), puis la FC.
     */
    public static int parseHeartRate(byte[] data) {
        if (data == null || data.length < 2) {
            return -1;
        }
        int flags = data[0] & 0xFF;
        boolean sixteen = (flags & 0x01) != 0;
        if (sixteen) {
            if (data.length < 3) {
                return -1;
            }
            return ((data[2] & 0xFF) << 8) | (data[1] & 0xFF);
        }
        return data[1] & 0xFF;
    }

    private static String sensorLocation(byte b) {
        switch (b) {
            case 0: return "autre";
            case 1: return "poitrine";
            case 2: return "bras";
            case 3: return "poignet";
            case 4: return "main";
            case 5: return "doigt";
            default: return "inconnue (" + b + ")";
        }
    }
}
