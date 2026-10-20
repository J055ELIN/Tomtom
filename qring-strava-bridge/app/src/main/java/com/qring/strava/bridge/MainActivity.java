package com.qring.strava.bridge;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Interface principale : scan/choix de la bague, démarrage du pont FC,
 * affichage du rythme cardiaque et du journal.
 */
public class MainActivity extends Activity implements BridgeState.Listener, Logs.Listener {

    private static final int REQ_PERMS = 1;
    private static final String PREFS = "qring_bridge";
    private static final String PREF_ADDR = "ring_address";
    private static final String PREF_NAME = "ring_name";

    private TextView bpmText, statusText, sourceText, ringText, bridgeText, logText;
    private ScrollView logScroll;
    private ListView deviceList;
    private Button btnScan, btnConnect, btnDisconnect, btnStartBridge, btnStopBridge,
            btnSimulate, btnClear, btnDiagnostic, btnShareLog;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<String[]> found = new ArrayList<>();   // {nom, adresse}
    private final Set<String> foundAddresses = new HashSet<>();
    private ArrayAdapter<String> listAdapter;

    private BluetoothAdapter btAdapter;
    private BluetoothLeScanner scanner;
    private boolean scanning = false;
    private String selectedAddress;
    private String selectedName;

    private final StringBuilder logBuffer = new StringBuilder();

    // ==================================================================
    // Cycle de vie
    // ==================================================================

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bpmText = findViewById(R.id.bpmText);
        statusText = findViewById(R.id.statusText);
        sourceText = findViewById(R.id.sourceText);
        ringText = findViewById(R.id.ringText);
        bridgeText = findViewById(R.id.bridgeText);
        logText = findViewById(R.id.logText);
        logScroll = findViewById(R.id.logScroll);
        deviceList = findViewById(R.id.deviceList);

        btnScan = findViewById(R.id.btnScan);
        btnConnect = findViewById(R.id.btnConnect);
        btnDisconnect = findViewById(R.id.btnDisconnect);
        btnStartBridge = findViewById(R.id.btnStartBridge);
        btnStopBridge = findViewById(R.id.btnStopBridge);
        btnSimulate = findViewById(R.id.btnSimulate);
        btnClear = findViewById(R.id.btnClear);
        btnDiagnostic = findViewById(R.id.btnDiagnostic);
        btnShareLog = findViewById(R.id.btnShareLog);

        BluetoothManager bm = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        btAdapter = bm != null ? bm.getAdapter() : null;

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        selectedAddress = prefs.getString(PREF_ADDR, null);
        selectedName = prefs.getString(PREF_NAME, null);

        listAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1);
        deviceList.setAdapter(listAdapter);
        deviceList.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position < found.size()) {
                    selectedName = found.get(position)[0];
                    selectedAddress = found.get(position)[1];
                    updateUi();
                    Logs.add("[ui] sélection : " + selectedName + " [" + selectedAddress + "]");
                }
            }
        });

        btnScan.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleScan();
            }
        });
        btnConnect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                connectRing();
            }
        });
        btnDisconnect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopBridge();
            }
        });
        btnStartBridge.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startBridge(selectedAddress, selectedName, false);
            }
        });
        btnStopBridge.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopBridge();
            }
        });
        btnSimulate.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startBridge(null, null, true);
            }
        });
        btnClear.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Logs.clear();
                logBuffer.setLength(0);
                logText.setText("");
            }
        });
        btnDiagnostic.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showDiagnostic();
            }
        });
        btnShareLog.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                shareLog();
            }
        });

        Logs.addListener(this);
        BridgeState.addListener(this);

        requestPermissionsIfNeeded();

        if (getIntent() != null && getIntent().getBooleanExtra("simulate", false)) {
            Logs.add("[ui] lancement automatique du mode simulation (test)");
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    startBridge(null, null, true);
                }
            }, 800L);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateUi();
        if (logText.getText().length() == 0) {
            logBuffer.setLength(0);
            logBuffer.append(Logs.dump());
            logText.setText(logBuffer.toString());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Logs.removeListener(this);
        BridgeState.removeListener(this);
        stopScan();
    }

    // ==================================================================
    // Permissions
    // ==================================================================

    private void requestPermissionsIfNeeded() {
        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            addIfMissing(needed, Manifest.permission.BLUETOOTH_SCAN);
            addIfMissing(needed, Manifest.permission.BLUETOOTH_CONNECT);
            addIfMissing(needed, Manifest.permission.BLUETOOTH_ADVERTISE);
            addIfMissing(needed, Manifest.permission.POST_NOTIFICATIONS);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            addIfMissing(needed, Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_PERMS);
        }
    }

    private void addIfMissing(List<String> list, String permission) {
        if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
            list.add(permission);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        int granted = 0;
        for (int r : grantResults) {
            if (r == PackageManager.PERMISSION_GRANTED) {
                granted++;
            }
        }
        Logs.add("[ui] permissions accordées : " + granted + "/" + grantResults.length);
        if (granted < grantResults.length) {
            Toast.makeText(this, "Certaines permissions manquent : le pont BLE peut être limité.",
                    Toast.LENGTH_LONG).show();
        }
    }

    // ==================================================================
    // Scan
    // ==================================================================

    @SuppressLint("MissingPermission")
    private void toggleScan() {
        if (scanning) {
            stopScan();
            return;
        }
        if (btAdapter == null) {
            Toast.makeText(this, "Bluetooth non disponible", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!btAdapter.isEnabled()) {
            startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionsIfNeeded();
            return;
        }
        scanner = btAdapter.getBluetoothLeScanner();
        if (scanner == null) {
            Toast.makeText(this, "Scanner BLE indisponible", Toast.LENGTH_SHORT).show();
            return;
        }
        found.clear();
        foundAddresses.clear();
        listAdapter.clear();

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();
        try {
            scanner.startScan(null, settings, scanCallback);
            scanning = true;
            btnScan.setText("Stop scan");
            Logs.add("[ui] scan BLE démarré (20 s)");
            handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                stopScan();
            }
        }, 20000L);
        } catch (SecurityException e) {
            Logs.add("[ui] scan refusé : " + e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (!scanning || scanner == null) {
            return;
        }
        try {
            scanner.stopScan(scanCallback);
        } catch (SecurityException ignored) {
        }
        scanning = false;
        btnScan.setText(R.string.btn_scan);
        Logs.add("[ui] scan arrêté — " + found.size() + " appareil(s) BLE");
    }

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

        @Override
        public void onScanFailed(int errorCode) {
            scanning = false;
            Logs.add("[ui] scan en échec (code " + errorCode + ")");
        }
    };

    private void handleResult(ScanResult result) {
        BluetoothDevice device = result.getDevice();
        if (device == null) {
            return;
        }
        String address = device.getAddress();
        if (foundAddresses.contains(address)) {
            return;
        }

        ScanRecord record = result.getScanRecord();
        String name = record != null ? record.getDeviceName() : null;
        if (name == null) {
            try {
                name = device.getName();
            } catch (SecurityException ignored) {
            }
        }

        boolean looksLikeRing = looksLikeQRing(name, record);
        if (!looksLikeRing) {
            return; // on ne garde que les bagues probables
        }
        if (name == null || name.isEmpty()) {
            name = "(sans nom)";
        }

        foundAddresses.add(address);
        found.add(new String[]{name, address});
        listAdapter.add(name + "   " + address + "   " + result.getRssi() + " dBm");
        Logs.add("[ui] bague détectée : " + name + " [" + address + "] RSSI " + result.getRssi());

        if (selectedAddress == null) {
            selectedAddress = address;
            selectedName = name;
            updateUi();
        }
    }

    private boolean looksLikeQRing(String name, ScanRecord record) {
        if (record != null && record.getServiceUuids() != null) {
            for (ParcelUuid uuid : record.getServiceUuids()) {
                if (RingBleClient.SVC_UART.equals(uuid.getUuid())) {
                    return true;
                }
            }
        }
        if (name == null) {
            return false;
        }
        String n = name.toLowerCase(Locale.US);
        return n.contains("r02") || n.contains("r03") || n.contains("r06") || n.contains("r10")
                || n.contains("colmi") || n.contains("qring") || n.contains("ring")
                || n.contains("smart ring");
    }

    // ==================================================================
    // Pont FC
    // ==================================================================

    private void connectRing() {
        if (selectedAddress == null) {
            Toast.makeText(this, "Scannez puis sélectionnez votre bague", Toast.LENGTH_LONG).show();
            return;
        }
        startBridge(selectedAddress, selectedName != null ? selectedName : selectedAddress, false);
    }

    private void startBridge(String address, String name, boolean simulate) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(PREF_ADDR, address)
                .putString(PREF_NAME, name)
                .apply();

        Intent intent = new Intent(this, HrBridgeService.class);
        intent.setAction(HrBridgeService.ACTION_START);
        if (address != null) {
            intent.putExtra(HrBridgeService.EXTRA_ADDRESS, address);
            intent.putExtra(HrBridgeService.EXTRA_NAME, name);
        }
        if (simulate) {
            intent.putExtra(HrBridgeService.EXTRA_SIMULATE, true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        BridgeState.bridgeRunning = true;
        BridgeState.setStatus(simulate ? "Démarrage du mode test…" : "Démarrage du pont…");
        Logs.add("[ui] démarrage du service" + (simulate ? " (simulation)" : ""));
        updateUi();
    }

    private void stopBridge() {
        Intent intent = new Intent(this, HrBridgeService.class);
        intent.setAction(HrBridgeService.ACTION_STOP);
        try {
            startService(intent);
        } catch (IllegalStateException e) {
            stopService(intent);
        }
        BridgeState.bridgeRunning = false;
        BridgeState.setStatus("Arrêt demandé…");
        Logs.add("[ui] arrêt du pont demandé");
        updateUi();
    }

    // ==================================================================
    // UI
    // ==================================================================

    @Override
    public void onBridgeStateChanged() {
        updateUi();
    }

    private void updateUi() {
        bpmText.setText(BridgeState.bpm > 0
                ? String.format(Locale.US, "%d", BridgeState.bpm)
                : getString(R.string.bpm_placeholder));
        statusText.setText(BridgeState.status);
        sourceText.setText("Source : " + BridgeState.source
                + (BridgeState.simulating ? " (test)" : ""));
        ringText.setText("Bague : " + (BridgeState.ringConnected
                ? (BridgeState.ringName != null && !BridgeState.ringName.isEmpty()
                        ? BridgeState.ringName : "connectée")
                : (selectedName != null ? selectedName + " (sélectionnée)" : "aucune"))
                + (BridgeState.ringBattery >= 0 ? " — " + BridgeState.ringBattery + " %" : ""));
        if (!BridgeState.bridgeRunning) {
            statusText.setTextColor(0xFF000000);
        } else if (BridgeState.advertising) {
            statusText.setTextColor(0xFF1B5E20);   // vert : publicité active
        } else if (BridgeState.peripheralClients > 0) {
            statusText.setTextColor(0xFF0D47A1);   // bleu : un client est connecté
        } else {
            statusText.setTextColor(0xFFB00020);   // rouge : publicité non active
        }
        bridgeText.setText("Pont BLE : "
                + (BridgeState.bridgeRunning ? "actif" : "arrêté")
                + (BridgeState.advertising ? " • publicité 0x180D" : "")
                + (BridgeState.peripheralClients > 0
                        ? " • " + BridgeState.peripheralClients + " client(s)" : "")
                + (BridgeState.subscribed ? " • FC souscrite" : ""));
        btnStartBridge.setEnabled(true);
        btnStopBridge.setEnabled(BridgeState.bridgeRunning);
    }

    // ==================================================================
    // Diagnostic et partage du journal
    // ==================================================================

    private String diagnosticText() {
        StringBuilder sb = new StringBuilder();
        sb.append("Bluetooth : ");
        sb.append(btAdapter == null ? "absent" : (btAdapter.isEnabled() ? "activé" : "désactivé"));
        sb.append('\n');
        sb.append("Appareil : ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
                .append(" (Android ").append(Build.VERSION.RELEASE).append(")\n");
        if (btAdapter != null) {
            try {
                sb.append("Nom Bluetooth : ").append(btAdapter.getName()).append('\n');
            } catch (SecurityException e) {
                sb.append("Nom Bluetooth : (permission refusée)\n");
            }
            sb.append("Mode périphérique : ")
                    .append(btAdapter.isMultipleAdvertisementSupported() ? "supporté" : "NON supporté")
                    .append('\n');
        }
        sb.append("\nPermissions :\n");
        sb.append("  BLUETOOTH_SCAN      : ").append(perm(Manifest.permission.BLUETOOTH_SCAN)).append('\n');
        sb.append("  BLUETOOTH_CONNECT   : ").append(perm(Manifest.permission.BLUETOOTH_CONNECT)).append('\n');
        sb.append("  BLUETOOTH_ADVERTISE : ").append(perm(Manifest.permission.BLUETOOTH_ADVERTISE)).append('\n');
        sb.append("  POST_NOTIFICATIONS  : ").append(perm(Manifest.permission.POST_NOTIFICATIONS)).append('\n');
        sb.append("\nPont : ").append(BridgeState.bridgeRunning ? "actif" : "arrêté").append('\n');
        sb.append("Publicité BLE : ").append(BridgeState.advertising ? "ACTIVE" : "inactive").append('\n');
        sb.append("Clients connectés : ").append(BridgeState.peripheralClients).append('\n');
        sb.append("Abonnement FC (notifications) : ")
                .append(BridgeState.subscribed ? "OUI — une appli reçoit la FC" : "non").append('\n');
        sb.append("Source FC : ").append(BridgeState.source)
                .append(" (").append(BridgeState.bpm > 0 ? BridgeState.bpm + " bpm" : "aucune valeur")
                .append(")\n");
        sb.append("Bague : ").append(BridgeState.ringConnected
                ? ("connectée " + BridgeState.ringAddress) : "non connectée").append('\n');
        return sb.toString();
    }

    private String perm(String permission) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return "accordée (API < 23)";
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
                        ? "accordée" : "REFUSÉE";
            } catch (RuntimeException e) {
                return "n/a";
            }
        }
        return "n/a (Android < 12)";
    }

    private void showDiagnostic() {
        String text = diagnosticText();
        Logs.add("[diag] " + text.replace("\n", " | "));
        new android.app.AlertDialog.Builder(this)
                .setTitle("Diagnostic")
                .setMessage(text)
                .setPositiveButton(R.string.btn_ok, null)
                .show();
    }

    private void shareLog() {
        String body = diagnosticText() + "\n----- journal -----\n" + Logs.dump();
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_SUBJECT, "Journal QRing → Strava");
        send.putExtra(Intent.EXTRA_TEXT, body);
        try {
            startActivity(Intent.createChooser(send, getString(R.string.share_title)));
        } catch (RuntimeException e) {
            Toast.makeText(this, "Aucune application pour partager", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onLogLine(String line) {
        if (line == null || line.isEmpty()) {
            return;
        }
        if (logBuffer.length() > 24000) {
            logBuffer.setLength(0);
            List<String> lines = Logs.snapshot();
            int from = Math.max(0, lines.size() - 150);
            for (int i = from; i < lines.size(); i++) {
                logBuffer.append(lines.get(i)).append('\n');
            }
        } else {
            logBuffer.append(line).append('\n');
        }
        logText.setText(logBuffer.toString());
        logScroll.post(new Runnable() {
            @Override
            public void run() {
                logScroll.fullScroll(View.FOCUS_DOWN);
            }
        });
    }
}
