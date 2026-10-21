#!/bin/bash
# ============================================================================
# Vérification du pont QRing → Strava sur un téléphone réel (adb)
#
#   bash scripts/device-check.sh            # mode simulation (sans bague)
#   bash scripts/device-check.sh --ring XX  # tente aussi la connexion à la bague
#
# Produit : ecran_qring.png, ui_qring.xml, logcat_qring.txt
# ============================================================================
set -u
PKG=com.qring.strava.bridge
APK="$(dirname "$0")/../releases/QRingStravaBridge-v3.6.apk"

echo "=== 1. Appareil ==="
adb devices
adb wait-for-device

echo "=== 2. Installation ==="
adb install -r "$APK" || exit 1
adb shell dumpsys package $PKG | grep -E "versionCode|versionName" | head -2

echo "=== 3. Permissions ==="
for p in BLUETOOTH_SCAN BLUETOOTH_CONNECT BLUETOOTH_ADVERTISE POST_NOTIFICATIONS; do
  adb shell pm grant $PKG android.permission.$p 2>/dev/null && echo "  $p accordée" \
    || echo "  $p ignorée (API < 31 ?)"
done

echo "=== 4. Lancement en mode simulation ==="
adb logcat -c
adb shell am start -n $PKG/.MainActivity --ez simulate true
sleep 20

echo "=== 5. Processus vivant ? ==="
adb shell pidof $PKG && echo "PROCESSUS OK" || echo "PROCESSUS MORT"

echo "=== 6. Captures ==="
adb shell uiautomator dump /sdcard/ui_qring.xml >/dev/null 2>&1
adb pull /sdcard/ui_qring.xml ui_qring.xml >/dev/null 2>&1
adb exec-out screencap -p > ecran_qring.png
grep -oE 'text="[^"]*"' ui_qring.xml | head -20

echo "=== 7. Journal applicatif ==="
adb logcat -d -s QRingBridge | tail -60 | tee logcat_qring.txt

echo
echo "Fichiers produits : ecran_qring.png, ui_qring.xml, logcat_qring.txt"
echo "Dans Strava : Enregistrer → Capteurs → Fréquence cardiaque → le nom Bluetooth du téléphone"
