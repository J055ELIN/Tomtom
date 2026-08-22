#!/usr/bin/env bash
# ============================================================================
# Test fumée « Vinted → LBC » sur émulateur (cf SOP §9.4)
# Vérifie : installation, lancement, écran d'accueil, lecture du manifeste
# public (mise à jour), réglages + journal, export vers Téléchargements.
# ============================================================================
set -euo pipefail

APK="vintedlbc/VintedLbc-v1.1.apk"
PKG="com.j055elin.vintedlbc"
SORTIE="/tmp/smoke"
mkdir -p "$SORTIE"

# --- helpers ---------------------------------------------------------------

capturer () { adb exec-out screencap -p > "$SORTIE/$1.png" 2>/dev/null || true; }

dump () {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1 || true
}

attendre_motif () {  # attendre_motif <motif grep> <étiquette>
  local motif="$1" etiquette="$2"
  for _ in $(seq 1 25); do
    dump
    if grep -q "$motif" /tmp/ui.xml 2>/dev/null; then
      echo "  ✓ $etiquette"; return 0
    fi
    sleep 2
  done
  capturer "echec-$(echo "$etiquette" | tr ' ' '_')"
  echo "  ✗ introuvable : $etiquette (motif « $motif ») — capture $SORTIE"
  exit 1
}

# assistant de tap : trouve text= ou content-desc= contenant le motif, tape au centre
cat > /tmp/tap.py << 'PYEOF'
import re, subprocess, sys
motif = sys.argv[1]
x = open('/tmp/ui.xml', encoding='utf-8', errors='ignore').read()
for m in re.finditer(r'<node[^>]*>', x):
    tag = m.group(0)
    if re.search(r'(text|content-desc)="[^"]*' + re.escape(motif) + r'[^"]*"', tag):
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if b:
            l, t, r, bo = map(int, b.groups())
            subprocess.run(['adb', 'shell', 'input', 'tap',
                            str((l + r) // 2), str((t + bo) // 2)])
            sys.exit(0)
sys.exit(1)
PYEOF

tap () {  # tap <motif> ; puis petite attente d'affichage
  local motif="$1"
  dump
  if ! python3 /tmp/tap.py "$motif"; then
    echo "  ✗ impossible de taper « $motif » (introuvable)"; capturer "echec-tap-$motif"; exit 1
  fi
  sleep 1.5
}

# --- 1. installation -------------------------------------------------------

echo "== 1. Installation de l'APK =="
adb install -r -g "$APK"
echo "  ✓ installée"

echo "== 2. Lancement =="
adb shell am start -W -n "$PKG/.MainActivity" | grep -E "Status|TotalTime" || true

echo "== 3. Écran d'accueil =="
attendre_motif "Synchroniser" "FAB Synchroniser présent"
attendre_motif "annonces suivies" "bandeau résumé affiché"
capturer "01-accueil"

echo "== 4. Menu → « Vérifier les mises à jour » (réseau + manifeste + versionCode) =="
tap "More options"
attendre_motif "Vérifier les mises à jour" "menu ouvert"
tap "Vérifier les mises à jour"
attendre_motif "Application à jour" "manifeste public lu, version identique (Snackbar)"
capturer "02-maj-a-jour"

echo "== 5. Réglages : activation du journal =="
tap "More options"
attendre_motif "Réglages" "menu ouvert"
tap "Réglages"
attendre_motif "Journaliser l'activité" "boîte de réglages affichée"
tap "Journaliser l'activité"
tap "Enregistrer"
dump
grep -q "Journaliser" /tmp/ui.xml && { echo "  ✗ la boîte est restée ouverte"; capturer "echec-reglages"; exit 1; } || true
echo "  ✓ journal activé + réglages enregistrés"
capturer "03-apres-reglages"

echo "== 6. Une action journalisée (vérification mise à jour) =="
tap "More options"
tap "Vérifier les mises à jour"
attendre_motif "Application à jour" "action journalisée (2e vérification)"

echo "== 7. Export du journal vers Téléchargements =="
tap "More options"
attendre_motif "Exporter le journal" "menu ouvert"
tap "Exporter le journal"
attendre_motif "sauvegardé" "Snackbar de confirmation d'export"
capturer "04-export-journal"
sleep 1
FICHIER=$(adb shell ls -t /sdcard/Download/ 2>/dev/null | grep "journal-vintedlbc" | head -1 | tr -d '\r')
if [ -z "$FICHIER" ]; then
  echo "  ✗ aucun fichier journal-vintedlbc* dans /sdcard/Download"; capturer "echec-export"; exit 1
fi
adb pull "/sdcard/Download/$FICHIER" "$SORTIE/$FICHIER" >/dev/null
if [ ! -s "$SORTIE/$FICHIER" ]; then echo "  ✗ journal exporté vide"; exit 1; fi
echo "  ✓ $FICHIER exporté ($(wc -l < "$SORTIE/$FICHIER") lignes) :"
sed 's/^/     /' "$SORTIE/$FICHIER" | head -8

echo ""
echo "SMOKE VINTEDLBC : SUCCÈS ✓"
