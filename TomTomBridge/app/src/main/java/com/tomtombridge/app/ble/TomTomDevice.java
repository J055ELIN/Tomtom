package com.tomtombridge.app.ble;

import android.bluetooth.BluetoothAdapter;
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
import android.util.Log;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.nio.ByteBuffer;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Connexion Bluetooth LE à une montre TomTom Sports.
 *
 * Implémentation originale du protocole observé dans l'application officielle
 * « TomTom Sports » 10.0.9 (classes com.tomtom.ble.*).
 *
 * Point crucial pour la connexion « dans la durée » : après l'acceptation du PIN,
 * l'application officielle exécute une série d'opérations sur le service
 * File Transfer — c'est elle qui fait sortir la montre de l'écran PIN et évite
 * qu'elle se déconnecte d'elle-même (~20 s). Séquence (WatchDevice) :
 *
 *   1. lire DEVICE_CAPABILITY (service Comms Setup, V2)
 *   2. lire Device Information (6 caractéristiques)
 *   3. SUPPRIMER le fichier « mastername » (type 2, n° 2)
 *   4. ENVOYER le fichier « mastername » (type 2, n° 2) contenant le nom
 *      Bluetooth du téléphone  (l'appli officielle saute les étapes réseau
 *      suivantes quand elle passe en arrière-plan : mastername = dernière étape
 *      obligatoire côté montre)
 *   5. régler l'heure (SET_TIME)
 *   6. activer les notifications de synchro -> état PRÊT, connexion maintenue.
 *
 * Types d'écriture GATT de l'application officielle :
 *   COMMAND / APP_VERSION / AUTH_TOKEN  -> WRITE_TYPE_SIGNED (2)
 *   TRANSFER_LENGTH / TRANSFER_PACKET / TRANSFER_BLOCK -> WRITE_TYPE_NO_RESPONSE (1)
 */
public class TomTomDevice extends BluetoothGattCallback {

    private static final String TAG = "TomTomDevice";

    // ------------------------------------------------------------------
    // Interface de notification vers l'interface utilisateur
    // ------------------------------------------------------------------
    public interface Listener {
        void onLog(String line);

        void onStatus(String status);

        /** La montre est connectée et prête (appairage terminé). */
        void onReady(boolean v2, DeviceInfo info);

        /** Demande de saisie du PIN affiché par la montre. */
        void onAuthPinRequested();

        /** PIN refusé par la montre : redemander. */
        void onAuthInvalid();

        void onDeviceInfo(DeviceInfo info);

        void onBattery(int percent);

        void onFileList(int fileType, List<Integer> numbers);

        void onFileReceived(int fileType, int number, String savedPath);

        void onTransferProgress(String text);

        void onError(String message);
    }

    public static class DeviceInfo {
        public String modelNumber = "";
        public String serialNumber = "";
        public String hardwareRevision = "";
        public String softwareRevision = "";
        public String manufacturerName = "";
        public String systemId = "";
        public String watchName = "";

        public String summary() {
            StringBuilder sb = new StringBuilder();
            sb.append("Nom: ").append(watchName.isEmpty() ? "?" : watchName);
            if (!modelNumber.isEmpty()) sb.append("\nModèle: ").append(modelNumber);
            if (!serialNumber.isEmpty()) sb.append("\nN° série: ").append(serialNumber);
            if (!softwareRevision.isEmpty()) sb.append("\nFirmware: ").append(softwareRevision);
            if (!hardwareRevision.isEmpty()) sb.append("\nHardware: ").append(hardwareRevision);
            if (!manufacturerName.isEmpty()) sb.append("\nFabriquant: ").append(manufacturerName);
            if (!systemId.isEmpty()) sb.append("\nSystemId: ").append(systemId);
            return sb.toString();
        }
    }

    // Opérations (file de transfert)
    private static final int OP_NONE = 0;
    private static final int OP_LIST = 1;
    private static final int OP_DOWNLOAD = 2;
    private static final int OP_DELETE = 3;
    private static final int OP_DELETE_MASTER = 4;
    private static final int OP_UPLOAD_MASTER = 5;

    private enum Xfer {
        IDLE, WAIT_CMD_RESPONSE, DELETE_WAIT_PACKET, DOWNLOAD_WAIT_LENGTH,
        DOWNLOAD_RECEIVING, LIST_RECEIVING, UPLOAD_SENDING, WAIT_COMPLETE
    }

    private final Context context;
    private final BluetoothDevice device;
    private final Listener listener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private BluetoothGatt gatt;
    private BluetoothGattService ftService;
    private BluetoothGattService commsService;
    private Runnable pendingOnWritten;
    private Runnable pendingNotifyDone;
    private Runnable pendingOnRead;

    private boolean isV2 = false;
    private boolean ready = false;
    private boolean authOk = false;
    private boolean userDisconnect = false;
    private String storedPin;
    private android.content.BroadcastReceiver bondReceiver;
    private boolean bondPending = false;

    private DeviceInfo info = new DeviceInfo();

    // --- file d'opérations GATT sérialisées --------------------------
    private final Object opLock = new Object();
    private final LinkedList<Runnable> opQueue = new LinkedList<>();
    private boolean opBusy = false;
    private boolean opCompleted = true;

    // --- état du transfert (réception) -------------------------------
    private Xfer xfer = Xfer.IDLE;
    private int pendingOp = OP_NONE;
    private int fileType;
    private int fileNumber;
    private int totalLength = -1;
    private int bytesReceived = 0;
    private int currentBlock = 0;
    private int blockRetries = 0;
    private byte[] blockBuf = new byte[TomTomProtocol.BLOCK_DATA_LENGTH + TomTomProtocol.CRC_SIZE];
    private int blockBufPos = 0;
    private BufferedOutputStream fileOut;
    private File currentFile;

    // --- liste de fichiers -------------------------------------------
    private int listCount = -1;
    private boolean firstListPacket = false;
    private final List<Integer> listNumbers = new ArrayList<>();

    // --- état du transfert (envoi / mastername) ----------------------
    private byte[] uploadData;
    private int uploadBlock = 0;          // bloc courant (0-based)
    private int uploadBlockRetries = 0;
    private final AtomicReference<Integer> uploadAck = new AtomicReference<>(null);
    private CountDownLatch uploadAckLatch;
    private volatile boolean uploadRunning = false;

