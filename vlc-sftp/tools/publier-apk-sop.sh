#!/usr/bin/env bash
# publier-apk-sop.sh - Depose un APK sur le Filebrowser de la SOP puis prepare la
# publication (latest.json), en respectant les quatre regles apprises a la dure.
#
# Regles appliquees (SOP §3.2) :
#   1. POST cree, PUT ecrit   : 'curl -T' sur un fichier inexistant renvoie 404.
#   2. jamais -F "file=@…"    : Filebrowser écrirait l'enveloppe multipart (+236 o)
#                              dans le fichier -> APK corrompue, refusee par Android.
#   3. -T et non --data-binary: -T streame depuis le disque (--data-binary charge
#                              tout en RAM, impossible avec 34 Mo sur 2 Go).
#   4. attendre la fin d'ecriture : comparer la taille annoncee par
#                              'api/resources/<nom>' avant de considerer l'envoi fini
#                              (une APK tronquee a 47 Mo sur 86 est deja passee).
#
# Aucun identifiant n'est ecrit ici : il sort de ton shell ou de ton fichier non
# partage (SOP §9 : "dans ~/.config/...", jamais dans un document).
#
# Usage :
#   FB=https://…/filebrowser FB_USER=… FB_PASS=… \
#     tools/publier-apk-sop.sh VLC-android-sftp-arm64.apk [chemin/dest] [--dry-run]
set -uo pipefail

# hote par defaut = celui de la SOP ; à surcharger avec FB=… si tu changes de machine
BASE="${FB:-https://j055.nova.usbx.me/filebrowser}"
DEST="${2:-/vlc/VLC-Android-sftp-arm64.apk}"
SRC="$1"
DRY="${3:-}${DRY_RUN:-}"
WAIT_MAX="${WAIT_MAX:-120}"

