#!/bin/bash
# Vérifie StravaClient hors téléphone : échange OAuth, envoi multipart, suivi du traitement.
# Usage : bash run.sh   (nécessite java + ecj.jar ; voir README.md)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJ="$(cd "$HERE/../.." && pwd)"
JAVA="${JAVA:-java}"
ECJ="${ECJ_JAR:?définir ECJ_JAR=/chemin/ecj.jar}"
OUT="$(mktemp -d)"
cp "$PROJ/app/src/main/java/com/qring/strava/bridge/StravaClient.java" "$HERE/src/com/qring/strava/bridge/"
"$JAVA" -jar "$ECJ" -source 1.7 -target 1.7 -nowarn -d "$OUT" \
    "$HERE"/stubs/android/content/*.java "$HERE"/src/com/qring/strava/bridge/*.java
python3 -u "$HERE/mock.py" > "$OUT/mock.log" 2>&1 &
MOCK=$!
sleep 1
"$JAVA" -cp "$OUT" com.qring.strava.bridge.Harness
kill $MOCK 2>/dev/null || true
echo "== faux serveur Strava =="
cat "$OUT/mock.log"
