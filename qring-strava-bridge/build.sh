#!/bin/bash
# ============================================================================
# QRing → Strava HR Bridge — compilation de l'APK
#
# Deux façons d'utiliser ce script :
#
#  A. Environnement avec Android SDK + JDK (recommandé)
#       export ANDROID_HOME=/opt/sfa-tools/sdk
#       export ANDROID_BUILD_TOOLS=$ANDROID_HOME/build-tools/34.0.0
#       export ANDROID_PLATFORM=$ANDROID_HOME/platforms/android-34/android.jar
#       export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
#       bash build.sh
#
#  B. Environnement minimal (pas de JDK complet, pas de Gradle)
#     Le script sait utiliser des outils de substitution s'ils sont fournis :
#       ECJ_JAR   : compilateur Eclipse (remplace javac)
#       DX_JAR    : dexer historique « dx » (remplace d8)
#       AAPT2     : binaire aapt2 autonome
#       ZIPALIGN  : binaire zipalign autonome
#       APKSIGNER : binaire apksigner autonome (sinon apksigner.jar + java)
#
# Produit : releases/QRingStravaBridge-v3.0.apk (signée debug, v1 + v2)
# ============================================================================
set -euo pipefail

PROJ="$(cd "$(dirname "$0")" && pwd)"
APP="$PROJ/app/src/main"
OUT="$PROJ/build"
VERSION_NAME="3.5"
VERSION_CODE="8"
MIN_SDK="23"
TARGET_SDK="34"
PKG="com.qring.strava.bridge"

# ---------------------------------------------------------------- outils ----
JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/java}"; JAVA_BIN="${JAVA_BIN:-java}"
KEYTOOL_BIN="${JAVA_HOME:+$JAVA_HOME/bin/keytool}"; KEYTOOL_BIN="${KEYTOOL_BIN:-keytool}"

if [ -n "${AAPT2:-}" ]; then AAPT2_BIN="$AAPT2"
elif [ -n "${ANDROID_BUILD_TOOLS:-}" ] && [ -x "$ANDROID_BUILD_TOOLS/aapt2" ]; then AAPT2_BIN="$ANDROID_BUILD_TOOLS/aapt2"
else AAPT2_BIN="$(command -v aapt2 || true)"; fi

if [ -n "${ZIPALIGN:-}" ]; then ZIPALIGN_BIN="$ZIPALIGN"
elif [ -n "${ANDROID_BUILD_TOOLS:-}" ] && [ -x "$ANDROID_BUILD_TOOLS/zipalign" ]; then ZIPALIGN_BIN="$ANDROID_BUILD_TOOLS/zipalign"
else ZIPALIGN_BIN="$(command -v zipalign || true)"; fi

if [ -n "${APKSIGNER:-}" ]; then APKSIGNER_BIN="$APKSIGNER"
elif [ -n "${ANDROID_BUILD_TOOLS:-}" ] && [ -x "$ANDROID_BUILD_TOOLS/apksigner" ]; then APKSIGNER_BIN="$ANDROID_BUILD_TOOLS/apksigner"
else APKSIGNER_BIN="$(command -v apksigner || true)"; fi

if [ -n "${ANDROID_PLATFORM:-}" ]; then ANDROID_JAR="$ANDROID_PLATFORM"
elif [ -n "${ANDROID_HOME:-}" ]; then ANDROID_JAR="$ANDROID_HOME/platforms/android-$TARGET_SDK/android.jar"
else ANDROID_JAR=""; fi

# d8 (build-tools ≥ 28) sinon dx
D8_JAR=""
for c in "${R8_JAR:-}" "${ANDROID_BUILD_TOOLS:-}/lib/d8.jar" "${ANDROID_HOME:-}/build-tools/34.0.0/lib/d8.jar"; do
  [ -n "$c" ] && [ -f "$c" ] && D8_JAR="$c" && break
done
DX_JAR="${DX_JAR:-}"
if [ -z "$D8_JAR" ] && [ -z "$DX_JAR" ]; then
  for c in "${ANDROID_BUILD_TOOLS:-}/lib/dx.jar" "${ANDROID_HOME:-}/build-tools/21.0.1/lib/dx.jar"; do
    [ -n "$c" ] && [ -f "$c" ] && DX_JAR="$c" && break
  done
fi