    // --- machine d'appairage (handshake post-PIN) --------------------
    private int handshakeStep = 0;

    private final Runnable transferTimeout = new Runnable() {
        @Override
        public void run() {
            if (xfer != Xfer.IDLE) {
                log("TIMEOUT de l'opération en cours");
                fail("Opération expirée (la montre ne répond plus)");
            }
        }
    };

    private final Runnable opWatchdog = new Runnable() {
        @Override
        public void run() {
            synchronized (opLock) {
                if (opBusy) {
                    opCompleted = true;
                    opBusy = false;
                    pendingOnWritten = null;
                    pendingNotifyDone = null;
                    pendingOnRead = null;
                    log("Avertissement: opération GATT sans réponse, reprise de la file");
                    runNextLocked();
                }
            }
        }
    };

    private final Runnable reconnectTask = new Runnable() {
        @Override
        public void run() {
            log("Reconnexion automatique…");
            listener.onStatus("Reconnexion automatique…");
            connect(storedPin);
        }
    };

    public TomTomDevice(Context context, BluetoothDevice device, Listener listener) {
        this.context = context.getApplicationContext();
        this.device = device;
        this.listener = listener;
    }

    // ==================================================================
    // Cycle de vie
    // ==================================================================
    public void connect(String pin) {
        this.storedPin = pin;
        userDisconnect = false;
        ready = false;
        authOk = false;
        isV2 = false;
        xfer = Xfer.IDLE;
        pendingOp = OP_NONE;
        handshakeStep = 0;
        listener.onStatus("Connexion à " + device.getName() + " (" + device.getAddress() + ")…");
        log("connectGatt…");
        // Comme l'application officielle (BleDevice.connect -> initiateBonding) :
        // attendre le lien Bluetooth système avant d'ouvrir le GATT.
        if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
            listener.onStatus("Création du lien Bluetooth (bonding)…");
            waitForBondThenConnect();
        } else {
            openGatt();
        }
    }

    private void waitForBondThenConnect() {
        try {
            if (!device.createBond()) {
                log("createBond() a échoué — tentative de connexion directe");
                openGatt();
                return;
            }
        } catch (Exception e) {
            log("createBond: " + e.getMessage() + " — connexion directe");
            openGatt();
            return;
        }
        bondPending = true;
        bondReceiver = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(android.content.Context ctx, android.content.Intent intent) {
                String action = intent.getAction();
                if (!BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(action)) return;
                BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (d == null || !d.getAddress().equalsIgnoreCase(device.getAddress())) return;
                int state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, -1);
                if (state == BluetoothDevice.BOND_BONDED) {
                    log("Lien Bluetooth créé");
                    onBonded();
                } else if (state == BluetoothDevice.BOND_NONE) {
                    log("Bonding interrompu — connexion directe");
                    onBonded();
                }
            }
        };
        context.registerReceiver(bondReceiver,
                new android.content.IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED));
        // filet de sécurité : si le bonding ne se termine pas en 15 s, on connecte quand même
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (bondPending) {
                    log("Bonding trop long — ouverture de la connexion quand même");
                    onBonded();
                }
            }
        }, 15000);
    }

    private synchronized void onBonded() {
        if (!bondPending) return;
        bondPending = false;
        if (bondReceiver != null) {
            try {
                context.unregisterReceiver(bondReceiver);
            } catch (Exception ignored) {
            }
            bondReceiver = null;
        }
        openGatt();
    }

    private void openGatt() {
        if (userDisconnect) return;
        listener.onStatus("Connexion à " + device.getName() + "…");
        gatt = device.connectGatt(context, false, this);
    }

    public void disconnect() {
        userDisconnect = true;
        bondPending = false;
        if (bondReceiver != null) {
            try {
                context.unregisterReceiver(bondReceiver);
            } catch (Exception ignored) {
            }
            bondReceiver = null;
        }
        stopTransferTimeout();
        mainHandler.removeCallbacks(reconnectTask);
        stopUpload();
        if (gatt != null) {
            try {
                gatt.disconnect();
                gatt.close();
            } catch (Exception ignored) {
            }
            gatt = null;
        }
        ready = false;
        authOk = false;
        xfer = Xfer.IDLE;
        pendingOp = OP_NONE;
        closeFileOut();
        listener.onStatus("Déconnecté");
        log("Déconnexion");
    }

    /** PIN saisi par l'utilisateur (affiché par la montre). */
    public void sendPin(String pin) {
        this.storedPin = pin;
        if (authOk) {
            log("Déjà authentifié");
            return;
        }
        sendAuthPin(pin);
    }

    // ==================================================================
    // Callbacks GATT
    // ==================================================================
    @Override
    public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
            log("Connecté (status=" + status + "), découverte des services…");
            listener.onStatus("Connecté — découverte des services…");
            g.discoverServices();
        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
            log("Déconnecté par la montre (status=" + status + ")");
            stopTransferTimeout();
            stopUpload();
            closeFileOut();
            if (gatt != null) {
                gatt.close();
                gatt = null;
            }
            boolean wasReady = ready;
            ready = false;
            authOk = false;
            xfer = Xfer.IDLE;
            pendingOp = OP_NONE;
            listener.onStatus("Déconnecté");
            if (wasReady && !userDisconnect) {
                log("La montre s'est déconnectée — reconnexion dans 3 s…");
                mainHandler.postDelayed(reconnectTask, 3000);
            }
        }
    }

    @Override
    public void onServicesDiscovered(BluetoothGatt g, int status) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            listener.onError("Échec de la découverte des services (status " + status + ")");
            return;
        }
        commsService = g.getService(TomTomProtocol.SERVICE_COMMS_SETUP);
        BluetoothGattService ft1 = g.getService(TomTomProtocol.SERVICE_FILE_TRANSFER_V1);
        BluetoothGattService ft2 = g.getService(TomTomProtocol.SERVICE_FILE_TRANSFER_V2);
        isV2 = commsService != null;
        ftService = isV2 ? ft2 : ft1;
        if (ftService == null) ftService = ft2 != null ? ft2 : ft1;

        log("Services découverts: CommsSetup=" + (commsService != null) +
                " FileTransferV1=" + (ft1 != null) + " FileTransferV2=" + (ft2 != null));
        listener.onStatus(isV2 ? "Montre V2 détectée" : "Montre V1 détectée");

        if (isV2) {
            startAuth();
        } else {
            // V1 : pas d'authentification, enchaînement direct du handshake
            runHandshake();
        }
    }

    @Override
    public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
        try {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                UUID u = ch.getUuid();
                if (u.equals(TomTomProtocol.CHAR_DEVICE_CAPABILITY)) {
                    log("Capacités de l'appareil: " + hex(ch.getValue()));
                } else {
                    String s = ch.getStringValue(0);
                    if (u.equals(TomTomProtocol.CHAR_MODEL_NUMBER)) info.modelNumber = clean(s);
                    else if (u.equals(TomTomProtocol.CHAR_SERIAL_NUMBER)) info.serialNumber = clean(s);
                    else if (u.equals(TomTomProtocol.CHAR_HARDWARE_REVISION)) info.hardwareRevision = clean(s);
                    else if (u.equals(TomTomProtocol.CHAR_SOFTWARE_REVISION)) info.softwareRevision = clean(s);
                    else if (u.equals(TomTomProtocol.CHAR_MANUFACTURER_NAME)) info.manufacturerName = clean(s);
                    else if (u.equals(TomTomProtocol.CHAR_SYSTEM_ID)) info.systemId = clean(s);
                    else if (u.equals(TomTomProtocol.CHAR_BATTERY_LEVEL)) {
                        byte[] v = ch.getValue();
                        if (v != null && v.length > 0) listener.onBattery(v[0] & 0xFF);
                    }
                }
            }
        } catch (Exception e) {
            log("Lecture impossible: " + e.getMessage());
        } finally {
            Runnable r;
            synchronized (opLock) {
                r = pendingOnRead;
                pendingOnRead = null;
            }
            if (r != null) r.run();
            opDone();
        }
    }

    @Override
    public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            log("Écriture échouée " + ch.getUuid() + " status=" + status);
        }
        Runnable w;
        synchronized (opLock) {
            w = pendingOnWritten;
            pendingOnWritten = null;
        }
        if (w != null) w.run();
        opDone();
    }

    @Override
    public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
        Runnable d;
        synchronized (opLock) {
            d = pendingNotifyDone;
            pendingNotifyDone = null;
        }
        if (d != null) d.run();
        opDone();
    }

    @Override
    public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
        byte[] value = ch.getValue();
        if (value == null) return;
        UUID u = ch.getUuid();

        if (u.equals(TomTomProtocol.CHAR_AUTH_TOKEN)) {
            handleAuthResponse(value);
        } else if (u.equals(TomTomProtocol.CHAR_COMMAND)) {
            handleCommandChanged(value);
        } else if (u.equals(TomTomProtocol.CHAR_TRANSFER_LENGTH)) {
            handleLengthChanged(value);
        } else if (u.equals(TomTomProtocol.CHAR_TRANSFER_PACKET)) {
            handlePacketChanged(value);
        } else if (u.equals(TomTomProtocol.CHAR_TRANSFER_BLOCK)) {
            handleBlockChanged(value);
        } else if (u.equals(TomTomProtocol.CHAR_SYNC)) {
            log("SYNC (UIProd): " + hex(value));
        } else {
            log("Notification " + u + ": " + hex(value));
        }
    }

    // ==================================================================
    // Appairage (V2)
    // ==================================================================
    private void startAuth() {
        if (commsService == null) return;
        log("Activation des notifications d'authentification…");
        enableNotify(commsService, TomTomProtocol.CHAR_AUTH_TOKEN, new Runnable() {
            @Override
            public void run() {
                enableNotify(commsService, TomTomProtocol.CHAR_SYNC, new Runnable() {
                    @Override
                    public void run() {
                        listener.onStatus("Appairage — la montre affiche un PIN");
                        // Toujours demander le PIN (pré-rempli avec le dernier connu) :
                        // une montre ré-appairée affiche un NOUVEAU code.
                        listener.onAuthPinRequested();
                    }
                });
            }
        });
    }

    private void sendAuthPin(String pin) {
        try {
            final int pinInt = Integer.parseInt(pin.trim());
            log("Écriture APP_VERSION…");
            write(commsService, TomTomProtocol.CHAR_APP_VERSION,
                    TomTomProtocol.appVersionPacket(Build.VERSION.SDK_INT, 1),
                    null, TomTomProtocol.WT_SIGNED);
            mainHandler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    log("Écriture du PIN (" + pinInt + ") sur AUTH_TOKEN…");
                    write(commsService, TomTomProtocol.CHAR_AUTH_TOKEN,
                            TomTomProtocol.int32le(pinInt), null, TomTomProtocol.WT_SIGNED);
                }
            }, 200);
        } catch (NumberFormatException e) {
            listener.onError("PIN invalide: " + pin);
            listener.onAuthPinRequested();
        }
    }

    private void handleAuthResponse(byte[] value) {
        if (value.length == 0) return;
        int code = value[0] & 0xFF;
        log("Réponse AUTH_TOKEN: " + code + " (" + hex(value) + ")");
        switch (code) {
            case TomTomProtocol.AUTH_RESPONSE_VALID:
                authOk = true;
                listener.onStatus("PIN accepté — échange de configuration…");
                runHandshake();
                break;
            case TomTomProtocol.AUTH_RESPONSE_RECONNECT:
                authOk = true;
                listener.onStatus("Reconnexion acceptée");
                runHandshake();
                break;
            case TomTomProtocol.AUTH_RESPONSE_INVALID:
            default:
                listener.onAuthInvalid();
                break;
        }
    }

    // ==================================================================
    // Handshake post-PIN (WatchDevice transfer state machine, partie
    // obligatoire côté montre)
    // ==================================================================
    private void runHandshake() {
        handshakeStep = 0;
        nextHandshakeStep();
    }

    private void nextHandshakeStep() {
        if (!authOk && isV2) return;
        switch (handshakeStep++) {
            case 0: // notifications de transfert (nécessaires avant toute opération)
                enableTransferNotifications(new Runnable() {
                    @Override
                    public void run() {
                        nextHandshakeStep();
                    }
                });
                break;
            case 1: // lecture des capacités (V2)
                if (isV2 && commsService != null &&
                        commsService.getCharacteristic(TomTomProtocol.CHAR_DEVICE_CAPABILITY) != null) {
                    log("Lecture des capacités de l'appareil…");
                    readCharacteristic(commsService.getCharacteristic(TomTomProtocol.CHAR_DEVICE_CAPABILITY),
                            new Runnable() {
                                @Override
                                public void run() {
                                    nextHandshakeStep();
                                }
                            });
                } else {
                    nextHandshakeStep();
                }
                break;
            case 2: // lecture des informations (6 caractéristiques)
                readDeviceInfo(new Runnable() {
                    @Override
                    public void run() {
                        nextHandshakeStep();
                    }
                });
                break;
            case 3: // suppression de l'ancien « mastername »
                log("Suppression de l'ancien master name…");
                pendingOp = OP_DELETE_MASTER;
                xfer = Xfer.WAIT_CMD_RESPONSE;
                write(ftService, TomTomProtocol.CHAR_COMMAND,
                        TomTomProtocol.commandPacket(TomTomProtocol.CMD_DELETE_FILE,
                                TomTomProtocol.TYPE_MASTER_NAME, TomTomProtocol.NUM_MASTER_NAME),
                        null, TomTomProtocol.WT_SIGNED);
                startTransferTimeout();
                break;
            case 4: // envoi du nouveau « mastername »
                log("Envoi du master name (nom du téléphone)…");
                pendingOp = OP_UPLOAD_MASTER;
                xfer = Xfer.WAIT_CMD_RESPONSE;
                write(ftService, TomTomProtocol.CHAR_COMMAND,
                        TomTomProtocol.commandPacket(TomTomProtocol.CMD_SEND_TO_WATCH,
                                TomTomProtocol.TYPE_MASTER_NAME, TomTomProtocol.NUM_MASTER_NAME),
                        null, TomTomProtocol.WT_SIGNED);
                startTransferTimeout();
                break;
            case 5: // réglage de l'heure
                log("Réglage de l'heure de la montre…");
                write(ftService, TomTomProtocol.CHAR_COMMAND,
                        TomTomProtocol.setTimePacket(), new Runnable() {
                            @Override
                            public void run() {
                                nextHandshakeStep();
                            }
                        }, TomTomProtocol.WT_SIGNED);
                break;
            default: // terminé
                listener.onTransferProgress("Appairage terminé");
                becomeReady();
                break;
        }
    }

    private void becomeReady() {
        if (ready) return;
        ready = true;
        info.watchName = device.getName();
        listener.onStatus("Prêt ✓ — connexion maintenue (" +
                (isV2 ? "protocole V2" : "protocole V1") + ")");
        listener.onReady(isV2, info);
    }

    // ==================================================================
    // Opérations exposées à l'interface
    // ==================================================================
    public boolean isReady() {
        return ready;
    }

    public boolean isV2() {
        return isV2;
    }

    public String getDeviceName() {
        return device.getName();
    }

    public String getDeviceAddress() {
        return device.getAddress();
    }

    public void requestInfo() {
        readDeviceInfo(null);
    }

    public void requestBattery() {
        if (gatt == null) return;
        BluetoothGattService battery = gatt.getService(TomTomProtocol.SERVICE_BATTERY);
        if (battery == null) {
            listener.onError("Service batterie absent");
            return;
        }
        BluetoothGattCharacteristic c = battery.getCharacteristic(TomTomProtocol.CHAR_BATTERY_LEVEL);
        if (c == null) {
            listener.onError("Caractéristique batterie absente");
            return;
        }
        readCharacteristic(c, null);
    }

    public void setTime() {
        log("Envoi SET_TIME à la montre…");
        write(ftService, TomTomProtocol.CHAR_COMMAND, TomTomProtocol.setTimePacket(), null,
                TomTomProtocol.WT_SIGNED);
    }

    public void listFiles(int type) {
        if (!startOperation(OP_LIST)) return;
        fileType = type;
        listCount = -1;
        firstListPacket = false;
        listNumbers.clear();
        xfer = Xfer.WAIT_CMD_RESPONSE;
        log("LIST_FILES type=" + TomTomProtocol.fileTypeName(type));
        write(ftService, TomTomProtocol.CHAR_COMMAND,
                TomTomProtocol.commandPacket(TomTomProtocol.CMD_LIST_FILES, type, 0),
                null, TomTomProtocol.WT_SIGNED);
        startTransferTimeout();
    }

    public void downloadFile(int type, int number, String saveDir) {
        if (!startOperation(OP_DOWNLOAD)) return;
        fileType = type;
        fileNumber = number;
        totalLength = -1;
        bytesReceived = 0;
        currentBlock = 0;
        blockRetries = 0;
        blockBufPos = 0;

        File dir = new File(saveDir);
        if (!dir.exists() && !dir.mkdirs()) {
            fail("Impossible de créer " + saveDir);
            return;
        }
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.UK).format(new Date());
        currentFile = new File(dir, String.format(Locale.UK, "%04X_%04X_%s%s",
                type, number, stamp, TomTomProtocol.fileExtension(type)));
        try {
            fileOut = new BufferedOutputStream(new FileOutputStream(currentFile));
        } catch (IOException e) {
            fail("Erreur création fichier: " + e.getMessage());
            return;
        }
        xfer = Xfer.WAIT_CMD_RESPONSE;
        log("RECEIVE_FROM_WATCH type=" + TomTomProtocol.fileTypeName(type) +
                " n°=" + String.format(Locale.UK, "%04X", number));
        write(ftService, TomTomProtocol.CHAR_COMMAND,
                TomTomProtocol.commandPacket(TomTomProtocol.CMD_RECEIVE_FROM_WATCH, type, number),
                null, TomTomProtocol.WT_SIGNED);
        startTransferTimeout();
    }

    public void deleteFile(int type, int number) {
        if (!startOperation(OP_DELETE)) return;
        fileType = type;
        fileNumber = number;
        xfer = Xfer.WAIT_CMD_RESPONSE;
        log("DELETE_FILE type=" + TomTomProtocol.fileTypeName(type) +
                " n°=" + String.format(Locale.UK, "%04X", number));
        write(ftService, TomTomProtocol.CHAR_COMMAND,
                TomTomProtocol.commandPacket(TomTomProtocol.CMD_DELETE_FILE, type, number),
                null, TomTomProtocol.WT_SIGNED);
        startTransferTimeout();
    }

    // ==================================================================
    // Machine à états
    // ==================================================================
    private boolean startOperation(int op) {
        if (!ready) {
            listener.onError("Montre non prête");
            return false;
        }
        if (xfer != Xfer.IDLE) {
            listener.onError("Une opération est déjà en cours");
            return false;
        }
        pendingOp = op;
        return true;
    }

    private void handleCommandChanged(byte[] value) {
        if (value.length < 1) return;
        int code = value[0] & 0xFF;
        log("Notification COMMAND: " + code + " (" + hex(value) + ")");

        if (xfer == Xfer.WAIT_CMD_RESPONSE) {
            if (code == TomTomProtocol.COMMAND_RESPONSE_OK) {
                switch (pendingOp) {
                    case OP_LIST:
                        xfer = Xfer.LIST_RECEIVING;
                        break;
                    case OP_DOWNLOAD:
                        xfer = Xfer.DOWNLOAD_WAIT_LENGTH;
                        log("Commande acceptée, attente de la taille…");
                        break;
                    case OP_DELETE:
                    case OP_DELETE_MASTER:
                        // La suppression n'est pas terminée : la montre enverra un
                        // paquet TRANSFER_PACKET (0/2 = terminé, 3 = en cours, 1 = échec)
                        // puis une notification COMMAND finale. Attendre.
                        xfer = Xfer.DELETE_WAIT_PACKET;
                        log("Suppression acceptée — attente de la confirmation…");
                        break;
                    case OP_UPLOAD_MASTER:
                        xfer = Xfer.UPLOAD_SENDING;
                        startUpload();
                        break;
                    default:
                        fail("Réponse inattendue");
                        break;
                }
            } else if (code == TomTomProtocol.COMMAND_RESPONSE_FILE_NOT_FOUND) {
                boolean wasMaster = pendingOp == OP_DELETE_MASTER;
                if (pendingOp == OP_DELETE || wasMaster) {
                    completeOp(wasMaster ? "ok" : "Fichier déjà absent");
                    if (wasMaster) nextHandshakeStep();
                } else if (pendingOp == OP_UPLOAD_MASTER) {
                    fail("La montre a refusé l'envoi du master name (réponse 0)");
                } else {
                    fail("Fichier introuvable sur la montre");
                }
            } else {
                fail("Réponse commande inattendue: " + code);
            }
        } else if (xfer == Xfer.WAIT_COMPLETE) {
            // Notification COMMAND finale qui clôt la commande en cours
            if (pendingOp == OP_UPLOAD_MASTER) {
                completeUpload();
            } else if (pendingOp == OP_DELETE_MASTER) {
                completeOp("ok");
                nextHandshakeStep();
            } else if (pendingOp == OP_DELETE) {
                completeOp("Fichier supprimé");
            } else if (pendingOp == OP_LIST) {
                completeOp("Liste reçue: " + listNumbers.size() + " fichiers");
                listener.onFileList(fileType, new ArrayList<>(listNumbers));
            } else if (pendingOp == OP_DOWNLOAD) {
                completeTransfer();
            } else {
                completeOp("ok");
            }
        } else {
            log("Notification COMMAND hors séquence (état " + xfer + ")");
        }
    }

    private void handleLengthChanged(byte[] value) {
        if (xfer != Xfer.DOWNLOAD_WAIT_LENGTH) return;
        if (value.length < 4) {
            fail("Taille invalide");
            return;
        }
        totalLength = TomTomProtocol.leToInt(value, 0);
        log("Taille du fichier: " + totalLength + " octets");
        if (totalLength == 0) {
            fail("Fichier inexistant (taille 0)");
            return;
        }
        xfer = Xfer.DOWNLOAD_RECEIVING;
        bytesReceived = 0;
        currentBlock = 0;
        blockRetries = 0;
        blockBufPos = 0;
        log("Réception des paquets…");
    }

    private void handlePacketChanged(byte[] value) {
        if (xfer == Xfer.LIST_RECEIVING) {
            listPacket(value);
            return;
        }
        if (xfer == Xfer.DELETE_WAIT_PACKET) {
            deleteConfirmPacket(value);
            return;
        }
        if (xfer != Xfer.DOWNLOAD_RECEIVING) return;

        restartTransferTimeout();

        for (byte b : value) {
            if (blockBufPos < blockBuf.length) blockBuf[blockBufPos++] = b;
        }
        bytesReceived += value.length;

        boolean blockFull = blockBufPos >= TomTomProtocol.BLOCK_DATA_LENGTH + TomTomProtocol.CRC_SIZE;
        boolean fileDone = totalLength > 0 && bytesReceived >= totalLength + TomTomProtocol.CRC_SIZE;

        if (blockFull || fileDone) {
            int dataLen = blockBufPos - TomTomProtocol.CRC_SIZE;
            int crcExpected = (blockBuf[dataLen] & 0xFF) | ((blockBuf[dataLen + 1] & 0xFF) << 8);
            int crcActual = Crc16.crc16(blockBuf, 0, dataLen);

            if (crcExpected == crcActual) {
                try {
                    fileOut.write(blockBuf, 0, dataLen);
                } catch (IOException e) {
                    fail("Erreur écriture disque: " + e.getMessage());
                    return;
                }
                currentBlock++;
                log("Bloc " + currentBlock + " OK (" + dataLen + " octets, CRC vérifié)");
                writeBlock(currentBlock);
                if (fileDone) {
                    xfer = Xfer.WAIT_COMPLETE;
                    log("Tous les blocs reçus — attente de la confirmation finale…");
                } else {
                    blockBufPos = 0;
                }
            } else {
                log("CRC invalide sur le bloc (attendu " + crcExpected +
                        ", calculé " + crcActual + ") — renvoi du bloc");
                blockRetries++;
                if (blockRetries > 3) {
                    fail("Trop d'erreurs CRC");
                    return;
                }
                bytesReceived -= dataLen;
                blockBufPos = 0;
                writeBlock(-1);
            }
        } else {
            if (bytesReceived > 0 && bytesReceived % 2560 == 0) {
                listener.onTransferProgress("Réception: " + bytesReceived + " / " + totalLength + " octets");
            }
        }
    }

    private void handleBlockChanged(byte[] value) {
        if (xfer == Xfer.UPLOAD_SENDING && value.length >= 4) {
            int ack = TomTomProtocol.leToInt(value, 0);
            log("Acquittement BLOCK: " + ack);
            uploadAck.set(ack);
            if (uploadAckLatch != null) uploadAckLatch.countDown();
        } else {
            log("Notification BLOCK (hors upload): " + hex(value));
        }
    }

    /**
     * Paquet de confirmation de suppression (3 octets, officiel
     * deleteTransferPacketUpdated) :
     *   [0] ou [2] = suppression terminée -> attendre la COMMAND finale
     *   [1] = échec de la suppression
     *   [3, durLo, durHi] = progression (durée estimée en secondes)
     */
    private void deleteConfirmPacket(byte[] value) {
        if (value.length < 1) return;
        restartTransferTimeout();
        int status = value[0] & 0xFF;
        switch (status) {
            case 0:
            case 2:
                log("Suppression confirmée par la montre — attente de la fin de commande…");
                xfer = Xfer.WAIT_COMPLETE;
                break;
            case 1:
                fail("La montre signale un échec de suppression");
                break;
            case 3:
                int seconds = 0;
                if (value.length >= 3) {
                    seconds = (value[1] & 0xFF) | ((value[2] & 0xFF) << 8);
                }
                log("Suppression en cours (~" + seconds + " s)…");
                break;
            default:
                log("Réponse de suppression inattendue: " + status);
                break;
        }
    }

    private void listPacket(byte[] value) {
        restartTransferTimeout();
        int start = 0;
        if (!firstListPacket) {
            if (value.length < 2) return;
            listCount = (value[0] & 0xFF) | ((value[1] & 0xFF) << 8);
            firstListPacket = true;
            start = 2;
            log("Nombre de fichiers: " + listCount);
        }
        for (int i = start; i + 1 < value.length; i += 2) {
            listNumbers.add((value[i] & 0xFF) | ((value[i + 1] & 0xFF) << 8));
        }
        if (listNumbers.size() >= listCount) {
            // comme l'officiel : attendre la notification COMMAND finale
            log("Liste complète (" + listNumbers.size() + " fichiers) — attente de la fin de commande…");
            xfer = Xfer.WAIT_COMPLETE;
        }
    }

    // ==================================================================
    // Envoi de fichier (upload — « mastername » et, à terme, notifications)
    // ==================================================================
    private void startUpload() {
        String masterName;
        try {
            masterName = BluetoothAdapter.getDefaultAdapter() != null
                    ? BluetoothAdapter.getDefaultAdapter().getName() : null;
        } catch (Exception e) {
            masterName = null;
        }
        if (masterName == null || masterName.isEmpty()) masterName = "TomTom Bridge";
        uploadData = masterName.getBytes();
        uploadBlock = 0;
        uploadBlockRetries = 0;
        log("Envoi du fichier mastername (" + uploadData.length + " octets : \"" +
                masterName + "\")…");
        listener.onTransferProgress("Envoi master name: 0 / " + uploadData.length);

        write(ftService, TomTomProtocol.CHAR_TRANSFER_LENGTH,
                TomTomProtocol.int32le(uploadData.length), new Runnable() {
                    @Override
                    public void run() {
                        uploadRunning = true;
                        Thread t = new Thread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    while (uploadRunning) {
                                        if (!sendNextUploadBlock()) break;
                                    }
                                } catch (Exception e) {
                                    log("Upload interrompu: " + e.getMessage());
                                    fail("Échec de l'envoi du master name");
                                }
                            }
                        }, "tomtom-upload");
                        t.start();
                    }
                }, TomTomProtocol.WT_NO_RESPONSE);
    }

    /**
     * Envoie un bloc (5118 octets de données max par bloc, paquets de 20 octets,
     * CRC-16 en fin de bloc) puis attend son acquittement (TRANSFER_BLOCK).
     * Algorithme identique à AbstractFileTransferGattService.sendNextPacketAfterDelay.
     * Retourne false quand le transfert est terminé ou a échoué.
     */
    private boolean sendNextUploadBlock() {
        final int blockDataCap = 5118; // 255 × 20 + 18
        int blockStart = uploadBlock * blockDataCap;
        int blockLen = Math.min(blockDataCap, uploadData.length - blockStart);
        if (blockLen <= 0) return false;

        int offset = blockStart;
        int packetCount = 0;
        boolean blockEndSent = false;

        while (uploadRunning && !blockEndSent) {
            int remaining = blockLen - (offset - blockStart);
            int readSize;
            boolean append2; // ajouter les 2 octets CRC au paquet
            boolean append1; // ajouter 1 octet CRC puis envoyer le 2e séparément

            if (packetCount == 255) {
                // dernier paquet d'un bloc complet
                readSize = Math.min(18, remaining);
                append2 = true;
                append1 = false;
                blockEndSent = true;
            } else if (remaining > 19) {
                readSize = 20;
                append2 = false;
                append1 = false;
            } else if (remaining > 18) { // == 19
                readSize = 19;
                append2 = false;
                append1 = true;
                blockEndSent = true;
            } else {
                // fin du fichier (ou fin de bloc) : dernières données + CRC
                readSize = remaining;
                append2 = true;
                append1 = false;
                blockEndSent = true;
            }

            byte[] pkt;
            if (append2 || append1) {
                byte[] crc = Crc16.crc16Bytes(uploadData, blockStart, offset - blockStart + readSize);
                byte[] data = Arrays.copyOfRange(uploadData, offset, offset + readSize);
                ByteBuffer bb = ByteBuffer.allocate(readSize + (append2 ? 2 : 1));
                bb.put(data);
                bb.put(crc, 0, append2 ? 2 : 1);
                pkt = bb.array();
            } else {
                pkt = Arrays.copyOfRange(uploadData, offset, offset + readSize);
            }
            writeDirect(TomTomProtocol.CHAR_TRANSFER_PACKET, pkt);
            sleep(30);
            offset += readSize;
            packetCount++;

            if (append1) {
                // dernier octet CRC dans un paquet séparé
                byte[] crc = Crc16.crc16Bytes(uploadData, blockStart, offset - blockStart);
                writeDirect(TomTomProtocol.CHAR_TRANSFER_PACKET, new byte[]{crc[1]});
                sleep(30);
            }

            if (packetCount == 256) break; // bloc complet envoyé
        }

        // attente de l'acquittement BLOCK (n° du prochain bloc, ou -1 pour renvoi)
        uploadAck.set(null);
        uploadAckLatch = new CountDownLatch(1);
        int ack;
        try {
            uploadAckLatch.await(10, TimeUnit.SECONDS);
            Integer a = uploadAck.get();
            ack = a == null ? -2 : a;
        } catch (InterruptedException e) {
            ack = -2;
        }
        log("Bloc " + (uploadBlock + 1) + " envoyé, acquittement: " + ack);

        if (ack == 0) {
            fail("La montre a refusé le fichier (acquittement 0)");
            return false;
        }
        if (ack == -1) {
            uploadBlockRetries++;
            if (uploadBlockRetries > 3) {
                fail("Trop de renvois de bloc");
                return false;
            }
            log("Renvoi du bloc " + (uploadBlock + 1) + "…");
            return true; // renvoie le même bloc
        }
        if (ack == -2) {
            fail("Pas d'acquittement de la montre (timeout)");
            return false;
        }
        uploadBlockRetries = 0;
        uploadBlock++;
        listener.onTransferProgress("Envoi master name: " +
                Math.min(uploadBlock * blockDataCap, uploadData.length) +
                " / " + uploadData.length);

        if (uploadBlock * blockDataCap >= uploadData.length) {
            // tous les octets envoyés et le dernier bloc acquitté :
            // la montre notifie alors COMMAND 0x01 (fin de commande)
            log("Tous les blocs envoyés — attente de la confirmation finale…");
            xfer = Xfer.WAIT_COMPLETE;
            uploadRunning = false;
            return false;
        }
        return true;
    }

    private void completeUpload() {
        stopTransferTimeout();
        uploadRunning = false;
        xfer = Xfer.IDLE;
        pendingOp = OP_NONE;
        log("Master name envoyé avec succès ✓");
        listener.onTransferProgress("Master name envoyé ✓");
        nextHandshakeStep();
    }

    /** Écriture directe (paquets de données, sans callback). */
    private void writeDirect(UUID charUuid, byte[] data) {
        if (gatt == null || ftService == null) return;
        BluetoothGattCharacteristic c = ftService.getCharacteristic(charUuid);
        if (c == null) return;
        c.setWriteType(TomTomProtocol.WT_NO_RESPONSE);
        c.setValue(data);
        try {
            gatt.writeCharacteristic(c);
        } catch (Exception e) {
            log("Écriture directe échouée: " + e.getMessage());
        }
    }

    private void stopUpload() {
        uploadRunning = false;
        if (uploadAckLatch != null) uploadAckLatch.countDown();
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
        }
    }

    // ==================================================================
    // Fin d'opération / erreurs
    // ==================================================================
    private void completeTransfer() {
        stopTransferTimeout();
        closeFileOut();
        xfer = Xfer.IDLE;
        pendingOp = OP_NONE;
        log("Transfert terminé: " + currentFile.getName() + " (" +
                (currentFile != null ? currentFile.length() : 0) + " octets)");
        listener.onTransferProgress("Terminé");
        listener.onFileReceived(fileType, fileNumber,
                currentFile != null ? currentFile.getAbsolutePath() : "");
        currentFile = null;
    }

    private void completeOp(String message) {
        stopTransferTimeout();
        xfer = Xfer.IDLE;
        pendingOp = OP_NONE;
        log(message);
    }

    private void fail(String message) {
        stopTransferTimeout();
        stopUpload();
        closeFileOut();
        if (currentFile != null && currentFile.exists()) {
            currentFile.delete();
        }
        currentFile = null;
        xfer = Xfer.IDLE;
        pendingOp = OP_NONE;
        listener.onError(message);
    }

    private void closeFileOut() {
        if (fileOut != null) {
            try {
                fileOut.flush();
                fileOut.close();
            } catch (IOException ignored) {
            }
            fileOut = null;
        }
    }

    // ==================================================================
    // File d'opérations GATT
    // ==================================================================
    private void enqueue(Runnable op) {
        synchronized (opLock) {
            opQueue.add(op);
            if (!opBusy) runNextLocked();
        }
    }

    private void runNextLocked() {
        if (opBusy) return;
        Runnable op = opQueue.poll();
        if (op == null) return;
        opBusy = true;
        opCompleted = false;
        mainHandler.postDelayed(opWatchdog, 8000);
        op.run();
    }

    /** Termine l'opération GATT courante (idempotent). */
    private void opDone() {
        synchronized (opLock) {
            if (opCompleted) return;
            opCompleted = true;
            mainHandler.removeCallbacks(opWatchdog);
            opBusy = false;
            runNextLocked();
        }
    }

    /**
     * Écrit une caractéristique avec le type d'écriture explicite.
     * Le callback onWritten est appelé après l'écriture (ou sa réception).
     */
    private void write(final BluetoothGattService service, final UUID charUuid,
                       final byte[] data, final Runnable onWritten, final int writeType) {
        enqueue(new Runnable() {
            @Override
            public void run() {
                BluetoothGattCharacteristic c = service.getCharacteristic(charUuid);
                if (c == null || gatt == null) {
                    log("Caractéristique absente: " + charUuid);
                    opDone();
                    return;
                }
                int wt = writeType;
                if (wt == TomTomProtocol.WT_SIGNED) {
                    // si la caractéristique ne supporte pas l'écriture signée,
                    // repli sur l'écriture avec réponse
                    int props = c.getProperties();
                    if ((props & BluetoothGattCharacteristic.PROPERTY_SIGNED_WRITE) == 0) {
                        wt = TomTomProtocol.WT_DEFAULT;
                    }
                }
                c.setWriteType(wt);
                c.setValue(data);
                synchronized (opLock) {
                    pendingOnWritten = (wt == TomTomProtocol.WT_DEFAULT ||
                            wt == TomTomProtocol.WT_SIGNED) ? onWritten : null;
                }
                boolean ok = gatt.writeCharacteristic(c);
                if (!ok) {
                    synchronized (opLock) {
                        pendingOnWritten = null;
                    }
                    log("writeCharacteristic refusé: " + charUuid);
                    opDone();
                    return;
                }
                if (wt == TomTomProtocol.WT_NO_RESPONSE) {
                    mainHandler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            if (onWritten != null) onWritten.run();
                            opDone();
                        }
                    }, 150);
                }
                // avec réponse : onCharacteristicWrite() appellera onWritten + opDone()
            }
        });
    }

    private void readCharacteristic(final BluetoothGattCharacteristic c, final Runnable onDone) {
        enqueue(new Runnable() {
            @Override
            public void run() {
                synchronized (opLock) {
                    pendingOnRead = onDone;
                }
                if (gatt == null || !gatt.readCharacteristic(c)) {
                    synchronized (opLock) {
                        pendingOnRead = null;
                    }
                    log("readCharacteristic refusé: " + c.getUuid());
                    opDone();
                }
            }
        });
    }

    private void writeBlock(int blockNumber) {
        write(ftService, TomTomProtocol.CHAR_TRANSFER_BLOCK,
                TomTomProtocol.int32le(blockNumber), null, TomTomProtocol.WT_NO_RESPONSE);
    }

    private void enableNotify(final BluetoothGattService service, final UUID charUuid,
                              final Runnable onDone) {
        enqueue(new Runnable() {
            @Override
            public void run() {
                BluetoothGattCharacteristic c = service.getCharacteristic(charUuid);
                if (c == null) {
                    log("Notification impossible (caractéristique absente): " + charUuid);
                    opDone();
                    return;
                }
                if (gatt == null) {
                    opDone();
                    return;
                }
                gatt.setCharacteristicNotification(c, true);
                BluetoothGattDescriptor d = c.getDescriptor(TomTomProtocol.CCCD);
                if (d == null) {
                    log("Pas de CCCD pour " + charUuid);
                    opDone();
                    return;
                }
                d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                synchronized (opLock) {
                    pendingNotifyDone = onDone;
                }
                if (!gatt.writeDescriptor(d)) {
                    synchronized (opLock) {
                        pendingNotifyDone = null;
                    }
                    log("Écriture CCCD refusée: " + charUuid);
                    opDone();
                    return;
                }
                // onDescriptorWrite() appellera onDone + opDone()
            }
        });
    }

    private void enableTransferNotifications(final Runnable onDone) {
        if (ftService == null) {
            if (onDone != null) onDone.run();
            return;
        }
        log("Activation des notifications de transfert…");
        enableNotify(ftService, TomTomProtocol.CHAR_COMMAND, new Runnable() {
            @Override
            public void run() {
                enableNotify(ftService, TomTomProtocol.CHAR_TRANSFER_LENGTH, new Runnable() {
                    @Override
                    public void run() {
                        enableNotify(ftService, TomTomProtocol.CHAR_TRANSFER_PACKET, new Runnable() {
                            @Override
                            public void run() {
                                enableNotify(ftService, TomTomProtocol.CHAR_TRANSFER_BLOCK, new Runnable() {
                                    @Override
                                    public void run() {
                                        log("Notifications de transfert actives");
                                        if (onDone != null) onDone.run();
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    // ==================================================================
    // Lecture des informations (service Device Information + batterie)
    // ==================================================================
    private void readDeviceInfo(final Runnable onDone) {
        info = new DeviceInfo();
        info.watchName = device.getName();
        if (gatt == null) {
            if (onDone != null) onDone.run();
            return;
        }
        BluetoothGattService di = gatt.getService(TomTomProtocol.SERVICE_DEVICE_INFORMATION);
        if (di == null) {
            log("Service Device Information absent");
            if (onDone != null) onDone.run();
            return;
        }
        final UUID[] toRead = {
                TomTomProtocol.CHAR_MODEL_NUMBER,
                TomTomProtocol.CHAR_SERIAL_NUMBER,
                TomTomProtocol.CHAR_HARDWARE_REVISION,
                TomTomProtocol.CHAR_SOFTWARE_REVISION,
                TomTomProtocol.CHAR_MANUFACTURER_NAME,
                TomTomProtocol.CHAR_SYSTEM_ID
        };
        readSequentially(di, toRead, 0, new Runnable() {
            @Override
            public void run() {
                listener.onDeviceInfo(info);
                BluetoothGattService battery = gatt.getService(TomTomProtocol.SERVICE_BATTERY);
                if (battery != null) {
                    BluetoothGattCharacteristic c = battery.getCharacteristic(TomTomProtocol.CHAR_BATTERY_LEVEL);
                    if (c != null) readCharacteristic(c, null);
                }
                if (onDone != null) onDone.run();
            }
        });
    }

    /** Lit les caractéristiques les unes après les autres (chaînage strict
     *  sur la fin de chaque lecture, comme l'officiel). */
    private void readSequentially(final BluetoothGattService service, final UUID[] uuids,
                                  final int index, final Runnable onAllDone) {
        if (index >= uuids.length) {
            onAllDone.run();
            return;
        }
        final BluetoothGattCharacteristic c = service.getCharacteristic(uuids[index]);
        if (c == null) {
            readSequentially(service, uuids, index + 1, onAllDone);
            return;
        }
        readCharacteristic(c, new Runnable() {
            @Override
            public void run() {
                readSequentially(service, uuids, index + 1, onAllDone);
            }
        });
    }

    // ==================================================================
    // Divers
    // ==================================================================
    // INACTIVITY_TIMEOUT_MILLISECONDS de l'application officielle = 20000
    private static final long INACTIVITY_TIMEOUT_MS = 20000;

    private void startTransferTimeout() {
        mainHandler.removeCallbacks(transferTimeout);
        mainHandler.postDelayed(transferTimeout, INACTIVITY_TIMEOUT_MS);
    }

    private void restartTransferTimeout() {
        mainHandler.removeCallbacks(transferTimeout);
        mainHandler.postDelayed(transferTimeout, INACTIVITY_TIMEOUT_MS);
    }

    private void stopTransferTimeout() {
        mainHandler.removeCallbacks(transferTimeout);
    }

    private void log(String line) {
        Log.d(TAG, line);
        listener.onLog(line);
    }

    private static String clean(String s) {
        if (s == null) return "";
        return s.replaceAll("[^\\x20-\\x7E]", "").trim();
    }

    private static String hex(byte[] data) {
        if (data == null) return "(null)";
        StringBuilder sb = new StringBuilder();
        for (byte b : data) {
            sb.append(String.format(Locale.UK, "%02X ", b));
        }
        return sb.toString().trim();
    }
}
