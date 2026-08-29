#!/usr/bin/env bash
# test-choix-patch.sh - Verifie que le mécanisme de la CI (et de build-vlc-android-sftp.sh)
# retient TOUJOURS le bon patch selon la branche du core VLC, et n'en retient AUCUN sur un
# arbre inconnu.  Les deux patchs sont jumeaux :
#   0001 -> videolan/vlc master (VLC 4.x, servi par vlc-android master)
#   0002 -> videolan/vlc 3.0.x (branche que libvlcjni-3.x va chercher pour un APK 3.7.x)
# Ils ne s'appliquent pas au meme endroit : 3.0.x ecrit « DEPS_ssh2 = gcrypt $(DEPS_gcrypt) »
# et « SSH2_CONF := … -DCRYPTO_BACKEND:STRING=Libgcrypt » sur une ligne, la ou master a une
# structure « ifndef HAVE_WIN32 / DEPS_ssh2 += gcrypt » et un SSH2_CONF multiline en « += ».
#
# Sortie : 0 si les trois cas sont conformes.  ~5 s (deux clones sparse de contrib/src).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; PKG="$(cd "$HERE/.." && pwd)"
P1="$PKG/patches/0001-contrib-build-libssh2-against-Mbed-TLS-on-Android.patch"
P2="$PKG/patches/0002-contrib-libssh2-mbedtls-on-Android-for-vlc-3.0.x.patch"
VD="${VD:-/tmp/choix-patch}"; GITURL="${GITURL:-https://github.com/videolan/vlc.git}"
mkdir -p "$VD"

clone() { # $1 = ref, $2 = dossier
    local d="$VD/$2"
    if [ ! -d "$d/.git" ]; then
        git clone -q --filter=blob:none --no-checkout --depth 1 --branch "$1" "$GITURL" "$d" || return 9
        ( cd "$d" && git sparse-checkout init --cone >/dev/null 2>&1 \
            && git sparse-checkout set contrib/src >/dev/null 2>&1 && git checkout -q "$1" )
    fi
    printf '%s' "$d"
}

choix() { # $1 = arbre ; imprime le patch retenu par la logique de la CI
    local d="$1" ap=""
    ( cd "$d" || exit 9
      git checkout -q -- contrib/src 2>/dev/null; git clean -qfd contrib/src/mbedtls >/dev/null 2>&1
      for p in "$P1" "$P2"; do
          [ -f "$p" ] || continue
          if git apply --check "$p" 2>/dev/null; then git apply "$p"; ap="$(basename "$p")"; break; fi
      done
      if [ -z "$ap" ]; then
          for p in "$P1" "$P2"; do
              [ -f "$p" ] || continue
              if patch -p1 --forward --dry-run < "$p" >/dev/null 2>&1; then
                  patch -p1 --forward < "$p" >/dev/null 2>&1; ap="$(basename "$p")"; break
              fi
          done
      fi
      complet="INCOMPLET"
      if [ -n "$ap" ] && [ -f contrib/src/mbedtls/SHA512SUMS ] && [ -f contrib/src/mbedtls/rules.mak ] \
         && grep -q 'CRYPTO_BACKEND:STRING=mbedTLS' contrib/src/ssh2/rules.mak; then complet="complet"; fi
      echo "${ap:-AUCUN}/$complet"
      git checkout -q -- contrib/src 2>/dev/null; git clean -qfd contrib/src/mbedtls >/dev/null 2>&1 )
}

echo "test-choix-patch.sh - $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "  patchs : $(basename "$P1")"
echo "           $(basename "$P2")"
rc=0
declare -A WANT=( [3.0.x]="0002" [master]="0001" )
for ref in 3.0.x master; do
    d="$(clone "$ref" "vlc-$ref")" || { echo "  clone $ref : ECHEC"; rc=1; continue; }
    got="$(choix "$d")"
    head_sha="$(cd "$d" && git rev-parse --short HEAD)"
    case "$got" in
        "${WANT[$ref]}"*/complet) echo "  vlc@$ref [$head_sha] -> ${got%%/*}  OK (attendu ${WANT[$ref]}, arbre $got)" ;;
        *) echo "  vlc@$ref [$head_sha] -> $got   ATTENDU ${WANT[$ref]}/complet -> NON CONFORME"; rc=1 ;;
    esac
done
echo
echo "=== cas negatif : un arbre ou aucun des deux patchs n'a sa place ==="
FAKE="$VD/bidon"; rm -rf "$FAKE"; mkdir -p "$FAKE/contrib/src/ssh2"
printf 'SSH2_CONF := -DCRYPTO_BACKEND:STRING=Toto\n' > "$FAKE/contrib/src/ssh2/rules.mak"
( cd "$FAKE" && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -q -m x )
got="$(choix "$FAKE")"
if [ "$got" = "AUCUN/INCOMPLET" ]; then
    echo "  arbre bidon -> AUCUN patch retenu : la CI s'arrete au lieu de publier un APK inutile  OK"
else
    echo "  arbre bidon -> $got : FAUX POSITIF, le test de selection est trop permissif"; rc=1
fi
echo
echo "  code retour global = $rc  (0 = les 3 cas conformes)"
exit $rc