# javac sinon ECJ
JAVAC_BIN=""
[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/javac" ] && JAVAC_BIN="$JAVA_HOME/bin/javac"
[ -z "$JAVAC_BIN" ] && JAVAC_BIN="$(command -v javac || true)"

# ------------------------------------------------------------------ checks --
fail() { echo "ERREUR : $*" >&2; exit 1; }
need() { [ -n "$2" ] && [ -e "$2" ] || [ -n "$(command -v "$2" 2>/dev/null || true)" ] || fail "$1 introuvable ($2)"; }

[ -n "$ANDROID_JAR" ] || fail "android.jar introuvable : définissez ANDROID_PLATFORM ou ANDROID_HOME"
[ -f "$ANDROID_JAR" ] || fail "android.jar introuvable : $ANDROID_JAR"
[ -n "$AAPT2_BIN" ] || fail "aapt2 introuvable (ANDROID_BUILD_TOOLS ou AAPT2)"
[ -n "$ZIPALIGN_BIN" ] || fail "zipalign introuvable (ANDROID_BUILD_TOOLS ou ZIPALIGN)"
[ -n "$APKSIGNER_BIN" ] || [ -n "${APKSIGNER_JAR:-}" ] || fail "apksigner introuvable (APKSIGNER ou APKSIGNER_JAR)"
[ -n "$D8_JAR" ] || [ -n "$DX_JAR" ] || fail "ni d8.jar ni dx.jar : définissez D8_JAR/R8_JAR ou DX_JAR"
[ -n "$JAVAC_BIN" ] || [ -n "${ECJ_JAR:-}" ] || fail "ni javac ni ECJ_JAR"

echo "android.jar : $ANDROID_JAR"
echo "aapt2       : $AAPT2_BIN"
if [ -n "${ECJ_JAR:-}" ]; then echo "compilateur : ECJ ($ECJ_JAR)"; else echo "compilateur : $JAVAC_BIN"; fi
if [ -n "$D8_JAR" ]; then echo "dexer       : d8 ($D8_JAR)"; else echo "dexer       : dx ($DX_JAR)"; fi

# --------------------------------------------------------------- 1. ressources
rm -rf "$OUT"
mkdir -p "$OUT/res" "$OUT/gen" "$OUT/classes" "$PROJ/releases"

echo "=== 1/6  aapt2 compile ==="
"$AAPT2_BIN" compile --dir "$APP/res" -o "$OUT/res/res.zip"

echo "=== 2/6  aapt2 link ==="
# aapt2 exige l'attribut « package » alors qu'AGP 8 l'interdit dans le manifeste
# source : on travaille sur une copie.
python3 - "$APP/AndroidManifest.xml" "$OUT/AndroidManifest.xml" "$PKG" <<'PY'
import sys
src, dst, pkg = sys.argv[1], sys.argv[2], sys.argv[3]
data = open(src, encoding='utf-8').read()
if 'package=' not in data.split('>')[0]:
    data = data.replace('<manifest ', '<manifest package="%s" ' % pkg, 1)
open(dst, 'w', encoding='utf-8').write(data)
PY
"$AAPT2_BIN" link \
  -o "$OUT/app-unsigned.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$OUT/AndroidManifest.xml" \
  --java "$OUT/gen" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  "$OUT/res/res.zip"

# ------------------------------------------------------------------ 3. java --
echo "=== 3/6  compilation Java ==="
SRC=$(find "$APP/java" "$OUT/gen" -name '*.java')
if [ -n "${ECJ_JAR:-}" ]; then
  "$JAVA_BIN" -jar "$ECJ_JAR" -source 1.7 -target 1.7 -encoding UTF-8 -nowarn \
    -cp "$ANDROID_JAR" -d "$OUT/classes" $SRC
else
  "$JAVAC_BIN" -source 1.7 -target 1.7 -encoding UTF-8 -nowarn \
    -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" -d "$OUT/classes" $SRC
fi
PKG_PATH="${PKG//./\/}"
[ -f "$OUT/classes/$PKG_PATH/MainActivity.class" ] || fail "compilation Java : aucune classe produite"

# ------------------------------------------------------------------ 4. dex ---
echo "=== 4/6  conversion en DEX ==="
if [ -n "$D8_JAR" ]; then
  "$JAVA_BIN" -cp "$D8_JAR" com.android.tools.r8.D8 \
    --min-api "$MIN_SDK" --output "$OUT/classes.dex" $(find "$OUT/classes" -name '*.class')
else
  "$JAVA_BIN" -cp "$DX_JAR" com.android.dx.command.Main --dex \
    --output="$OUT/classes.dex" "$OUT/classes"
fi

echo "=== 5/6  ajout de classes.dex dans l'APK ==="
python3 - "$OUT/app-unsigned.apk" "$OUT/classes.dex" "$OUT/app-with-dex.apk" <<'PY'
import sys, zipfile
apk, dex, dst = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(apk) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        zout.writestr(item, zin.read(item.filename))
    zout.write(dex, 'classes.dex')
PY

# ------------------------------------------------------- 6. alignement + signe
echo "=== 6/6  zipalign + signature ==="
"$ZIPALIGN_BIN" -f -p 4 "$OUT/app-with-dex.apk" "$OUT/app-aligned.apk"

KS="$PROJ/debug.keystore"
if [ ! -f "$KS" ]; then
  echo "Génération d'une keystore de debug…"
  "$KEYTOOL_BIN" -genkeypair -keystore "$KS" -alias androiddebugkey \
    -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi

FINAL="$PROJ/releases/QRingStravaBridge-v$VERSION_NAME.apk"
if [ -n "$APKSIGNER_BIN" ]; then
  "$APKSIGNER_BIN" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
    --ks-key-alias androiddebugkey --min-sdk-version "$MIN_SDK" --out "$FINAL" "$OUT/app-aligned.apk"
else
  "$JAVA_BIN" -jar "$APKSIGNER_JAR" sign --ks "$KS" --ks-pass pass:android \
    --key-pass pass:android --ks-key-alias androiddebugkey \
    --min-sdk-version "$MIN_SDK" --out "$FINAL" "$OUT/app-aligned.apk"
fi

if [ -n "$APKSIGNER_BIN" ]; then
  "$APKSIGNER_BIN" verify --verbose "$FINAL" | head -6
else
  "$JAVA_BIN" -jar "$APKSIGNER_JAR" verify --verbose "$FINAL" | head -6
fi
ls -l "$FINAL"
echo
echo "APK prête : $FINAL"
echo "Installation : adb install -r \"$FINAL\""
