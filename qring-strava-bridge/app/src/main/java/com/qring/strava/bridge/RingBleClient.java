package com.qring.strava.bridge;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/**
 * Client BLE vers la bague Colmi/QRing (R02, R03, R06, R10, …).
 *
 * Protocole (vérifié sur le client Python qlam-ai/qring et Gadgetbridge) :
 *   Service  : 6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E  (Nordic UART)
 *   RX (écriture vers la bague) : 6E400002-…
 *   TX (notifications)          : 6E400003-…
 *
 *   Trame = 16 octets, octet 0 = commande, octet 15 = somme des octets précédents & 0xFF.
 *
 *   Temps réel :
 *     0x69 (105) + [type=0x01 (FC), action=0x01 (START)]  → démarre le flux FC
 *     0x6A (106) + [type, 0x00, 0x00]                     → arrête le flux
 *     0x1E (30)  + ['3' = 0x33]                           → maintien du flux (« continue »)
 *   Réponse : trame 0x69, [1]=type, [2]=code d'erreur, [3]=valeur (bpm).
 *
 *   Batterie : 0x03 → réponse [1]=niveau %, [2]=en charge.
 *   Heure    : 0x01 + 7 octets BCD (année-2000, mois, jour, h, m, s, langue).
 */
public class RingBleClient {

    public interface Listener {
        void onRingConnected(BluetoothDevice device);

        void onRingDisconnected();

        void onHeartRate(int bpm);

        void onRingBattery(int levelPercent, boolean charging);

        void onRingLog(String message);
    }

    public static final UUID SVC_UART = UUID.fromString("6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E");
    public static final UUID CHAR_RX = UUID.fromString("6E400002-B5A3-F393-E0A9-E50E24DCCA9E");
    public static final UUID CHAR_TX = UUID.fromString("6E400003-B5A3-F393-E0A9-E50E24DCCA9E");
    public static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    public static final int CMD_SET_TIME = 0x01;
    public static final int CMD_BATTERY = 0x03;
    public static final int CMD_REAL_TIME_HR = 0x69;
    public static final int CMD_STOP_REAL_TIME = 0x6A;
    public static final int CMD_REAL_TIME_CONTINUE = 0x1E;

    private static final long CONTINUE_PERIOD_MS = 20000L;
    private static final long HR_TIMEOUT_MS = 25000L;

    private final Context context;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic rxChar;
    private BluetoothGattCharacteristic txChar;
    private BluetoothDevice device;

    private volatile boolean connected = false;
    private volatile boolean streaming = false;
    private volatile boolean reconnectEnabled = false;
    private long lastHrAt = 0L;

    private final Runnable keepAlive = new Runnable() {
        @Override
        public void run() {
            if (!connected || gatt == null) {
                return;
            }
            long now = System.currentTimeMillis();
            if (now - lastHrAt > HR_TIMEOUT_MS) {
                log("Pas de FC depuis " + ((now - lastHrAt) / 1000) + " s → relance du flux");
                lastHrAt = now;
                startHeartRateStream();
            } else {
                sendPacket(buildPacket(CMD_REAL_TIME_CONTINUE, new int[]{0x33}));
            }
            handler.postDelayed(this, CONTINUE_PERIOD_MS);
        }
    };

