#!/usr/bin/env bash
# PUSH-tomtom.sh - Pousser la branche de ce repertoire sur ton depot, lancer le
# workflow, puis suivre le build.  Modes :
#
#   ./PUSH-tomtom.sh --dry-run     affiche les commandes, ne fait rien (testable hors connexion)
#   GH_TOKEN=… ./PUSH-tomtom.sh   pousse + declenche  (token requis : Contents write + Actions write)
#   ./PUSH-tomtom.sh --watch       suit l'avancee SANS token (les runs d'un depot public sont lisibles)
#   ./PUSH-tomtom.sh --ref=master  construit la 4.x au lieu de la 3.7.1 par defaut
#
# Le defaut de --ref est lu dans .github/workflows/$WF (pas copie ici) : les deux ne peuvent
# donc pas diverger.  Si la ref n'existe pas, le clone echoue ; si l'arbre du core ne correspond
# a aucun des deux patchs, l'etape "correction appliquee" du workflow sort en erreur au lieu de
# publier un APK non corrige.
#
# Le token : cree un PAT fine-grained limite AU DEPOT Tomtom, droits "Contents: Read and
# write" + "Actions: Read and write", expiration 1 jour.  Ne reutilise pas le token de la
# SOP (il est d'ailleurs mort : 401 sur /user) et ne le colle dans aucun document partage.
set -uo pipefail

# JAMAIS d'invite interactive : sans GH_TOKEN le push doit echouer tout de suite plutot que
# de rester bloque sur "Username for 'https://github.com':" (mesure : sans cette ligne, le
# script partait dans 'git push' et se pendait 300 s).
export GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true SSH_ASKPASS=/bin/true

REPO="${REPO:-J055ELIN/Tomtom}"
BRANCH="${BRANCH:-vlc-sftp-build}"
WF="${WF:-vlc-android-sftp.yml}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WF_FILE="$HERE/.github/workflows/$WF"
ABI="${ABI:-arm64}"; PROBE="${PROBE_SERVER:-}"

# La version de vlc-android a construire n'est PAS dupliquee ici : on lit le defaut reel du
# workflow, pour que le dispatch et le YAML ne puissent pas diverger (sinon on croirait lancer
# une 3.7.1 et on lancerait en fait autre chose).  Overrides : VLC_ANDROID_REF=... ou --ref=...
workflow_default_branch() {
    curl -s -m 20 "https://api.github.com/repos/$REPO" 2>/dev/null \
        | python3 -c "import json,sys;print(json.load(sys.stdin).get('default_branch','?'))" 2>/dev/null || echo "?"
}

workflow_default() {
    [ -f "$WF_FILE" ] || return 1
    local v
    v=$(awk '/vlc_android_ref/{f=1;next} f&&/default:/{gsub(/[ "'"'"']/,"",$2); print $2; exit}' "$WF_FILE")
    [ -n "$v" ] || return 1
    printf '%s' "$v"
}
REF="${VLC_ANDROID_REF:-$(workflow_default || true)}"
[ -n "$REF" ] || REF=3.7.1
# --ref= X ou --ref X, accepte en n'importe quelle position ; le premier argument non option
# reste le mode (--dry-run / --watch).
ARGS=(); MODE=""; SKIP=0
for ((i=1;i<=$#;i++)); do
    a="${!i}"
    if [ "$SKIP" = 1 ]; then SKIP=0; continue; fi
    case "$a" in
        --ref=*)  REF="${a#--ref=}" ;;
        --ref)    REF="${@:i+1:1}"; SKIP=1; [ -n "$REF" ] || { echo "--ref attend une valeur (ex. --ref=3.7.1 ou --ref master)" >&2; exit 2; } ;;
        --dry-run|--watch|--help|-h) [ -z "$MODE" ] && MODE="$a" ;;
        *) ARGS+=("$a") ;;
    esac
done

red() { sed "s/${GH_TOKEN:-__none__}/***REDACTE***/g"; }

if [ "$MODE" = "--help" ] || [ "$MODE" = "-h" ]; then
    awk 'NR>1 && /^#/{sub(/^# ?/,""); print; next} NR>1{exit}' "$0"
    exit 0
fi

if [ "$MODE" = "--dry-run" ]; then
    echo "commands that would run (repo $REPO, branch $BRANCH) :"
    cat <<EOF
  git -C "$HERE" push https://x-access-token:\$GH_TOKEN@github.com/$REPO.git HEAD:$BRANCH

  curl -s -X POST -H "Authorization: Bearer \$GH_TOKEN" -H "Accept: application/vnd.github+json" \\
    https://api.github.com/repos/$REPO/actions/workflows/$WF/dispatches \\
    -d '{"ref":"$BRANCH","inputs":{"abi":"$ABI","vlc_android_ref":"$REF","probe_server":"$PROBE"}}'

  # puis, sans token (depot public) :
  curl -s https://api.github.com/repos/$REPO/actions/runs?per_page=1
  curl -s https://api.github.com/repos/$REPO/actions/workflows/$WF   # etat: active ?
EOF
    echo
    echo "contenu qui sera pousse :"
    ( cd "$HERE" && git ls-files | sed 's/^/  /' )
    echo "commit : $(git -C "$HERE" log --oneline -1)"
    echo "base vlc-android demandee : $REF   (lu dans le defaut du workflow : $(workflow_default || echo 'indecidable'))"
    exit 0
fi

if [ "${1:-}" = "--watch" ]; then
    echo "suivi de $REPO / $WF (lecture publique, aucun token)"
    for i in $(seq 1 40); do
        curl -s -m 25 "https://api.github.com/repos/$REPO/actions/runs?per_page=3" -o /tmp/runs.json
        python3 - <<'PY'
