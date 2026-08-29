#!/usr/bin/env bash
# PUSH-tomtom.sh - Pousser la branche de ce repertoire sur ton depot, lancer le
# workflow, puis suivre le build.  Trois modes :
#
#   ./PUSH-tomtom.sh --dry-run     affiche les commandes, ne fait rien (testable hors connexion)
#   GH_TOKEN=… ./PUSH-tomtom.sh   pousse + declenche  (token requis : Contents write + Actions write)
#   ./PUSH-tomtom.sh --watch       suit l'avancee SANS token (les runs d'un depot public sont lisibles)
#
# Le token : cree un PAT fine-grained limite AU DEPOT Tomtom, droits "Contents: Read and
# write" + "Actions: Read and write", expiration 1 jour.  Ne reutilise pas le token de la
# SOP (il est d'ailleurs mort : 401 sur /user) et ne le colle dans aucun document partage.
set -uo pipefail

REPO="${REPO:-J055ELIN/Tomtom}"
BRANCH="${BRANCH:-vlc-sftp-build}"
WF="${WF:-vlc-android-sftp.yml}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ABI="${ABI:-arm64}"; REF="${VLC_ANDROID_REF:-master}"; PROBE="${PROBE_SERVER:-}"

red() { sed "s/${GH_TOKEN:-__none__}/***REDACTE***/g"; }

if [ "${1:-}" = "--dry-run" ]; then
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
git -C "$HERE" push -f "https://x-access-token:$GH_TOKEN@github.com/$REPO.git" "HEAD:$BRANCH" 2>&1 | red | sed 's/^/   /'

echo "3/3 declenchement du workflow"
resp=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -X POST -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/workflows/$WF/dispatches" \
    -d "{\"ref\":\"$BRANCH\",\"inputs\":{\"abi\":\"$ABI\",\"vlc_android_ref\":\"$REF\",\"probe_server\":\"$PROBE\"}}")
echo "   dispatch -> HTTP $resp $([ "$resp" = 204 ] && echo "(accepte)" || echo "(ECHEC : verifie le nom du workflow et les droits Actions)")"
echo
echo "Suivre sans token :  ./PUSH-tomtom.sh --watch"
echo "En direct        :  https://github.com/$REPO/actions"
