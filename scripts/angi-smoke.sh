#!/bin/bash
# Test complet ANGi v2.2 sur émulateur (exécuté par .github/workflows/angi-ng-smoke.yml)
set -e

adb root || true
adb wait-for-device
sleep 3

# Position GPS simulée (Amiens)
adb emu geo fix 2.288156 49.872177 || true

echo "=== 1. Installation ==="
adb install -r ANGi-v2.7.apk
adb shell dumpsys package com.starfleet.angi | grep -E "versionCode|versionName" | head -2
adb shell pm grant com.starfleet.angi android.permission.SEND_SMS || true
adb shell pm grant com.starfleet.angi android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant com.starfleet.angi android.permission.POST_NOTIFICATIONS || true
adb shell pm grant com.starfleet.angi android.permission.BLUETOOTH_SCAN || true
adb shell pm grant com.starfleet.angi android.permission.BLUETOOTH_CONNECT || true

dump_ui() {
  rm -f ui.xml
  adb shell rm -f /sdcard/ui.xml
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 || true
  if [ ! -s ui.xml ]; then echo "DUMP_UI_ECHEC" >> ui_fail.txt; fi
}
shot() { adb exec-out screencap -p > "ecran_$1.png" || true; }
texts() { grep -oE 'text="[^"]*"' ui.xml | head -14 || true; }
to_main() {
  adb shell input keyevent 4 || true
  sleep 1
  adb shell am start -f 0x24000000 -n com.starfleet.angi/.MainActivity || true
  sleep 2
}
start_act() { adb shell am start -n "com.starfleet.angi/.$1"; sleep 3; }

