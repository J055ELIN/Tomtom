package com.qring.strava.bridge;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Autotest BLE de bout en bout, sans dépendre d'une application tierce.
 *
 * Le téléphone joue les deux rôles en même temps :
 *   1. il scanne sa propre publicité et vérifie qu'elle annonce bien 0x180D ;
 *   2. il s'y connecte en tant que client, découvre les services ;
 *   3. il s'abonne à 0x2A37 et vérifie qu'il reçoit au moins 2 mesures.
 *
 * Si cet autotest passe, le pont est un capteur FC BLE valide : un échec côté
 * Strava ne peut plus venir de l'application.
 */
public class SelfTest {

    public interface Callback {
        void onStep(String message);

        void onFinished(boolean success, String verdict);
    }

    private static final long TOTAL_TIMEOUT_MS = 25000L;

    private final Context context;
    private final Callback callback;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;

    private boolean advSeen = false;
    private boolean serviceFound = false;
    private boolean subscribed = false;
    private int notifCount = 0;
    private int lastBpm = -1;
    private boolean finished = false;
    private int descriptorStatus = -1;
    private boolean descriptorWritten = false;

    private String localName = "";
    private final java.util.LinkedHashSet<String> census = new java.util.LinkedHashSet<>();

    public SelfTest(Context context, Callback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    // ==================================================================
    // Déroulement
    // ==================================================================

    public void start() {
        BluetoothManager bm = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bm == null || bm.getAdapter() == null || !bm.getAdapter().isEnabled()) {
            finish(false, "Bluetooth désactivé");
            return;
        }
        try {
            localName = bm.getAdapter().getName();
        } catch (SecurityException e) {
            localName = null;
        }
        if (localName == null) {
            localName = "";
        }
        scanner = bm.getAdapter().getBluetoothLeScanner();
        if (scanner == null) {
            finish(false, "Scanner BLE indisponible");
            return;
        }
        step("1/4  Recherche de notre propre publicité (0x180D, nom « " + localName + " »)…");
        try {
            ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build();
            scanner.startScan(null, settings, scanCallback);
        } catch (SecurityException e) {
            finish(false, "Scan refusé : " + e.getMessage());
            return;
        }
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!finished && !advSeen) {
                    finish(false, "Aucune publicité 0x180D au nom « " + localName
                            + " » vue en 12 s. Appareils 0x180D entendus : " + censusSummary());
                }
            }
        }, 12000L);

        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!finished) {
                    finish(false, "Délai dépassé — mesures reçues : " + notifCount
                            + (advSeen ? ", service trouvé : " + serviceFound : ""));
                }
            }
        }, TOTAL_TIMEOUT_MS);
    }

    public void cancel() {
        finish(false, "Autotest annulé");
    }

    private void finish(boolean ok, String verdict) {
        if (finished) {
            return;
        }
        finished = true;
        handler.removeCallbacksAndMessages(null);
        try {
            if (scanner != null) {
                scanner.stopScan(scanCallback);
            }
        } catch (SecurityException ignored) {
        }
        if (gatt != null) {
            try {
                gatt.disconnect();
                gatt.close();
            } catch (SecurityException ignored) {
            }
            gatt = null;
        }
        callback.onFinished(ok, verdict);
    }

    private String censusSummary() {
        if (census.isEmpty()) {
            return "aucun (rien n'annonce 0x180D autour de vous)";
        }
        StringBuilder sb = new StringBuilder();
        int i = 0;
        for (String c : census) {
            if (i++ > 0) {
                sb.append(", ");
            }
            sb.append(c);
            if (i >= 6) {
                sb.append("…");
                break;
            }
        }
        return sb.toString();
    }

    private void step(String message) {
        if (!finished) {
            callback.onStep(message);
        }
    }

    // ==================================================================
    // Scan
    // ==================================================================

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            handleResult(result);
        }

        @Override
        public void onBatchScanResults(List<ScanResult> results) {
            for (ScanResult r : results) {
                handleResult(r);
            }
        }
    };

    private void handleResult(ScanResult result) {
        if (advSeen || finished || result == null || result.getDevice() == null) {
            return;
        }
        ScanRecord record = result.getScanRecord();
        boolean hasHrUuid = false;
        if (record != null && record.getServiceUuids() != null) {
            for (ParcelUuid uuid : record.getServiceUuids()) {
                if (HrmPeripheral.SVC_HEART_RATE.equals(uuid.getUuid())) {
                    hasHrUuid = true;
                    break;
                }
            }
        }
        String name = record != null ? record.getDeviceName() : null;
        if (!hasHrUuid) {
            return;
        }
        String label = (name == null ? "(sans nom)" : name) + " " + result.getRssi() + " dBm";
        if (census.add(label)) {
            callback.onStep("   vu : " + label);
        }

        // On ne se connecte QU'À notre propre publicité. Une ceinture cardiaque
        // voisine annonce aussi 0x180D : s'y connecter fausserait le test.
        boolean isUs = name != null && !localName.isEmpty()
                && name.equalsIgnoreCase(localName);
        if (!isUs) {
            return;
        }

        advSeen = true;
        step("2/4  Notre publicité détectée : « " + name + " » annonce 0x180D ("
                + result.getRssi() + " dBm) → connexion…");
        try {
            scanner.stopScan(scanCallback);
        } catch (SecurityException ignored) {
        }
        try {
            gatt = result.getDevice().connectGatt(context, false, gattCallback,
                    BluetoothDevice.TRANSPORT_LE);
        } catch (SecurityException e) {
            finish(false, "Connexion refusée : " + e.getMessage());
        }
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!finished && !serviceFound) {
                    finish(false, "Connecté mais service 0x180D introuvable ou découverte bloquée");
                }
            }
        }, 10000L);
    }

    // ==================================================================
    // Client GATT
    // ==================================================================

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {

        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                step("3/4  Connecté au pont → découverte des services…");
                try {
                    g.discoverServices();
                } catch (SecurityException e) {
                    finish(false, "Découverte refusée : " + e.getMessage());
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED && !finished) {
                finish(false, "Déconnexion prématurée (status=" + status + ", mesures reçues : "
                        + notifCount + ")");
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                finish(false, "Découverte des services en échec (status=" + status + ")");
                return;
            }
            BluetoothGattService hr = g.getService(HrmPeripheral.SVC_HEART_RATE);
            if (hr == null) {
                StringBuilder sb = new StringBuilder("service 0x180D ABSENT. Services vus : ");
                for (BluetoothGattService s : g.getServices()) {
                    sb.append(shortUuid(s.getUuid())).append(' ');
                }
                finish(false, sb.toString());
                return;
            }
            serviceFound = true;
            BluetoothGattCharacteristic hrm = hr.getCharacteristic(HrmPeripheral.CHAR_HR_MEASUREMENT);
            if (hrm == null) {
                finish(false, "0x180D présent mais caractéristique 0x2A37 absente");
                return;
            }
            step("4/4  Service 0x180D + 0x2A37 trouvés → abonnement aux notifications…");
            try {
                g.setCharacteristicNotification(hrm, true);
                BluetoothGattDescriptor cccd = hrm.getDescriptor(HrmPeripheral.CCCD);
                if (cccd == null) {
                    finish(false, "Descripteur CCCD absent sur 0x2A37 (abonnement impossible)");
                    return;
                }
                cccd.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                g.writeDescriptor(cccd);
            } catch (SecurityException e) {
                finish(false, "Abonnement refusé : " + e.getMessage());
            }
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
            descriptorStatus = status;
            if (status == BluetoothGatt.GATT_SUCCESS) {
                subscribed = true;
                step("Abonnement accepté — attente des mesures (bpm)…");
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        if (!finished && notifCount < 2) {
                            finish(false, "Abonnement accepté mais aucune mesure reçue "
                                    + "(il faut que la FC soit > 0)");
                        }
                    }
                }, 6000L);
            } else {
                descriptorWritten = true;
                finish(false, "Écriture du CCCD refusée (status=" + status + ")");
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
            if (!HrmPeripheral.CHAR_HR_MEASUREMENT.equals(ch.getUuid())) {
                return;
            }
            byte[] v = ch.getValue();
            if (v == null || v.length < 2) {
                return;
            }
            int bpm = v[1] & 0xFF;
            notifCount++;
            lastBpm = bpm;
            step("Mesure " + notifCount + " reçue : " + bpm + " bpm");
            if (notifCount >= 2) {
                finish(true, "Capteur FC BLE validé : service 0x180D, caractéristique 0x2A37, "
                        + notifCount + " mesures reçues (dernière : " + lastBpm + " bpm)");
            }
        }
    };

    private static String shortUuid(UUID uuid) {
        String s = uuid.toString().toUpperCase(Locale.US);
        if (s.startsWith("0000") && s.endsWith("-0000-1000-8000-00805F9B34FB")) {
            return "0x" + s.substring(4, 8);
        }
        return s;
    }
}
