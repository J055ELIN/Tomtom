#!/usr/bin/env bash
# test-choix-patch.sh - Verifie la logique qui decide QUEL patch appliquer selon la branche du
# core VLC, et s'assure qu'elle est la MEME que celle embarquee dans le workflow.
#
# Les deux patchs sont jumeaux :
#   0001 -> videolan/vlc master  (VLC 4.x ; branche vlc-android@master)
#   0002 -> videolan/vlc 3.0.x   (branche que libvlcjni-3.x amene pour un APK 3.7.0/3.7.1)
# Regle : exactement un des deux doit s'appliquer.  Zero -> echec (arbre inconnu).
# Deux -> echec (ambiguite : on ne publie pas un APK au petit bonheur).
#
# Quatre cas joues, sur de vrais arbres :
#   1. vlc@3.0.x   -> 0002            3. arbre sans interet  -> AUCUN, donc echec
#   2. vlc@master  -> 0001            4. 0002 remplace par une copie de 0001 -> AMBIGUITE, echec
# Le cas 4 prouve que la branche « les deux s'appliquent » est atteinte et qu'elle sort en erreur
# SANS toucher a l'arbre.
#
# Sortie : 0 si les 4 cas sont conformes et que le workflow contient bien la meme regle.
# ~5 s (deux clones sparse de contrib/src).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; PKG="$(cd "$HERE/.." && pwd)"
P1="$PKG/patches/0001-contrib-build-libssh2-against-Mbed-TLS-on-Android.patch"
P2="$PKG/patches/0002-contrib-libssh2-mbedtls-on-Android-for-vlc-3.0.x.patch"
WF="${WF:-$PKG/../tomtom-payload/.github/workflows/vlc-android-sftp.yml}"
VD="${VD:-/tmp/choix-patch}"; GITURL="${GITURL:-https://github.com/videolan/vlc.git}"
mkdir -p "$VD"

clone() { # $1 = ref, $2 = dossier-cible
    local d="$VD/$2"
    if [ ! -d "$d/.git" ]; then
        git clone -q --filter=blob:none --no-checkout --depth 1 --branch "$1" "$GITURL" "$d" || return 9
        ( cd "$d" && git sparse-checkout init --cone >/dev/null 2>&1 \
            && git sparse-checkout set contrib/src >/dev/null 2>&1 && git checkout -q "$1" )
    fi
    printf '%s' "$d"
}

# --- la regle, en un seul endroit pour qu'elle soit la meme ici et la-bas ---
select_patch() { # $1 = repertoire contenant les patchs 000[12]-*.patch ; cwd = arbre vlc
    local dir="$1" FITS="" ap=""
    for p in "$dir"/000[12]-*.patch; do
        [ -f "$p" ] || continue
        if git apply --check "$p" 2>/dev/null; then FITS="$FITS $p"; fi
    done
    case "$(echo $FITS | wc -w)" in
        1) ap="${FITS## }"; git apply "$ap" ;;
        0) ap="" ;;
        *) echo "AMBIGUITE"; return 3 ;;
    esac
    [ -n "$ap" ] || { echo "AUCUN"; return 4; }
    echo "$(basename "$ap")"
}

echo "test-choix-patch.sh - $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "  patchs : $(basename "$P1")"
echo "           $(basename "$P2")"
rc=0
M3="$(clone 3.0.x vlc-3.0.x)"; MM="$(clone master vlc-master)"
[ -d "$M3/.git" ] && [ -d "$MM/.git" ] || { echo "  clones indisponibles (reseau ?)"; exit 1; }

# PDIR reel = le dossier patches du kit ; PDIR AMBIGU = 0002 rendu identique a 0001
PDIR="$PKG/patches"
AMBIG="$VD/patches-ambigus"; rm -rf "$AMBIG"; mkdir -p "$AMBIG"
cp "$P1" "$AMBIG/0001-contrib-build-libssh2-against-Mbed-TLS-on-Android.patch"
cp "$P1" "$AMBIG/0002-contrib-libssh2-mbedtls-on-Android-for-vlc-3.0.x.patch"

cas() { # $1 = libelle, $2 = arbre, $3 = dossier de patchs, $4 = attendu, $5 = exit attendu
    local lbl="$1" tree="$2" pd="$3" want="$4" wantrc="$5" got rc before after out
    ( cd "$tree" && git checkout -q -- contrib/src 2>/dev/null; git clean -qfd contrib/src/mbedtls >/dev/null 2>&1
      before=$(git status --porcelain | wc -l)
      out=$( select_patch "$pd" ); rc=$?
      got="${out%%$'\n'*}"
      # pour les cas « applique », on verifie AUSSI que le contenu a change
      nb=0; [ -f contrib/src/ssh2/rules.mak ] && nb=$(grep -c 'CRYPTO_BACKEND:STRING=mbedTLS' contrib/src/ssh2/rules.mak)
      files=$(ls contrib/src/mbedtls 2>/dev/null | tr '\n' ',' )
      after=$(git status --porcelain | wc -l)
      local ok="NON CONFORME"
      case "$got" in *"$want"*)
            if [ "$want" = AUCUN ] || [ "$want" = AMBIGUITE ]; then
                [ "$after" = "$before" ] && ok="OK"          # rien du tout ne doit etre modifie
            elif [ "$nb" = 1 ] && [ -n "$files" ]; then ok="OK"; fi ;;
      esac
      [ "$rc" = "$wantrc" ] || ok="$ok (exit=$rc, attendu $wantrc)"
      printf "  %-30s -> %-10s exit=%s  %s\n" "$lbl" "${got:0:10}" "$rc" "$ok"
      [ "$ok" = OK ] || exit 1
      git checkout -q -- contrib/src 2>/dev/null; git clean -qfd contrib/src/mbedtls >/dev/null 2>&1 )
}

echo "  cas sur les vraies branches :"
cas "vlc@3.0.x ($( cd "$M3" && git rev-parse --short HEAD))" "$M3" "$PDIR"  0002      0 || rc=1
cas "vlc@master ($( cd "$MM" && git rev-parse --short HEAD))" "$MM" "$PDIR" 0001      0 || rc=1
FAKE="$VD/bidon"; rm -rf "$FAKE"; mkdir -p "$FAKE/contrib/src/ssh2"
printf 'SSH2_CONF := -DCRYPTO_BACKEND:STRING=Toto\n' > "$FAKE/contrib/src/ssh2/rules.mak"
( cd "$FAKE" && git init -q >/dev/null 2>&1 && git add -A && git -c user.email=t@t -c user.name=t commit -q -m x )
cas "arbre sans interet" "$FAKE" "$PDIR" AUCUN 4 || rc=1
cas "0002 = copie de 0001 (ambigu)" "$MM" "$AMBIG" AMBIGUITE 3 || rc=1
echo
echo "  la regle est-elle bien la MEME dans le workflow ? (controle anti-derive)"
if [ -f "$WF" ]; then
    for needle in '1) APPLIED="${FITS## }"; git apply "$APPLIED" ;;' '*) echo "AMBIGUITE' "AUCUN patch ne s'applique"; do
        if grep -qF "$needle" "$WF"; then echo "     present : ${needle:0:46}…"; else echo "     ABSENT   : ${needle:0:46}…  -> le workflow ne suit plus la meme regle"; rc=1; fi
    done
else
    echo "     (workflow introuvable a $WF - regle non comparee)"
fi
echo
echo "  code retour global = $rc  (0 = les 4 cas conformes et la regle partagee)"
exit $rc
