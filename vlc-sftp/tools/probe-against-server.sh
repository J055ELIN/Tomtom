#!/usr/bin/env bash
#
# Outil de diagnostic : construit DEUX petits clients SFTP (meme libssh2,
# deux backends crypto differents) et teste la negociation SSH contre un
# serveur, SANS tenter d'authentification.
#
#   hkprobe-gcrypt   = ce que VLC pour Android embarque aujourd'hui
#   hkprobe-mbedtls  = ce que donnerait le VLC patche
#
# Pas de tentative de login => pas de risque de bannissement "soft ban 10 min"
# cote Ultra.cc.  On s'arrete a la fin de la poignee de main.
#
# Usage :  ./probe-against-server.sh <servername>.usbx.me [port]
set -euo pipefail
HOST="${1:?usage: probe-against-server.sh <host> [port]}"
PORT="${2:-22}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LIBSSH2_VERSION=1.11.1
WORK="${WORK:-/tmp/hkprobe-build}"

need() { command -v "$1" >/dev/null || { echo "il manque $1 -- installe-le (sudo apt install $2)" >&2; exit 1; }; }
need gcc build-essential; need cmake cmake; need make build-essential; need pkg-config pkg-config
MISSING=""
pkg-config --exists libgcrypt || MISSING="$MISSING libgcrypt20-dev"
pkg-config --exists mbedtls   || MISSING="$MISSING libmbedtls-dev"
if [ -n "$MISSING" ]; then
    echo "Paquets dev manquants. Installe-les puis relance :" >&2
    echo "    sudo apt-get install -$MISSING" >&2
    exit 1
fi

mkdir -p "$WORK"; cd "$WORK"
[ -d "libssh2-$LIBSSH2_VERSION" ] || {
    curl -fLO "https://www.libssh2.org/download/libssh2-$LIBSSH2_VERSION.tar.xz"
    tar xf libssh2-$LIBSSH2_VERSION.tar.xz
}

for backend in Libgcrypt mbedTLS; do
    tag=$(echo "$backend" | tr 'A-Z' 'a-z')
    [ -x "hkprobe-$tag" ] && continue
    echo "### compilation de libssh2 ($backend) ..."
    cmake -S "libssh2-$LIBSSH2_VERSION" -B "build-$tag" -DCMAKE_BUILD_TYPE=Release \
        -DCRYPTO_BACKEND:STRING="$backend" -DBUILD_EXAMPLES=OFF -DBUILD_TESTING=OFF \
        -DBUILD_SHARED_LIBS=OFF -DBUILD_STATIC_LIBS=ON -DENABLE_ZLIB_COMPRESSION=OFF \
        -DCMAKE_INSTALL_PREFIX="$WORK/prefix-$tag" >/dev/null
    cmake --build "build-$tag" -j"$(nproc)" >/dev/null
    cmake --install "build-$tag" >/dev/null
    EXTRA="-lgcrypt"
    [ "$tag" = mbedtls ] && EXTRA="-lmbedtls -lmbedcrypto -lmbedx509"
    gcc -O1 -I "prefix-$tag/include" "$HERE/hkprobe.c" "prefix-$tag/lib/libssh2.a" $EXTRA -lz -o "hkprobe-$tag"
done

for tag in libgcrypt mbedtls; do
    case $tag in
      libgcrypt) lbl="libssh2+libgcrypt   (comportement du VLC actuel)";;
      mbedtls) lbl="libssh2+mbedTLS     (comportement du VLC patche)";;
    esac
    printf '\n--- %s ---\n' "$lbl"
    "./hkprobe-$tag" "$HOST" "$PORT" probeur "" . 2>&1 | sed 's/^/    /' || true
done
echo
echo "Si gcrypt echoue ('Unable to exchange encryption keys') et que mbedTLS passe"
echo "jusqu'a l'etape d'authentification, le diagnostic Debian 13 est confirme."
