#!/bin/bash
# Test complet ANGi v2.1 sur émulateur (exécuté par .github/workflows/angi-ng-smoke.yml)
set -e

adb root || true
adb wait-for-device
sleep 3

# Position GPS simulée (Amiens)
adb emu geo fix 2.288156 49.872177 || true

echo "=== 1. Installation ==="
adb install -r ANGi-v2.1.apk
adb shell pm grant com.starfleet.angi android.permission.SEND_SMS || true
adb shell pm grant com.starfleet.angi android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant com.starfleet.angi android.permission.POST_NOTIFICATIONS || true

dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 || true
}
shot() { adb exec-out screencap -p > "ecran_$1.png"; }
texts() { grep -oE 'text="[^"]*"' ui.xml | head -14 || true; }

# Centre d'un noeud dont le texte CONTIENT $1
center_of() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 || true
  python3 - "$1" <<'PY'
import re, sys
needle = re.escape(sys.argv[1])
s = open('ui.xml', encoding='utf-8', errors='ignore').read()
m = re.search(r'text="[^"]*' + needle + r'[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s, re.IGNORECASE)
if not m:
    m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="[^"]*' + needle + r'[^"]*"', s, re.IGNORECASE)
if not m:
    sys.exit(2)
print((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2)
PY
}
tap_text() { adb shell input tap $(center_of "$1"); }

echo "=== 2. Lancement ==="
adb shell am start -n com.starfleet.angi/.MainActivity
sleep 15
if adb shell pidof com.starfleet.angi; then echo "PROCESS ALIVE"; else echo "PROCESS MORT"; fi
adb logcat -d > logcat_launch.txt || true
echo "--- FATAL EXCEPTION au lancement ---"
grep -B2 -A25 "FATAL EXCEPTION" logcat_launch.txt | head -80 || echo "PAS DE FATAL EXCEPTION"
grep -B2 -A15 "Process: com.starfleet" logcat_launch.txt | head -40 || true
dump_ui
texts
shot main

echo "=== 3. Carte + position ==="
sleep 3
dump_ui
grep -oE 'text="Position : [^"]*"' ui.xml || echo "PAS DE POSITION AFFICHEE"
if grep -q 'android.webkit.WebView' ui.xml; then echo "WEBVIEW CARTE PRESENT"; else echo "PAS DE WEBVIEW"; fi
shot carte

echo "=== 4. Ajout d'un contact ==="
tap_text "Contacts d'urgence"
sleep 3
dump_ui
shot contacts
tap_text "Ajouter un contact"
sleep 2
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 || true
python3 - <<'PY' > edpos.txt
import re
s = open('ui.xml', encoding='utf-8', errors='ignore').read()
eds = re.findall(r'class="android.widget.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
pts = []
for e in eds:
    x = (int(e[0]) + int(e[2])) // 2
    y = (int(e[1]) + int(e[3])) // 2
    pts.append((y, x))
pts.sort()
for p in pts:
    print(p[1], p[0])
PY
NOM=$(sed -n '1p' edpos.txt)
TEL=$(sed -n '2p' edpos.txt)
echo "champs: nom=$NOM tel=$TEL"
adb shell input tap $NOM
sleep 1
adb shell input text "Josselin"
adb shell input keyevent 61
sleep 1
adb shell input text "0612345678"
adb shell input keyevent 111
sleep 1
dump_ui
shot editcontact
texts
tap_text "Enregistrer"
sleep 2
dump_ui
shot contact_apres_save
echo "--- liste apres sauvegarde ---"
texts
if grep -qi "Josselin" ui.xml; then echo "CONTACT ENREGISTRE OK"; else echo "CONTACT ABSENT"; fi

echo "=== 5. Dialogue edit : bouton Annuler (plus de 'Je vais bien') ==="
tap_text "Josselin"
sleep 2
dump_ui
shot edit_dialog
texts
if grep -qi "Annuler" ui.xml; then echo "BOUTON ANNULER OK"; else echo "PAS D'ANNULER"; fi
if grep -qi "Je vais bien" ui.xml; then echo "BUG: JE VAIS BIEN ENCORE PRESENT"; else echo "OK: plus de 'Je vais bien' dans contacts"; fi
tap_text "Annuler" || true
sleep 1

echo "=== 6. Réglages + test alarme ==="
adb shell input keyevent 4 || true
sleep 2
dump_ui
tap_text "Réglages"
sleep 3
dump_ui
shot reglages
texts
if grep -qi "Tester l'alarme" ui.xml; then echo "BOUTON TEST PRESENT"; else echo "PAS DE BOUTON TEST"; fi
if grep -qi "Version 2.1" ui.xml; then echo "VERSION 2.1 OK"; else echo "VERSION ABSENTE"; fi
tap_text "Tester l'alarme (aucun SMS)"
sleep 3
dump_ui
shot alarme
texts
if grep -qi "MODE TEST" ui.xml; then echo "BANNIERE MODE TEST OK"; else echo "PAS DE MODE TEST"; fi
if grep -qi "Tenez, ça va ?" ui.xml; then echo "ECRAN ALARME OK"; else echo "PAS D'ECRAN ALARME"; fi
sleep 1
shot alarme_flash1
sleep 2
shot alarme_flash2
echo "--- attente fin du compte a rebours (15s) ---"
sleep 11
dump_ui
if grep -qi "Terminé" ui.xml; then echo "FIN DE TEST AFFICHEE"; else echo "PAS DE FIN AFFICHEE"; fi
shot alarme_fin
tap_text "Je vais bien" || true
sleep 2
adb shell input keyevent 4 || true
sleep 1

echo "=== 7. Envoyer ma position (confirmation) ==="
dump_ui
tap_text "Envoyer ma position"
sleep 7
dump_ui
shot envoi_position
texts
if grep -qi "Position envoyée" ui.xml; then echo "DIALOGUE CONFIRMATION OK"; else echo "PAS DE CONFIRMATION"; fi
if grep -qi "Destinataires" ui.xml; then echo "DESTINATAIRES OK"; else echo "PAS DE DESTINATAIRES"; fi
if grep -qi "Résultat" ui.xml; then echo "BILAN OK"; else echo "PAS DE BILAN"; fi
tap_text "OK" || true
sleep 1

echo "=== 8. Logcat final ==="
adb logcat -d > logcat.txt || true
grep -E "FATAL EXCEPTION|ANR in com.starfleet" logcat.txt | tail -10 || echo "AUCUN CRASH"

echo "=== 9. Journal app ==="
adb shell "cat /sdcard/Download/ANGi_debug.log.txt 2>/dev/null" > angi_debug.txt || true
cat angi_debug.txt || true

echo "=== 10. FIN DU TEST ==="