import json,datetime
d=json.load(open('/tmp/runs.json'))
rs=[r for r in d.get("workflow_runs",[]) if "vlc-android-sftp" in (r.get("name") or "")]
if not rs: print("  aucun run 'vlc-android-sftp' pour l'instant"); raise SystemExit
r=rs[0]
el=int((datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.strptime(r["updated_at"],"%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)).total_seconds())
print(f"  [{r['status']:11}] {str(r['conclusion']):9} depuis {el//60} min | branche {r['head_branch']} | {r['html_url']}")
try:
    jobs=json.load(open('/tmp/jobs.json'))["jobs"]
    for p in jobs: print(f"     - {p['name'][:44]:46} {p['status']:9} {str(p['conclusion'])}")
except Exception: pass
PY
        curl -s -m 25 "https://api.github.com/repos/$REPO/actions/runs/$(python3 -c "
import json;d=json.load(open('/tmp/runs.json'))
rs=[r for r in d.get('workflow_runs',[]) if 'vlc-android-sftp' in (r.get('name') or '')]
print(rs[0]['id'] if rs else 0)")/jobs" -o /tmp/jobs.json
        st=$(python3 -c "
import json;d=json.load(open('/tmp/runs.json'))
rs=[r for r in d.get('workflow_runs',[]) if 'vlc-android-sftp' in (r.get('name') or '')]
print(rs[0]['status'] if rs else 'none')")
        [ "$st" = "completed" ] && { echo "  Termine."; break; }
        sleep 45
    done
    exit 0
fi

[ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN requis (ou --dry-run / --watch)"; exit 9; }
echo "1/3 verification du token"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$REPO")
echo "   GET /repos/$REPO -> HTTP $code"
[ "$code" = 200 ] || { echo "   token invalide ou sans acces au depot"; exit 8; }
perm=$(curl -s -m 20 -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$REPO" | python3 -c "import json,sys;print(json.load(sys.stdin).get('permissions',{}).get('push'))")
[ "$perm" = "True" ] || { echo "   ce token n'a pas le droit d'ecrire (permissions.push=$perm)"; exit 8; }

echo "2/3 poussée de la branche $BRANCH"
SHA=$(git -C "$HERE" rev-parse HEAD)
git -C "$HERE" push -f "https://x-access-token:$GH_TOKEN@github.com/$REPO.git" "HEAD:$BRANCH" > /tmp/push.$$.log 2>&1
prc=$?
red < /tmp/push.$$.log | sed 's/^/   /'; rm -f /tmp/push.$$.log
[ $prc -eq 0 ] || { echo "   la poussee a echoue (code $prc) -> on ne declenche rien" >&2; exit 8; }
echo "   poussee ok : $BRANCH @ ${SHA:0:9}"

echo "3/3 declenchement du workflow"
# Un workflow qui ne vit QUE sur une branche non par defaut ne peut PAS etre declenche par
# /dispatches : GitHub ne liste pour workflow_dispatch que les fichiers presents sur la branche
# par defaut. Mesure ici : POST -> HTTP 404 alors que le fichier etait sur la branche poussee.
# D'ou le declencheur 'push' dans le YAML : la poussee SUISANTE demarre le run, et ce bloc-la
# attend ce run plutot que de pretendre a un dispatch impossible.
HAS_PUSH=0
if [ -f "$WF_FILE" ] && grep -q '^  push:' "$WF_FILE" && grep -q "branches: \[$BRANCH\]" "$WF_FILE"; then
    HAS_PUSH=1
fi
if [ "$HAS_PUSH" = 1 ]; then
    echo "   le YAML declare 'push' sur $BRANCH : on attend le run cree par cette poussee (sha ${SHA:0:9})"
    run=""
    for i in $(seq 1 20); do
        sleep 3
        run=$(curl -s -m 20 "https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA&per_page=20" \
            | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: raise SystemExit(0)
for r in d.get('workflow_runs',[]):
    if '$WF' in r.get('path','') or r.get('name','').lower().startswith('vlc android sftp'):
        print(f\"#{r['run_number']} {r['status']}/{r.get('conclusion')} {r['html_url']}\"); break
")
        [ -n "$run" ] && break
    done
    if [ -n "$run" ]; then
        echo "   run demarre : $run"
        echo
        echo "Suivre sans token :  ./PUSH-tomtom.sh --watch"
        echo "En direct        :  https://github.com/$REPO/actions"
        exit 0
    fi
    echo "   aucun run vu pour ce sha apres ~60 s (GitHub peut mettre 1-2 min) : on tente le dispatch"
fi
resp=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -X POST -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/workflows/$WF/dispatches" \
    -d "{\"ref\":\"$BRANCH\",\"inputs\":{\"abi\":\"$ABI\",\"vlc_android_ref\":\"$REF\",\"probe_server\":\"$PROBE\"}}")
if [ "$resp" = 204 ]; then
    echo "   dispatch -> HTTP 204 (accepte)"
elif [ "$resp" = 404 ]; then
    echo "   dispatch -> HTTP 404. Ce n'est PAS un souci de droits : workflow_dispatch n'est"
    echo "     proposable que si $WF existe aussi sur la branche par defaut ($( workflow_default_branch ))."
    echo "     Deux issues : (a) le YAML declare un declencheur 'push' sur $BRANCH, donc une poussee"
    echo "     suffit ; (b) ou tu fusionnes le fichier sur la branche par defaut - a ne faire que si"
    echo "     tu l'as decide, car ici la branche par defaut sert $REPO de canal de mise a jour."
else
    echo "   dispatch -> HTTP $resp (verifie le nom du workflow et les droits Actions)"
fi
echo
echo "Suivre sans token :  ./PUSH-tomtom.sh --watch"
echo "En direct        :  https://github.com/$REPO/actions"
