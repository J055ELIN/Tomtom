package com.qring.strava.bridge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

/**
 * Service de premier plan qui porte le pont complet :
 *
 *   bague QRing/Colmi  ──BLE──▶  téléphone  ──BLE (rôle périphérique)──▶  Strava
 *
 * Il maintient la connexion à la bague, reçoit la FC temps réel (0x69)
 * et la republie en notifications 0x2A37 (profil Heart Rate standard).
 */
public class HrBridgeService extends Service
        implements RingBleClient.Listener, HrmPeripheral.Listener, HrmClient.Listener {

    public static final String ACTION_START = "com.qring.strava.bridge.action.START";
    public static final String ACTION_STOP = "com.qring.strava.bridge.action.STOP";

    public static final String EXTRA_ADDRESS = "extra_address";
    public static final String EXTRA_NAME = "extra_name";
    public static final String EXTRA_SIMULATE = "extra_simulate";
    /** true = source FC standard (0x180D) : montre/bracelet ou ceinture, pas la bague. */
    public static final String EXTRA_STANDARD_HRM = "extra_standard_hrm";

    private static final String CHANNEL_ID = "bridge";
    private static final int NOTIF_ID = 42;

    private RingBleClient ring;
    private HrmClient hrm;
    private HrmPeripheral peripheral;
    private SessionRecorder recorder;
    private PowerManager.WakeLock wakeLock;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean simulate = false;
    private int simPhase = 0;
    private long lastNotifUpdate = 0L;
    private int lastBpm = -1;

    private final Runnable simulationTick = new Runnable() {
        @Override
        public void run() {
            if (!simulate) {
                return;
            }
            // sinusoïde 62 → 158 bpm, période ~80 s
            int bpm = (int) Math.round(110 + 48 * Math.sin(simPhase * 2 * Math.PI / 80.0));
            simPhase = (simPhase + 1) % 80;
            lastBpm = bpm;
            if (recorder != null) {
                recorder.onHeartRate(bpm);
            }
            BridgeState.source = "simulation";
            BridgeState.setBpm(bpm);
            if (peripheral != null) {
                peripheral.notifyHeartRate(bpm);
            }
            updateNotification();
            handler.postDelayed(this, 1000L);
        }
    };

    // ==================================================================
    // Cycle de vie
    // ==================================================================

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        ring = new RingBleClient(this, this);
        peripheral = new HrmPeripheral(this, this);
        recorder = SessionRecorder.getInstance(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopBridge();
            return START_NOT_STICKY;
        }

        boolean sim = intent != null && intent.getBooleanExtra(EXTRA_SIMULATE, false);
        String address = intent != null ? intent.getStringExtra(EXTRA_ADDRESS) : null;
        String name = intent != null ? intent.getStringExtra(EXTRA_NAME) : null;
        boolean standardHrm = intent != null && intent.getBooleanExtra(EXTRA_STANDARD_HRM, false);

        startForeground(NOTIF_ID, buildNotification());
        acquireWakeLock();

        if (!peripheral.isRunning()) {
            boolean ok = peripheral.start();
            BridgeState.bridgeRunning = true;
            Logs.add("[service] pont démarré (" + (ok ? "GATT OK" : "GATT en échec") + ")");
        }
        BridgeState.bridgeRunning = true;

        if (recorder != null && !recorder.isRecording()) {
            recorder.start();
            BridgeState.recording = true;
        }

        if (sim) {
            simulate = true;
            BridgeState.simulating = true;
            BridgeState.status = "Mode test : FC simulée";
            handler.removeCallbacks(simulationTick);
            handler.post(simulationTick);
            Logs.add("[service] mode simulation activé");
        } else if (standardHrm && address != null && !address.isEmpty()) {
            simulate = false;
            BridgeState.simulating = false;
            BridgeState.setStatus("Connexion au capteur FC " + (name != null ? name : address) + "…");
            try {
                if (hrm == null) {
                    hrm = new HrmClient(this, this);
                }
                BluetoothDevice device = android.bluetooth.BluetoothAdapter
                        .getDefaultAdapter().getRemoteDevice(address);
                hrm.connect(device);
            } catch (Exception e) {
                Logs.add("[service] adresse invalide : " + e.getMessage());
                BridgeState.setStatus("Adresse de capteur invalide");
            }
        } else if (address != null && !address.isEmpty()) {
            simulate = false;
            BridgeState.simulating = false;
            BridgeState.setStatus("Connexion à la bague " + (name != null ? name : address) + "…");
            try {
                BluetoothDevice device = android.bluetooth.BluetoothAdapter
                        .getDefaultAdapter().getRemoteDevice(address);
                ring.connect(device, true);
            } catch (Exception e) {
                Logs.add("[service] adresse invalide : " + e.getMessage());
                BridgeState.setStatus("Adresse de bague invalide");
            }
        } else {
            BridgeState.setStatus("Pont actif — en attente d'une bague");
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Logs.add("[service] destruction");
        handler.removeCallbacksAndMessages(null);
        simulate = false;
        BridgeState.simulating = false;
        if (ring != null) {
            ring.disconnect();
        }
        if (hrm != null) {
            hrm.disconnect();
        }
        if (peripheral != null) {
            peripheral.stop();
        }
        BridgeState.bridgeRunning = false;
        BridgeState.advertising = false;
        BridgeState.peripheralClients = 0;
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void stopBridge() {
        Logs.add("[service] arrêt demandé");
        simulate = false;
        handler.removeCallbacks(simulationTick);
        if (ring != null) {
            ring.stopHeartRateStream();
            ring.disconnect();
        }
        if (hrm != null) {
            hrm.disconnect();
        }
        if (peripheral != null) {
            peripheral.stop();
        }
        if (recorder != null) {
            recorder.stop();
        }
        BridgeState.recording = false;
        BridgeState.bridgeRunning = false;
        BridgeState.advertising = false;
        BridgeState.simulating = false;
        BridgeState.bpm = -1;
        BridgeState.source = "—";
        BridgeState.setStatus("Pont arrêté");
        updateNotification();
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    // ==================================================================
    // Callbacks bague
    // ==================================================================

    @Override
    public void onRingConnected(BluetoothDevice device) {
        BridgeState.ringConnected = true;
        BridgeState.ringName = device != null ? device.getName() : "";
        BridgeState.setStatus("Bague connectée");
        Logs.add("[service] bague connectée");
    }

    @Override
    public void onRingDisconnected() {
        BridgeState.ringConnected = false;
        Logs.add("[service] bague déconnectée");
        if (!simulate) {
            BridgeState.setStatus("Bague déconnectée — reconnexion automatique");
        }
    }

    @Override
    public void onHeartRate(int bpm) {
        lastBpm = bpm;
        if (recorder != null) {
            recorder.onHeartRate(bpm);
        }
        BridgeState.source = "bague";
        BridgeState.setBpm(bpm);
        if (peripheral != null) {
            peripheral.notifyHeartRate(bpm);
        }
        if (System.currentTimeMillis() - lastNotifUpdate > 1000L) {
            updateNotification();
        }
    }

    // ------------------------------------------------------------------
    // Callbacks capteur standard (0x180D)
    // ------------------------------------------------------------------

    @Override
    public void onHrmConnected(BluetoothDevice device) {
        BridgeState.ringConnected = true;
        try {
            BridgeState.ringName = device != null ? device.getName() : "";
        } catch (SecurityException ignored) {
        }
        BridgeState.setStatus("Capteur FC connecté");
        Logs.add("[service] capteur FC standard connecté");
    }

    @Override
    public void onHrmDisconnected() {
        BridgeState.ringConnected = false;
        if (!simulate) {
            BridgeState.setStatus("Capteur FC déconnecté");
        }
    }

    @Override
    public void onHrmHeartRate(int bpm) {
        lastBpm = bpm;
        if (recorder != null) {
            recorder.onHeartRate(bpm);
        }
        BridgeState.source = "capteur FC";
        BridgeState.setBpm(bpm);
        if (peripheral != null) {
            peripheral.notifyHeartRate(bpm);
        }
        if (System.currentTimeMillis() - lastNotifUpdate > 1000L) {
            updateNotification();
        }
    }

    @Override
    public void onHrmLog(String message) {
        Logs.add(message);
    }

    @Override
    public void onRingBattery(int levelPercent, boolean charging) {
        BridgeState.ringBattery = levelPercent;
        if (peripheral != null) {
            peripheral.notifyBattery(levelPercent);
        }
        Logs.add("[service] batterie bague : " + levelPercent + " %"
                + (charging ? " (en charge)" : ""));
    }

    @Override
    public void onRingLog(String message) {
        // déjà journalisé par RingBleClient
    }

    // ==================================================================
    // Callbacks périphérique GATT
    // ==================================================================

    @Override
    public void onPeripheralLog(String message) {
        // déjà journalisé par HrmPeripheral
    }

    @Override
    public void onAdvertisingStarted(boolean ok, String detail) {
        BridgeState.advertising = ok;
        Logs.add("[service] publicité BLE : " + (ok ? "active" : "inactive (" + detail + ")"));
        BridgeState.notifyListeners();
    }

    @Override
    public void onClientCountChanged(int count) {
        BridgeState.peripheralClients = count;
        if (count > 0) {
            BridgeState.setStatus("Connecté à " + count + " appli (Strava ?) — FC "
                    + (BridgeState.bpm > 0 ? BridgeState.bpm + " bpm" : "en attente"));
        }
        BridgeState.notifyListeners();
    }

    // ==================================================================
    // Notification + wake lock
    // ==================================================================

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID,
                        getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotification() {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, flags);

        String text = BridgeState.bpm > 0
                ? "FC " + BridgeState.bpm + " bpm — " + BridgeState.source
                        + " • " + BridgeState.peripheralClients + " appli connectée(s)"
                : getString(R.string.notif_text_idle);

        b.setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(getString(R.string.notif_title))
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi);
        return b.build();
    }

    private void updateNotification() {
        lastNotifUpdate = System.currentTimeMillis();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(NOTIF_ID, buildNotification());
            } catch (SecurityException ignored) {
            }
        }
    }

    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QRingBridge::bridge");
                wakeLock.setReferenceCounted(false);
            }
        }
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire();
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
}
