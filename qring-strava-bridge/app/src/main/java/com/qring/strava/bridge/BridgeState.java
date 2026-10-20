package com.qring.strava.bridge;

import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.CopyOnWriteArrayList;

/**
 * État partagé entre le service (premier plan) et l'activité.
 * Volontairement minimal : pas de dépendance AndroidX / LiveData.
 */
public final class BridgeState {

    public interface Listener {
        void onBridgeStateChanged();
    }

    public static volatile int bpm = -1;
    public static volatile int ringBattery = -1;
    public static volatile boolean ringConnected = false;
    public static volatile boolean bridgeRunning = false;
    public static volatile boolean advertising = false;
    public static volatile boolean simulating = false;
    public static volatile int peripheralClients = 0;
    public static volatile String ringName = "";
    public static volatile String ringAddress = "";
    public static volatile String status = "Inactif";
    public static volatile String source = "—";

    private static final CopyOnWriteArrayList<Listener> LISTENERS = new CopyOnWriteArrayList<>();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private BridgeState() {
    }

    public static void setStatus(String s) {
        status = s;
        notifyListeners();
    }

    public static void setBpm(int value) {
        bpm = value;
        notifyListeners();
    }

    public static void addListener(Listener l) {
        if (l != null && !LISTENERS.contains(l)) {
            LISTENERS.add(l);
        }
    }

    public static void removeListener(Listener l) {
        LISTENERS.remove(l);
    }

    public static void notifyListeners() {
        MAIN.post(() -> {
            for (Listener l : LISTENERS) {
                l.onBridgeStateChanged();
            }
        });
    }
}
