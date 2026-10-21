package com.qring.strava.bridge;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Enregistre une séance (FC + trace GPS) et l'exporte au format TCX, importable
 * dans Strava sur le MÊME téléphone.
 *
 * Pourquoi c'est nécessaire : un téléphone ne reçoit jamais ses propres
 * publicités Bluetooth. Strava lancé sur l'appareil qui diffuse ne peut donc pas
 * voir le capteur ; en revanche il accepte parfaitement l'import d'un fichier
 * TCX contenant les positions et la fréquence cardiaque.
 */
public class SessionRecorder {

    private static final long GPS_INTERVAL_MS = 3000L;
    private static final long GPS_MIN_DISTANCE_M = 2L;

    private static final class Sample {
        final long time;
        final double lat;
        final double lon;
        final int bpm;

        Sample(long time, double lat, double lon, int bpm) {
            this.time = time;
            this.lat = lat;
            this.lon = lon;
            this.bpm = bpm;
        }
    }

    private final Context context;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Sample> samples = new ArrayList<>();

    private LocationManager locationManager;
    private boolean recording = false;
    private long startTime = 0L;
    private Location lastLocation;
    private int lastBpm = -1;
    private long lastSampleTime = 0L;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!recording) {
                return;
            }
            addSample();
            handler.postDelayed(this, 1000L);
        }
    };

    private final LocationListener locationListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location location) {
            lastLocation = location;
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {
        }

        @Override
        public void onProviderEnabled(String provider) {
        }

        @Override
        public void onProviderDisabled(String provider) {
        }
    };

    private static SessionRecorder instance;

    /** Instance unique : le service enregistre, l'activité exporte. */
    public static synchronized SessionRecorder getInstance(Context context) {
        if (instance == null) {
            instance = new SessionRecorder(context);
        }
        return instance;
    }

    private SessionRecorder(Context context) {
        this.context = context.getApplicationContext();
    }

    public boolean isRecording() {
        return recording;
    }

    public int getSampleCount() {
        return samples.size();
    }

    /** Distance cumulée de la séance en cours (mètres). */
    public double getDistanceMeters() {
        synchronized (samples) {
            return totalDistance(new ArrayList<>(samples));
        }
    }

    /** FC moyenne des points enregistrés (0 si aucun). */
    public int getAverageHr() {
        synchronized (samples) {
            int sum = 0, n = 0;
            for (Sample s : samples) {
                if (s.bpm > 0) {
                    sum += s.bpm;
                    n++;
                }
            }
            return n == 0 ? 0 : sum / n;
        }
    }

    /** FC maximale des points enregistrés (0 si aucun). */
    public int getMaxHr() {
        synchronized (samples) {
            int max = 0;
            for (Sample s : samples) {
                if (s.bpm > max) {
                    max = s.bpm;
                }
            }
            return max;
        }
    }

    public long getDurationMs() {
        if (!recording || samples.isEmpty()) {
            return samples.isEmpty() ? 0L : samples.get(samples.size() - 1).time - startTime;
        }
        return System.currentTimeMillis() - startTime;
    }

    // ==================================================================
    // Enregistrement
    // ==================================================================

    public void start() {
        if (recording) {
            return;
        }
        synchronized (samples) {
            samples.clear();
        }
        startTime = System.currentTimeMillis();
        recording = true;
        lastSampleTime = 0L;
        Logs.add("[séance] enregistrement démarré");
        startGps();
        handler.post(ticker);
    }

    public void stop() {
        if (!recording) {
            return;
        }
        recording = false;
        handler.removeCallbacks(ticker);
        stopGps();
        Logs.add("[séance] enregistrement arrêté — " + samples.size() + " points");
        BridgeState.recordedSamples = samples.size();
        BridgeState.notifyListeners();
    }

    /** Appelé par le service à chaque mesure de fréquence cardiaque. */
    public void onHeartRate(int bpm) {
        lastBpm = bpm;
    }

    private void addSample() {
        synchronized (samples) {
            long now = System.currentTimeMillis();
            if (now - lastSampleTime < 900L) {
                return;
            }
            lastSampleTime = now;
            double lat = lastLocation != null ? lastLocation.getLatitude() : Double.NaN;
            double lon = lastLocation != null ? lastLocation.getLongitude() : Double.NaN;
            samples.add(new Sample(now, lat, lon, lastBpm));
            BridgeState.recordedSamples = samples.size();
            if (samples.size() % 10 == 0) {
                BridgeState.notifyListeners();
            }
        }
    }

    private void startGps() {
        if (context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            Logs.add("[séance] ⚠ permission de localisation absente : le fichier TCX n'aura pas de trace GPS");
            return;
        }
        try {
            locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) {
                return;
            }
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER,
                        GPS_INTERVAL_MS, GPS_MIN_DISTANCE_M, locationListener, Looper.getMainLooper());
                Logs.add("[séance] GPS actif");
            } else {
                Logs.add("[séance] ⚠ GPS désactivé sur le téléphone : la trace sera absente");
            }
            Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last != null) {
                lastLocation = last;
            }
        } catch (SecurityException e) {
            Logs.add("[séance] localisation refusée : " + e.getMessage());
        }
    }

    private void stopGps() {
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (SecurityException ignored) {
            }
        }
    }

    // ==================================================================
    // Export TCX
    // ==================================================================

    /** Nom du fichier de la séance courante. */
    public String fileName() {
        return "QRingHR-"
                + new SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(new Date(startTime))
                + ".tcx";
    }

    /** Contenu TCX en mémoire (pour l'envoi direct à Strava), ou null si trop peu de points. */
    public byte[] tcxBytes() {
        synchronized (samples) {
            if (samples.size() < 2) {
                return null;
            }
        }
        try {
            return buildTcx().getBytes("UTF-8");
        } catch (Exception e) {
            Logs.add("[séance] construction TCX impossible : " + e.getMessage());
            return null;
        }
    }

    /** Écrit un fichier .tcx (GPS + FC) et renvoie son URI, ou null en cas d'échec. */
    public Uri exportTcx() {
        synchronized (samples) {
            if (samples.size() < 2) {
                Logs.add("[séance] export impossible : pas assez de points");
                return null;
            }
        }
        String xml = buildTcx();
        String name = fileName();
        try {
            Uri uri = writeToDownloads(name, xml.getBytes("UTF-8"));
            if (uri != null) {
                Logs.add("[séance] TCX exporté : " + name);
            }
            return uri;
        } catch (Exception e) {
            Logs.add("[séance] échec de l'export : " + e.getMessage());
            return null;
        }
    }

    private Uri writeToDownloads(String name, byte[] data) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/vnd.garmin.tcx+xml");
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QRingHR");
            Uri uri = context.getContentResolver()
                    .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                return null;
            }
            OutputStream out = context.getContentResolver().openOutputStream(uri);
            if (out == null) {
                return null;
            }
            out.write(data);
            out.close();
            return uri;
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS), "QRingHR");
        if (!dir.exists() && !dir.mkdirs()) {
            return null;
        }
        File file = new File(dir, name);
        FileOutputStream out = new FileOutputStream(file);
        out.write(data);
        out.close();
        return Uri.fromFile(file);
    }

    private String buildTcx() {
        List<Sample> copy;
        synchronized (samples) {
            copy = new ArrayList<>(samples);
        }
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));

        long durationSec = Math.max(1L, (copy.get(copy.size() - 1).time - copy.get(0).time) / 1000L);

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"");
        sb.append(" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"");
        sb.append(" xsi:schemaLocation=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2")
                .append(" http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd\">\n");
        sb.append("  <Activities>\n");
        sb.append("    <Activity Sport=\"Other\">\n");
        sb.append("      <Id>").append(fmt.format(new Date(copy.get(0).time))).append("</Id>\n");
        sb.append("      <Lap StartTime=\"").append(fmt.format(new Date(copy.get(0).time))).append("\">\n");
        sb.append("        <TotalTimeSeconds>").append(durationSec).append("</TotalTimeSeconds>\n");
        sb.append("        <DistanceMeters>").append(String.format(Locale.US, "%.1f", totalDistance(copy)))
                .append("</DistanceMeters>\n");
        sb.append("        <Calories>0</Calories>\n");
        sb.append("        <Intensity>Active</Intensity>\n");
        sb.append("        <TriggerMethod>Manual</TriggerMethod>\n");
        sb.append("        <Track>\n");
        for (Sample s : copy) {
            if (s.bpm <= 0) {
                continue;
            }
            sb.append("          <Trackpoint>\n");
            sb.append("            <Time>").append(fmt.format(new Date(s.time))).append("</Time>\n");
            if (!Double.isNaN(s.lat) && !Double.isNaN(s.lon)) {
                sb.append("            <Position>\n");
                sb.append("              <LatitudeDegrees>")
                        .append(String.format(Locale.US, "%.7f", s.lat))
                        .append("</LatitudeDegrees>\n");
                sb.append("              <LongitudeDegrees>")
                        .append(String.format(Locale.US, "%.7f", s.lon))
                        .append("</LongitudeDegrees>\n");
                sb.append("            </Position>\n");
            }
            sb.append("            <HeartRateBpm>\n");
            sb.append("              <Value>").append(s.bpm).append("</Value>\n");
            sb.append("            </HeartRateBpm>\n");
            sb.append("          </Trackpoint>\n");
        }
        sb.append("        </Track>\n");
        sb.append("      </Lap>\n");
        sb.append("      <Creator xsi:type=\"Device_t\">\n");
        sb.append("        <Name>QRing HR Bridge</Name>\n");
        sb.append("        <UnitId>0</UnitId>\n");
        sb.append("        <ProductID>0</ProductID>\n");
        sb.append("        <Version>\n");
        sb.append("          <VersionMajor>3</VersionMajor>\n");
        sb.append("          <VersionMinor>8</VersionMinor>\n");
        sb.append("        </Version>\n");
        sb.append("      </Creator>\n");
        sb.append("    </Activity>\n");
        sb.append("  </Activities>\n");
        sb.append("</TrainingCenterDatabase>\n");
        return sb.toString();
    }

    private static double totalDistance(List<Sample> points) {
        double total = 0;
        Sample previous = null;
        for (Sample s : points) {
            if (Double.isNaN(s.lat) || Double.isNaN(s.lon)) {
                continue;
            }
            if (previous != null && !Double.isNaN(previous.lat) && !Double.isNaN(previous.lon)) {
                float[] result = new float[1];
                Location.distanceBetween(previous.lat, previous.lon, s.lat, s.lon, result);
                total += result[0];
            }
            previous = s;
        }
        return total;
    }

    /** Ouvre le sélecteur de partage pour le fichier TCX (Drive, e-mail, Strava…). */
    public void shareTcx(Uri uri, String title) {
        if (uri == null) {
            return;
        }
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("application/vnd.garmin.tcx+xml");
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(send, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(chooser);
    }
}
