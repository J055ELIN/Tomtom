#!/usr/bin/env bash
# ============================================================================
# Test fumée « Vinted → LBC » sur émulateur (cf SOP §9.4)
# Vérifie : installation, lancement, écran d'accueil, lecture du manifeste
# public (mise à jour), réglages + journal, SYNCHRONISATION RÉELLE avec le
# numéro de profil 270144314 (régression v1.2 : « moi ça marche pas »),
# export du journal vers Téléchargements.
# Assertions UI via uiautomator + assertions logcat via Log.i("VintedLbc").
# ============================================================================
set -euo pipefail

APK="vintedlbc/VintedLbc-v1.2.apk"
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
  cp /tmp/ui.xml "$SORTIE/ui-$(echo "$etiquette" | tr ' ' '_').xml" 2>/dev/null || true
  echo "  ✗ introuvable : $etiquette (motif « $motif ») — capture + XML dans $SORTIE"
  exit 1
}

attendre_logcat () {  # attendre_logcat <motif> <étiquette> [essais]
  local motif="$1" etiquette="$2" essais="${3:-20}"
  for _ in $(seq 1 "$essais"); do
    if adb logcat -d 2>/dev/null | grep -q "$motif"; then
      echo "  ✓ $etiquette"; return 0
    fi
    sleep 2
  done
  capturer "echec-logcat-$(echo "$etiquette" | tr ' ' '_')"
  echo "  ✗ logcat sans « $motif » ($etiquette). Derniers messages :"
  adb logcat -d -s VintedLbc:I 2>/dev/null | tail -5 | sed 's/^/     /'
  exit 1
}

# assistant de tap : trouve text=, content-desc= ou resource-id= contenant le
# motif, tape au centre du nœud
cat > /tmp/tap.py << 'PYEOF'
import re, subprocess, sys
motif = sys.argv[1]
x = open('/tmp/ui.xml', encoding='utf-8', errors='ignore').read()
for m in re.finditer(r'<node[^>]*>', x):
    tag = m.group(0)
    if re.search(r'(text|content-desc|resource-id)="[^"]*' + re.escape(motif) + r'[^"]*"', tag):
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if b:
            l, t, r, bo = map(int, b.groups())
            subprocess.run(['adb', 'shell', 'input', 'tap',
                            str((l + r) // 2), str((t + bo) // 2)])
            sys.exit(0)
sys.exit(1)
PYEOF

tap () {
  local motif="$1"
  dump
  if ! python3 /tmp/tap.py "$motif"; then
    echo "  ✗ impossible de taper « $motif » (introuvable)"; capturer "echec-tap-$motif"; exit 1
  fi
  sleep 1.5
}

# ferme le clavier virtuel SANS fermer la boîte de dialogue : la touche RETOUR
# n'est envoyée que si le clavier est réellement ouvert (vérifié via dumpsys)
fermer_clavier () {
  for _ in 1 2 3; do
    local ouvert
    ouvert=$(adb shell dumpsys input_method 2>/dev/null | grep -c "mInputShown=true" || true)
    if [ "${ouvert:-0}" = "0" ]; then return 0; fi
    adb shell input keyevent 4   # RETOUR : clavier ouvert → ferme le clavier
    sleep 1
  done
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
adb logcat -c
tap "More options"
attendre_motif "Vérifier les mises à jour" "menu ouvert"
tap "Vérifier les mises à jour"
attendre_logcat "application à jour" "manifeste public lu, versionCode identique"
if adb logcat -d 2>/dev/null | grep -q "manifeste injoignable"; then
  echo "  ✗ le manifeste est injoignable depuis l'émulateur"; exit 1
fi
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

echo "== 6. SYNCHRONISATION RÉELLE : saisie du NUMÉRO de profil (régression v1.2) =="
tap "More options"
tap "Réglages"
attendre_motif "Journaliser l'activité" "boîte de réglages affichée"
tap "champ_pseudo"
adb shell input text "270144314"
sleep 1
dump
if ! grep -q 'text="270144314"' /tmp/ui.xml; then
  echo "  ✗ le champ pseudo ne contient pas « 270144314 » (frappe non reçue ?)"
  capturer "echec-frappe"; cp /tmp/ui.xml "$SORTIE/ui-frappe.xml"
  grep -o 'champ_pseudo[^>]*' /tmp/ui.xml | head -2
  exit 1
fi
echo "  ✓ « 270144314 » saisi dans le champ"
# pas de touche Échap : elle fermerait la boîte Réglages ; on ne ferme le
# clavier par RETOUR que s'il est réellement ouvert (fermer_clavier)
fermer_clavier
tap "Enregistrer"
fermer_clavier
dump
if grep -q "Journaliser l'activité" /tmp/ui.xml; then
  echo "  ✗ la boîte Réglages est restée ouverte après « Enregistrer »"; capturer "echec-reglages-sync"; exit 1
fi
adb logcat -c
tap "Synchroniser"
echo "  … synchronisation en cours (résolution du numéro + scan Vinted public + photos)"
attendre_logcat "SYNC: démarrage demandé" "bouton Synchroniser a bien déclenché la synchro" 15
attendre_logcat "SYNC: ok" "synchronisation terminée" 100
NB=$(adb logcat -d 2>/dev/null | grep -oE "SYNC: ok — [0-9]+ nouvelles" | head -1 | grep -oE "[0-9]+" | head -1)
if [ -z "$NB" ] || [ "$NB" -lt 1 ]; then
  echo "  ✗ aucune annonce importée (NB=« $NB »)"; capturer "echec-sync"; exit 1
fi
echo "  ✓ $NB annonce(s) importée(s) — le numéro 270144314 a bien été résolu"
attendre_motif "photos" "cartes d'annonces affichées"
capturer "04-sync-reelle"

echo "== 7. Export du journal vers Téléchargements =="
adb logcat -c
tap "More options"
attendre_motif "Exporter le journal" "menu ouvert"
tap "Exporter le journal"
attendre_logcat "JOURNAL:" "export exécuté"
if adb logcat -d 2>/dev/null | grep -q "Journal vide"; then
  echo "  ✗ journal vide à l'export"; exit 1
fi
capturer "05-export-journal"
sleep 1
FICHIER=$(adb shell ls -t /sdcard/Download/ 2>/dev/null | grep "journal-vintedlbc" | head -1 | tr -d '\r')
if [ -z "$FICHIER" ]; then
  echo "  ✗ aucun fichier journal-vintedlbc* dans /sdcard/Download"; capturer "echec-export"; exit 1
fi
adb pull "/sdcard/Download/$FICHIER" "$SORTIE/$FICHIER" >/dev/null
if [ ! -s "$SORTIE/$FICHIER" ]; then echo "  ✗ journal exporté vide"; exit 1; fi
echo "  ✓ $FICHIER exporté ($(wc -l < "$SORTIE/$FICHIER") lignes) :"
sed 's/^/     /' "$SORTIE/$FICHIER" | head -10

echo ""
echo "SMOKE VINTEDLBC : SUCCÈS ✓"