# Ferme les dialogues systeme eventuels (permissions, ANR)
dismiss_dialogs() {
  for i in 1 2 3; do
    dump_ui
    grep -qi 'text="Allow"' ui.xml || grep -qi 'text="Wait"' ui.xml || break
    XY=$(python3 - <<'PY'
import re
s = open('ui.xml', encoding='utf-8', errors='ignore').read()
for pat in [r'text="Allow only"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
            r'text="Allow"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
            r'text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"']:
    m = re.search(pat, s, re.IGNORECASE)
    if m:
        print((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2)
        break
PY
)
    if [ -n "$XY" ]; then
      echo "Dialogue systeme -> clic ($XY)"
      adb shell input tap $XY || true
      sleep 2
    fi
  done
}

# Centre d'un noeud dont le texte CONTIENT $1 (dump frais obligatoire)
center_of() {
  rm -f ui.xml
  adb shell rm -f /sdcard/ui.xml
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
    txts = re.findall(r'text="([^"]*)"', s)
    print('CENTER_NOT_FOUND for [' + sys.argv[1] + ']', file=sys.stderr)
    print('UI_TEXTES: ' + ' | '.join(t for t in txts if t)[:300], file=sys.stderr)
    sys.exit(2)
print((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2)
PY
}
tap_text() { XY=$(center_of "$1") && adb shell input tap $XY; }

echo "=== 2. Lancement ==="
adb shell am start -n com.starfleet.angi/.MainActivity
sleep 12
echo "--- Fichiers de log (doit etre 1 seul) ---"
adb shell "ls /sdcard/Download/ | grep -i angi" || echo "AUCUN FICHIER ANGI"
adb shell "ls /sdcard/Download/ | grep -ci angi" || true
dismiss_dialogs
sleep 3
if adb shell pidof com.starfleet.angi; then echo "PROCESS ALIVE"; else echo "PROCESS MORT"; fi
adb logcat -d > logcat_launch.txt || true
grep -E "FATAL EXCEPTION|ANR in com.starfleet" logcat_launch.txt | tail -5 || echo "PAS DE CRASH AU LANCEMENT"
dump_ui
texts
shot main

echo "=== 3. Carte + position ==="
sleep 3
dump_ui
grep -oE 'text="Position : [^"]*"' ui.xml || echo "PAS DE POSITION AFFICHEE"
if grep -q 'android.webkit.WebView' ui.xml; then echo "WEBVIEW CARTE PRESENT"; else echo "PAS DE WEBVIEW"; fi
shot carte
python3 - <<'PY'
from PIL import Image
im = Image.open('ecran_carte.png').convert('RGB')
w, h = im.size
zone = im.crop((0, int(h*0.12), w, int(h*0.45)))
px = list(zone.getdata())
n = max(len(px), 1)
gris_fond = sum(1 for p in px if abs(p[0]-232) < 12 and abs(p[1]-232) < 12 and abs(p[2]-232) < 12)
colores = sum(1 for p in px if max(p) - min(p) > 28)
print(f"ANALYSE_CARTE: gris_fond={100*gris_fond//n}% colores={100*colores//n}%")
if colores * 100 // n > 1:
    print("CARTE: TUILES OSM AFFICHEES")
elif gris_fond * 100 // n > 10:
    print("CARTE: HTML AFFICHE MAIS PAS DE TUILES (probablement pas d'Internet)")
else:
    print("CARTE: NON AFFICHEE (HTML vide)")
PY
adb logcat -d | grep -iE "chromium|net::ERR|tile.openstreetmap" | tail -8 || true

echo "=== 3.5. Ecran Appairage (scan BLE) ==="
start_act ScanActivity
dump_ui
texts
shot appairage
if grep -qi "Appairer un capteur" ui.xml; then echo "ECRAN APPAREILAGE OK"; else echo "PAS D'ECRAN APPAREILAGE"; fi
adb shell "cat /sdcard/Download/ANGi_debug.log.txt 2>/dev/null" > scan_journal.txt || true
grep -E "\[SCAN\]|\[BLE\]|\[SDK\]" scan_journal.txt | tail -8 || echo "PAS DE LIGNES SCAN/BLE/SDK"
to_main

echo "=== 3.7. Demarrer la surveillance (service foreground) ==="
tap_text "Démarrer la surveillance" || true
sleep 5
adb shell dumpsys activity services com.starfleet.angi | grep -E "SurveillanceService" | head -2 || echo "SERVICE INTROUVABLE"
adb shell "cat /sdcard/Download/ANGi_debug.log.txt 2>/dev/null" | grep -E "MONITOR|SESSION" | tail -5 || true
echo "--- arret de la surveillance ---"
tap_text "Arrêter la surveillance" || true
sleep 2
to_main

echo "=== 4. Ajout d'un contact ==="
start_act ContactsActivity
tap_text "Ajouter un contact" || true
sleep 2
dump_ui
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
tap_text "Enregistrer" || true
sleep 2
dump_ui
shot contact_apres_save
texts
if grep -qi "Josselin" ui.xml; then echo "CONTACT ENREGISTRE OK"; else echo "CONTACT ABSENT"; fi

echo "=== 5. Dialogue edit : bouton Annuler (plus de 'Je vais bien') ==="
tap_text "Josselin" || true
sleep 2
dump_ui
shot edit_dialog
texts
if grep -qi "Annuler" ui.xml; then echo "BOUTON ANNULER OK"; else echo "PAS D'ANNULER"; fi
if grep -qi "Je vais bien" ui.xml; then echo "BUG: JE VAIS BIEN ENCORE PRESENT"; else echo "OK: plus de 'Je vais bien' dans contacts"; fi
tap_text "Annuler" || true
sleep 1

echo "=== 6. Réglages + test alarme ==="
start_act SettingsActivity
dump_ui
shot reglages
texts
if grep -qi "Tester l'alarme" ui.xml; then echo "BOUTON TEST PRESENT"; else echo "PAS DE BOUTON TEST"; fi
if grep -qi "Version 2.7" ui.xml; then echo "VERSION 2.7 OK"; else echo "VERSION ABSENTE"; fi
tap_text "Tester l'alarme (aucun SMS)" || true
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
sleep 11
dump_ui
if grep -qi "Terminé" ui.xml; then echo "FIN DE TEST AFFICHEE"; else echo "PAS DE FIN AFFICHEE"; fi
shot alarme_fin
tap_text "Je vais bien" || true
sleep 2

echo "=== 7. Envoyer ma position (confirmation) ==="
to_main
tap_text "Envoyer ma position" || true
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
