package com.tomtombridge.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.File;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import com.tomtombridge.app.ble.TomTomDevice;
import com.tomtombridge.app.ble.TomTomProtocol;

/**
 * TomTom Bridge — client Bluetooth LE autonome pour montres TomTom Sports.
 *
 * Fonctions : scan, connexion + appairage par PIN, infos, batterie, réglage de
 * l'heure, liste et téléchargement des entraînements (.ttbin) et des données
 * de pas (.bucket).
 */
public class MainActivity extends Activity implements TomTomDevice.Listener {

    private static final int REQ_PERMS = 1;
    private static final String PREFS = "tomtombridge";
    private static final String PREFS_PIN = "pin";

    // --- vues ---
    private TextView statusText;
    private TextView logText;
    private ScrollView logScroll;
    private ListView deviceList;
    private Button btnScan, btnConnect, btnDisconnect;
    private Button btnInfo, btnBattery, btnTime;
    private Button btnListWorkouts, btnGetWorkouts, btnGetSteps;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final StringBuilder logBuffer = new StringBuilder();

    private BluetoothAdapter btAdapter;
    private boolean scanning = false;
    private final List<String[]> devices = new ArrayList<>(); // {nom, adresse, type}
    private final Set<String> deviceAddresses = new HashSet<>();
    private ArrayAdapter<String> listAdapter;
    private String selectedAddress;
    private String selectedName;

    private TomTomDevice tomtom;
    private AlertDialog pinDialog;

    private final List<Integer> listedWorkouts = new ArrayList<>();
    private final List<Integer> pendingDownloads = new ArrayList<>();
    private int autoDownloadType = -1;
    private boolean transferBusy = false;

    private String storedPin;