    public RingBleClient(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    // ==================================================================
    // Connexion
    // ==================================================================

    public void connect(BluetoothDevice target, boolean autoReconnect) {
        this.device = target;
        this.reconnectEnabled = autoReconnect;
        log("Connexion à " + safeName(target) + " [" + target.getAddress() + "]");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            gatt = target.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE);
        } else {
            gatt = target.connectGatt(context, false, callback);
        }
        if (gatt == null) {
            log("connectGatt() a renvoyé null — Bluetooth désactivé ?");
            listener.onRingLog("Impossible d'ouvrir le GATT");
        }
    }

    public boolean isConnected() {
        return connected;
    }

    public String getAddress() {
        return device != null ? device.getAddress() : "";
    }

    public void disconnect() {
        reconnectEnabled = false;
        streaming = false;
        handler.removeCallbacks(keepAlive);
        if (gatt != null) {
            try {
                gatt.disconnect();
                gatt.close();
            } catch (SecurityException ignored) {
                // permission révoquée : rien d'autre à faire
            }
        }
        gatt = null;
        connected = false;
        BridgeState.ringConnected = false;
        listener.onRingDisconnected();
    }

    // ==================================================================
    // Commandes
    // ==================================================================

    public void startHeartRateStream() {
        if (!connected) {
            return;
        }
        log("→ démarrage du flux FC temps réel (0x69)");
        sendPacket(buildPacket(CMD_REAL_TIME_HR, new int[]{0x01, 0x01}));
        streaming = true;
        lastHrAt = System.currentTimeMillis();
    }

    public void stopHeartRateStream() {
        if (!connected) {
            return;
        }
        log("→ arrêt du flux FC (0x6A)");
        sendPacket(buildPacket(CMD_STOP_REAL_TIME, new int[]{0x01, 0x00, 0x00}));
        streaming = false;
    }

    public void requestBattery() {
        if (!connected) {
            return;
        }
        sendPacket(buildPacket(CMD_BATTERY, new int[0]));
    }

    public void syncTime() {
        if (!connected) {
            return;
        }
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        int year = c.get(Calendar.YEAR) % 2000;
        int[] data = new int[]{
                bcd(year),
                bcd(c.get(Calendar.MONTH) + 1),
                bcd(c.get(Calendar.DAY_OF_MONTH)),
                bcd(c.get(Calendar.HOUR_OF_DAY)),
                bcd(c.get(Calendar.MINUTE)),
                bcd(c.get(Calendar.SECOND)),
                0x01 // langue : anglais
        };
        log("→ synchronisation de l'heure de la bague (UTC)");
        sendPacket(buildPacket(CMD_SET_TIME, data));
    }

    // ==================================================================
    // Trames
    // ==================================================================

    /**
     * Construit une trame de 16 octets : [commande, données..., 0x00…, checksum].
     * checksum = somme de tous les octets (mod 256), placé en dernier.
     */
    public static byte[] buildPacket(int command, int[] data) {
        byte[] packet = new byte[16];
        packet[0] = (byte) (command & 0xFF);
        if (data != null) {
            for (int i = 0; i < data.length && i + 1 < 15; i++) {
                packet[i + 1] = (byte) (data[i] & 0xFF);
            }
        }
        int sum = 0;
        for (int i = 0; i < 15; i++) {
            sum += packet[i] & 0xFF;
        }
        packet[15] = (byte) (sum & 0xFF);
        return packet;
    }

    private boolean sendPacket(byte[] packet) {
        if (gatt == null || rxChar == null) {
            return false;
        }
        try {
            rxChar.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            rxChar.setValue(packet);
            boolean ok = gatt.writeCharacteristic(rxChar);
            if (!ok) {
                log("Écriture refusée : " + hex(packet));
            }
            return ok;
        } catch (SecurityException e) {
            log("Écriture impossible (permission) : " + e.getMessage());
            return false;
        }
    }

    // ==================================================================
    // Callback GATT
    // ==================================================================

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {

        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                log("Connecté (status=" + status + ") → découverte des services");
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH);
                    }
                    g.discoverServices();
                } catch (SecurityException e) {
                    log("discoverServices refusé : " + e.getMessage());
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                log("Déconnecté (status=" + status + ")");
                connected = false;
                streaming = false;
                rxChar = null;
                txChar = null;
                handler.removeCallbacks(keepAlive);
                BridgeState.ringConnected = false;
                BridgeState.ringBattery = -1;
                BridgeState.source = "—";
                listener.onRingDisconnected();
                if (gatt != null) {
                    try {
                        gatt.close();
                    } catch (SecurityException ignored) {
                    }
                    gatt = null;
                }
                if (reconnectEnabled && device != null) {
                    log("Reconnexion automatique dans 4 s…");
                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            if (reconnectEnabled && !connected) {
                                connect(device, true);
                            }
                        }
                    }, 4000L);
                }
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                log("Découverte des services en échec (status=" + status + ")");
                return;
            }
            BluetoothGattService svc = g.getService(SVC_UART);
            if (svc == null) {
                log("Service UART 6E40FFF0 introuvable sur cet appareil");
                listener.onRingLog("Service UART absent — mauvaise bague ?");
                return;
            }
            rxChar = svc.getCharacteristic(CHAR_RX);
            txChar = svc.getCharacteristic(CHAR_TX);
            if (rxChar == null || txChar == null) {
                log("Caractéristiques RX/TX introuvables");
                return;
            }
            try {
                g.setCharacteristicNotification(txChar, true);
                BluetoothGattDescriptor d = txChar.getDescriptor(CCCD);
                if (d != null) {
                    d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    g.writeDescriptor(d);
                } else {
                    log("Descripteur CCCD absent — notifications peut-être déjà actives");
                    onReady();
                }
            } catch (SecurityException e) {
                log("Activation des notifications refusée : " + e.getMessage());
            }
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
            if (descriptor != null && CCCD.equals(descriptor.getUuid())) {
                log("Notifications activées (status=" + status + ")");
                onReady();
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
            byte[] value = ch.getValue();
            if (value == null || value.length < 4) {
                return;
            }
            handlePacket(value);
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
            // écritures sans réponse : rien à faire
        }
    };

    private void onReady() {
        connected = true;
        BridgeState.ringConnected = true;
        BridgeState.ringAddress = getAddress();
        BridgeState.ringName = safeName(device);
        listener.onRingConnected(device);
        syncTime();
        requestBattery();
        startHeartRateStream();
        handler.removeCallbacks(keepAlive);
        lastHrAt = System.currentTimeMillis();
        handler.postDelayed(keepAlive, CONTINUE_PERIOD_MS);
    }

    // ==================================================================
    // Décodage des trames en provenance de la bague
    // ==================================================================

    private void handlePacket(byte[] p) {
        int cmd = p[0] & 0x7F;
        switch (cmd) {
            case CMD_REAL_TIME_HR: {
                int type = p[1] & 0xFF;
                int error = p[2] & 0xFF;
                int value = p[3] & 0xFF;
                if (type != 0x01) {
                    return; // autre mesure (SpO2, pression…) : ignorée
                }
                if (error != 0) {
                    log("Flux FC refusé par la bague (code " + error + ")");
                    return;
                }
                if (value > 0) {
                    lastHrAt = System.currentTimeMillis();
                    BridgeState.source = "bague";
                    listener.onHeartRate(value);
                }
                break;
            }
            case CMD_BATTERY: {
                int level = p[1] & 0xFF;
                boolean charging = (p[2] & 0xFF) != 0;
                BridgeState.ringBattery = level;
                listener.onRingBattery(level, charging);
                break;
            }
            case CMD_SET_TIME:
                log("Heure de la bague synchronisée");
                break;
            default:
                log("Trame 0x" + Integer.toHexString(cmd) + " : " + hex(p));
                break;
        }
    }

    // ==================================================================
    // Utilitaires
    // ==================================================================

    private static int bcd(int v) {
        return ((v / 10) << 4) | (v % 10);
    }

    private static String hex(byte[] data) {
        StringBuilder sb = new StringBuilder();
        for (byte b : data) {
            sb.append(String.format(Locale.US, "%02X ", b & 0xFF));
        }
        return sb.toString().trim();
    }

    private static String safeName(BluetoothDevice d) {
        if (d == null) {
            return "?";
        }
        try {
            String n = d.getName();
            return n != null ? n : "inconnue";
        } catch (SecurityException e) {
            return "inconnue";
        }
    }

    private void log(String msg) {
        Logs.add("[bague] " + msg);
        listener.onRingLog(msg);
    }
}