case "$DEST" in /*) ;; *) DEST="/$DEST" ;; esac
[ -f "$SRC" ] || { echo "APK introuvable : $SRC"; exit 9; }
SIZE=$(stat -c %s "$SRC"); SHA=$(sha256sum "$SRC" | cut -d' ' -f1)
echo "source : $SRC"
echo "  taille : $SIZE octets | sha256 : $SHA"
echo "  destination : $DEST"

# --- seche : affiche les commandes sans les executer (testable hors connexion) ---
if [ "$DRY" = "--dry-run" ] || [ "$DRY" = "1" ]; then
    echo; echo "MODE DRY-RUN — les appels qui seront emis :"
    cat <<EOF
  TOKEN=\$(curl -fsS -X POST "\$BASE/api/login" -H "Content-Type: application/json" \\
      -d '{"username":"'\$FB_USER'","password":"'\$FB_PASS'"}')

  # 1) archivage de la version en place (rollback possible, lien inchange)
  curl -s -X PATCH -H "X-Auth: \$TOKEN" \\
    "\$BASE/api/resources$DEST?action=copy&destination=/archives/$(basename "$DEST" .apk)-\$(date +%Y%m%d-%H%M).apk"

  # 2) creer (POST, corps vide) PUIS ecrire (PUT -T) — regles 1 et 3
  curl -s -X POST -H "X-Auth: \$TOKEN" --data-binary "" "\$BASE/api/resources$DEST"
  curl -fsS -X PUT  -H "X-Auth: \$TOKEN" -T "$SRC" "\$BASE/api/resources$DEST"

  # 3) attendre la fin d'ecriture (regle 4) : la taille announcee doit egaler $SIZE
  curl -s -H "X-Auth: \$TOKEN" "\$BASE/api/resources$DEST" | grep -o '"size":[0-9]*'

  # 4) partage permanent lie au CHEMIN (le lien ne change jamais)
  curl -s -X POST -H "X-Auth: \$TOKEN" -H "Content-Type: application/json" -d '{}' \\
    "\$BASE/api/share$DEST"

  # 5) re-telechargement de controle en Python (le curl du bac a sable tronque vers
  #    18 Mo, cf. SOP §note) et comparaison du sha256 avec $SHA
EOF
    exit 0
fi

[ -n "${FB_USER:-}" ] && [ -n "${FB_PASS:-}" ] || { echo "FB_USER / FB_PASS requis dans l'environnement"; exit 9; }
[ "${FB:-}" ] || echo "  (FB non defini : j'utilise $BASE — verifie l'hote)"

echo; echo "1/6 connexion"
TOKEN=$(curl -fsS -m 30 -X POST "$BASE/api/login" -H "Content-Type: application/json" \
    -d "{\"username\":\"$FB_USER\",\"password\":\"$FB_PASS\"}") || { echo "login refused"; exit 9; }
echo "   jeton : ${#TOKEN} octets"
api() { curl -s -m 60 -H "X-Auth: $TOKEN" "$@"; }
apiq() { curl -s -o /dev/null -w '%{http_code}' -m 900 -H "X-Auth: $TOKEN" "$@"; }

echo "2/6 archivage de la version en place (si elle existe)"
EXIST=$(api "$BASE/api/resources$DEST" | grep -o '"size":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "${EXIST:-}" ]; then
    ARCH="/archives/$(basename "$DEST" .apk)-$(date -u +%Y%m%d-%H%M).apk"
    api -X PATCH "$BASE/api/resources$DEST?action=copy&destination=$ARCH" >/dev/null
    echo "   $DEST ($EXIST o) copie vers $ARCH"
else
    echo "   aucun fichier a cet emplacement"
fi

echo "3/6 creation puis ecriture (POST puis PUT -T)"
api -X POST --data-binary "" "$BASE/api/resources$DEST" >/dev/null
code=$(apiq -X PUT -T "$SRC" "$BASE/api/resources$DEST")
echo "   PUT -> HTTP $code $([ "$code" -ge 200 ] && [ "$code" -lt 300 ] && echo "(ecrit)" || echo "(ECHEC)")"
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || exit 8

echo "4/6 attente de la fin d'ecriture (taille annoncee == $SIZE)"
i=0
while [ "$i" -lt "$WAIT_MAX" ]; do
    REMOTE=$(api "$BASE/api/resources$DEST" | grep -o '"size":[0-9]*' | head -1 | cut -d: -f2)
    [ "${REMOTE:-0}" = "$SIZE" ] && { echo "   taille serveur : $REMOTE octets — conforme"; break; }
    printf "\r   taille serveur : %-12s en attente (%s/%s)" "${REMOTE:-?}" "$i" "$WAIT_MAX"
    i=$((i+1)); sleep 2
done
[ "${REMOTE:-0}" = "$SIZE" ] || { echo; echo "   ECHEC : taille finale $REMOTE != $SIZE (envoi tronque ?)"; exit 7; }

echo "5/6 partage permanent lie au chemin"
SH=$(api -X POST -H "Content-Type: application/json" -d '{}' "$BASE/api/share$DEST")
LINK=$(printf '%s' "$SH" | grep -oE '"(hash|url)":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "   partage : ${LINK:-$SH}"
echo "   lien public : $BASE/api/public/dl/${LINK#*/}"

echo "6/6 controle par re-telechargement complet + sha256"
python3 - "$BASE" "$DEST" "$TOKEN" "$SHA" <<'PY'
import sys, urllib.request, hashlib, ssl
base, dest, tok, want = sys.argv[1:5]
url = f"{base}/api/raw{dest}"
req = urllib.request.Request(url, headers={"X-Auth": tok})
h = hashlib.sha256(); n = 0
try:
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=600) as r:
        for chunk in iter(lambda: r.read(1 << 20), b""):
            h.update(chunk); n += len(chunk)
except Exception as e:
    print(f"   telechargement de controle impossible : {e}"); sys.exit(6)
got = h.hexdigest()
print(f"   recu : {n} octets | sha256 : {got[:32]}…")
print("   => identique a l'original" if got == want else "   => DIFFERENT : ne publie pas cet envoi")
sys.exit(0 if got == want else 5)
PY
rc=$?
echo
echo "Ce qu'il reste a faire a la main (champ 'latest.json' propre a ton updater) :"
printf '  {\n    "versionCode": <ancien+1>,\n    "versionName": "…",\n    "apk": "%s",\n    "sha256": "%s"\n  }\n' "${DEST##*/}" "$SHA"
echo "  ⚠️ versionCode strictement superieur a celui installe, sinon Android refuse (SOP §6)."
echo "  ⚠️ ne pas reutiliser un token copie dans un document partage : PAT a revoquer."
exit $rc