    // ==================================================================
    // Cycle de vie
    // ==================================================================
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.statusText);
        logText = findViewById(R.id.logText);
        logScroll = findViewById(R.id.logScroll);
        deviceList = findViewById(R.id.deviceList);
        btnScan = findViewById(R.id.btnScan);
        btnConnect = findViewById(R.id.btnConnect);
        btnDisconnect = findViewById(R.id.btnDisconnect);
        btnInfo = findViewById(R.id.btnInfo);
        btnBattery = findViewById(R.id.btnBattery);
        btnTime = findViewById(R.id.btnTime);
        btnListWorkouts = findViewById(R.id.btnListWorkouts);
        btnGetWorkouts = findViewById(R.id.btnGetWorkouts);
        btnGetSteps = findViewById(R.id.btnGetSteps);

        BluetoothManager bm = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        btAdapter = bm != null ? bm.getAdapter() : null;

        storedPin = getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREFS_PIN, null);

        listAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1);
        deviceList.setAdapter(listAdapter);

        btnScan.setOnClickListener(v -> scan());
        btnConnect.setOnClickListener(v -> connectToSelected());
        btnDisconnect.setOnClickListener(v -> {
            if (tomtom != null) tomtom.disconnect();
            setConnectedUi(false);
        });
        btnInfo.setOnClickListener(v -> {
            if (tomtom != null) tomtom.requestInfo();
        });
        btnBattery.setOnClickListener(v -> {
            if (tomtom != null) tomtom.requestBattery();
        });
        btnTime.setOnClickListener(v -> {
            if (tomtom != null) tomtom.setTime();
        });
        btnListWorkouts.setOnClickListener(v -> {
            if (tomtom != null) tomtom.listFiles(TomTomProtocol.TYPE_WORKOUT);
        });
        btnGetWorkouts.setOnClickListener(v -> {
            autoDownloadType = TomTomProtocol.TYPE_WORKOUT;
            if (!listedWorkouts.isEmpty()) {
                startDownloads(TomTomProtocol.TYPE_WORKOUT, listedWorkouts);
            } else if (tomtom != null) {
                log("Liste des entraînements puis téléchargement…");
                tomtom.listFiles(TomTomProtocol.TYPE_WORKOUT);
            }
        });
        btnGetSteps.setOnClickListener(v -> {
            autoDownloadType = TomTomProtocol.TYPE_STEP_BUCKET;
            if (tomtom != null) tomtom.listFiles(TomTomProtocol.TYPE_STEP_BUCKET);
        });

        deviceList.setOnItemClickListener((parent, view, position, id) -> {
            String[] d = devices.get(position);
            selectedAddress = d[1];
            selectedName = d[0];
            btnConnect.setEnabled(true);
            statusText.setText("Sélectionné: " + d[0] + " (" + d[1] + ") " + d[2]);
        });

        updateConnectionButtons();
        log("TomTom Bridge prêt. Activez le Bluetooth puis appuyez sur Scanner.");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (pinDialog != null && pinDialog.isShowing()) pinDialog.dismiss();
        if (tomtom != null) tomtom.disconnect();
    }

    // ==================================================================
    // Permissions
    // ==================================================================
    private boolean ensurePermissions() {
        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.BLUETOOTH_SCAN);
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.BLUETOOTH_CONNECT);
        } else {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_PERMS);
            return false;
        }
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMS) {
            for (int i = 0; i < grantResults.length; i++) {
                if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                    log("Permission refusée: " + permissions[i] +
                            " — le scan BLE ne fonctionnera pas");
                }
            }
        }
    }

    // ==================================================================
    // Scan
    // ==================================================================
    private void scan() {
        if (!ensurePermissions()) return;
        if (btAdapter == null || !btAdapter.isEnabled()) {
            log("Bluetooth désactivé");
            return;
        }
        if (scanning) {
            stopScan();
            return;
        }
        devices.clear();
        deviceAddresses.clear();
        listAdapter.clear();
        selectedAddress = null;
        btnConnect.setEnabled(false);
        btnScan.setText("Arrêter");
        scanning = true;
        log("Scan BLE en cours (cherche une montre TomTom, fabricant 0x0100)…");

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();
        btAdapter.getBluetoothLeScanner().startScan(null, settings, scanCallback);
        handler.postDelayed(() -> {
            if (scanning) stopScan();
        }, 15000);
    }

    private void stopScan() {
        if (scanning && btAdapter != null) {
            try {
                btAdapter.getBluetoothLeScanner().stopScan(scanCallback);
            } catch (Exception ignored) {
            }
        }
        scanning = false;
        btnScan.setText("Scanner");
        log("Scan terminé (" + devices.size() + " appareil(s) TomTom trouvé(s))");
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            ScanRecord record = result.getScanRecord();
            if (record == null) return;
            BluetoothDevice device = result.getDevice();

            byte[] mfg = record.getManufacturerSpecificData(TomTomProtocol.TOMTOM_MANUFACTURER_ID);
            List<android.os.ParcelUuid> uuids = record.getServiceUuids();
            boolean isTomTom = mfg != null;
            boolean hasV1 = false, hasV2 = false;
            if (uuids != null) {
                for (android.os.ParcelUuid u : uuids) {
                    if (u.getUuid().equals(TomTomProtocol.SERVICE_FILE_TRANSFER_V1)) hasV1 = true;
                    if (u.getUuid().equals(TomTomProtocol.SERVICE_FILE_TRANSFER_V2)) hasV2 = true;
                }
            }
            if (!isTomTom && !hasV1 && !hasV2) return;

            boolean pairing = mfg != null && mfg.length > 3 && (mfg[3] & 0xFF) == 1;
            final String type = (hasV2 ? "V2" : hasV1 ? "V1" : "?")
                    + (pairing ? " (appairage)" : "");
            final String name = device.getName() != null ? device.getName() : "(sans nom)";
            final String addr = device.getAddress();

            runOnUiThread(() -> {
                if (deviceAddresses.contains(addr)) return;
                deviceAddresses.add(addr);
                devices.add(new String[]{name, addr, type});
                listAdapter.add(name + "\n" + addr + "  [" + type + "]");
                log("Trouvé: " + name + " (" + addr + ") " + type);
            });
        }
    };

    // ==================================================================
    // Connexion
    // ==================================================================
    private void connectToSelected() {
        if (selectedAddress == null) return;
        BluetoothDevice device = btAdapter.getRemoteDevice(selectedAddress);
        if (device == null) {
            log("Appareil introuvable");
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 &&
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            ensurePermissions();
            return;
        }
        // Le lien Bluetooth (bonding) est géré par TomTomDevice.connect() :
        // il attend BOND_BONDED avant d'ouvrir la connexion GATT.
        tomtom = new TomTomDevice(this, device, this);
        tomtom.connect(storedPin);
        setConnectedUi(true);
    }

    private void setConnectedUi(boolean connected) {
        btnConnect.setEnabled(!connected && selectedAddress != null);
        btnDisconnect.setEnabled(connected);
        btnInfo.setEnabled(connected);
        btnBattery.setEnabled(connected);
        btnTime.setEnabled(connected);
        btnListWorkouts.setEnabled(connected);
        btnGetWorkouts.setEnabled(connected);
        btnGetSteps.setEnabled(connected);
    }

    private void updateConnectionButtons() {
        btnConnect.setEnabled(selectedAddress != null);
        btnDisconnect.setEnabled(tomtom != null && tomtom.isReady());
        boolean c = tomtom != null && tomtom.isReady();
        btnInfo.setEnabled(c);
        btnBattery.setEnabled(c);
        btnTime.setEnabled(c);
        btnListWorkouts.setEnabled(c);
        btnGetWorkouts.setEnabled(c);
        btnGetSteps.setEnabled(c);
    }

    // ==================================================================
    // Téléchargements en série
    // ==================================================================
    private void startDownloads(int type, List<Integer> numbers) {
        pendingDownloads.clear();
        pendingDownloads.addAll(numbers);
        log("Téléchargement de " + pendingDownloads.size() + " fichier(s) de type " +
                TomTomProtocol.fileTypeName(type) + "…");
        transferBusy = false;
        nextDownload(type);
    }

    private void nextDownload(int type) {
        if (pendingDownloads.isEmpty()) {
            transferBusy = false;
            log("Tous les téléchargements sont terminés.");
            statusText.setText("Prêt ✓");
            return;
        }
        int number = pendingDownloads.remove(0);
        transferBusy = true;
        File dir = new File(saveDir(type));
        log("→ Fichier " + String.format(Locale.UK, "%04X", number) +
                " (" + (pendingDownloads.size() + 1) + " restant(s))");
        tomtom.downloadFile(type, number, dir.getAbsolutePath());
    }

    private String saveDir(int type) {
        File base = getExternalFilesDir(null);
        if (base == null) base = getFilesDir();
        return new File(base, type == TomTomProtocol.TYPE_WORKOUT ? "workouts" : "steps")
                .getAbsolutePath();
    }

    // ==================================================================
    // Journal
    // ==================================================================
    private void log(final String line) {
        runOnUiThread(() -> {
            String ts = String.format(Locale.UK, "[%02d:%02d:%02d] ",
                    java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY),
                    java.util.Calendar.getInstance().get(java.util.Calendar.MINUTE),
                    java.util.Calendar.getInstance().get(java.util.Calendar.SECOND));
            logBuffer.append(ts).append(line).append('\n');
            if (logBuffer.length() > 20000) {
                logBuffer.delete(0, logBuffer.length() - 16000);
            }
            logText.setText(logBuffer.toString());
            logScroll.post(() -> logScroll.fullScroll(View.FOCUS_DOWN));
        });
    }

    private void showPinDialog(boolean invalid) {
        // une seule boîte de dialogue à la fois
        if (pinDialog != null && pinDialog.isShowing()) {
            pinDialog.dismiss();
        }
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setHint("PIN affiché par la montre (6 chiffres)");
        if (storedPin != null) {
            input.setText(storedPin);
            input.setSelection(storedPin.length());
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMargins(40, 20, 40, 0);
        input.setLayoutParams(lp);

        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setTitle(invalid ? "PIN refusé — réessayez" : "Saisir le PIN de la montre")
                .setMessage("La montre affiche un code PIN sur son écran. Saisissez-le ci-dessous.\n"
                        + (invalid ? "L'ancien code n'est plus valide : la montre affiche un nouveau PIN."
                        : "Si la montre affiche un NOUVEAU code, remplacez le code pré-rempli."))
                .setView(input)
                .setCancelable(false)
                .setPositiveButton("OK", (dialog, which) -> {
                    String pin = input.getText().toString().trim();
                    if (pin.isEmpty()) {
                        showPinDialog(invalid);
                        return;
                    }
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREFS_PIN, pin).apply();
                    storedPin = pin;
                    if (tomtom != null) tomtom.sendPin(pin);
                });
        pinDialog = b.show();
    }

    // ==================================================================
    // Implémentation de TomTomDevice.Listener (appelé depuis un thread
    // secondaire → on bascule sur le thread UI).
    // ==================================================================
    @Override
    public void onLog(String line) {
        log(line);
    }

    @Override
    public void onStatus(final String status) {
        runOnUiThread(() -> statusText.setText(status));
    }

    @Override
    public void onReady(boolean v2, TomTomDevice.DeviceInfo info) {
        runOnUiThread(() -> {
            updateConnectionButtons();
            statusText.setText("Prêt ✓ — " + (tomtom != null ? tomtom.getDeviceName() : ""));
        });
    }

    @Override
    public void onAuthPinRequested() {
        runOnUiThread(() -> showPinDialog(false));
    }

    @Override
    public void onAuthInvalid() {
        runOnUiThread(() -> showPinDialog(true));
    }

    @Override
    public void onDeviceInfo(final TomTomDevice.DeviceInfo info) {
        log("--- Informations montre ---\n" + info.summary());
    }

    @Override
    public void onBattery(final int percent) {
        log("Batterie: " + percent + " %");
    }

    @Override
    public void onFileList(final int type, final List<Integer> numbers) {
        StringBuilder sb = new StringBuilder();
        sb.append("Fichiers de type ").append(TomTomProtocol.fileTypeName(type))
                .append(" (").append(numbers.size()).append(") : ");
        for (int n : numbers) {
            sb.append(String.format(Locale.UK, "%04X", n)).append(' ');
        }
        log(sb.toString());

        if (type == TomTomProtocol.TYPE_WORKOUT) {
            listedWorkouts.clear();
            listedWorkouts.addAll(numbers);
        }
        if (autoDownloadType == type && tomtom != null) {
            startDownloads(type, numbers);
        }
    }

    @Override
    public void onFileReceived(final int type, final int number, final String savedPath) {
        log("Fichier reçu: " + String.format(Locale.UK, "%04X", number) + " → " + savedPath);
        if (transferBusy) {
            nextDownload(type);
        }
    }

    @Override
    public void onTransferProgress(final String text) {
        log(text);
    }

    @Override
    public void onError(final String message) {
        runOnUiThread(() -> {
            log("ERREUR: " + message);
            statusText.setText("Erreur: " + message);
            if (transferBusy) {
                transferBusy = false;
            }
        });
    }
}
