# Activer la compilation automatique (GitHub Actions)

## Pourquoi l'agent ne peut pas le faire lui-même

Toutes les requêtes GitHub sortant de l'environnement de l'agent sont interceptées
et **ré-authentifiées avec le jeton de l'application Arena** (un « GitHub App »).
Un jeton personnel fourni dans la conversation n'est donc jamais utilisé : même une
requête avec un jeton volontairement faux renvoie l'identité du propriétaire du dépôt.

Conséquence : les écritures dans `.github/workflows/` échouent avec l'erreur de
l'application Arena —

```
refusing to allow a GitHub App to create or update workflow
`.github/workflows/…` without `workflows` permission
```

— **même si votre jeton personnel possède bien `Workflows: Read and write`**.
Ce n'est pas un problème de droits de votre côté.

Il reste donc **une seule action à faire à la main** : créer le fichier de workflow
dans `.github/workflows/`. Elle prend deux minutes et ne demande aucune compilation.

---

## La manipulation (sans copier-coller)

Le workflow est prêt ici :
`qring-strava-bridge/ci/qring-strava-bridge-build.yml`

1. Ouvrir ce lien (branche de travail) :
   <https://github.com/J055ELIN/Tomtom/blob/arena/20770d9e-tomtom/qring-strava-bridge/ci/qring-strava-bridge-build.yml>

2. Cliquer sur le **crayon ✏️** (Edit this file).

3. En haut de l'éditeur, cliquer sur le **nom du fichier** affiché
   (`qring-strava-bridge/ci/qring-strava-bridge-build.yml`) et le remplacer par :

   ```
   .github/workflows/qring-strava-bridge-build.yml
   ```

   GitHub crée les dossiers manquants automatiquement. **Ne rien changer au contenu.**

4. Descendre, choisir **« Commit directly to the `arena/20770d9e-tomtom` branch »**,
   puis **Commit changes**.

C'est tout. Le dépôt contient déjà `.github/workflows/` : le fichier y est simplement
déplacé, vous n'avez aucun texte à saisir.

### Déclenchement

Le workflow se déclenche **tout seul** : sa règle `on.push.paths` contient le chemin
`.github/workflows/qring-strava-bridge-build.yml`, et la branche `arena/**` est
surveillée. Le commit que vous venez de faire est donc un événement `push` valide.

Si l'onglet **Actions** n'affiche rien après une minute :

1. aller dans **Actions** → colonne de gauche → **« QRing Strava Bridge — build & test »** ;
2. bouton **Run workflow** → branche `arena/20770d9e-tomtom` → **Run workflow**.

> Cas particulier : si vous préférez committer sur `main`, le déclenchement automatique
> n'aura pas lieu (aucun push n'est fait sur `main`) ; utilisez alors le bouton
> **Run workflow** en choisissant la branche `arena/20770d9e-tomtom`.

---

## Ce que le workflow produit

| Job | Durée | Résultat |
|---|---|---|
| `build` | ~4 min | compile l'APK avec Gradle 8.7 + AGP 8.5.2 + SDK 34, publie l'artefact **`qring-apk`** |
| `emulateur` (API 30 **et** 33) | ~12 min | installe l'APK, accorde les permissions, lance le **mode simulation**, vérifie l'absence de crash et l'affichage de la FC ; publie **`qring-test-api30`** / **`qring-test-api33`** (captures d'écran, `ui1.xml`, `ui2.xml`, `logcat.txt`) |

Téléchargement : onglet **Actions** → cliquer sur le run → section **Artifacts** en bas
de page (les artefacts sont des `.zip`).

## Ce que cela ne remplace pas

Aucun émulateur ne possède de Bluetooth : le CI prouve que l'application **compile,
se lance, affiche la FC et publie sa notification**, mais **pas** la liaison réelle
bague ↔ Strava. Cette dernière étape ne peut être faite que sur votre Pixel 9a
(voir `README.md` §3 et `scripts/device-check.sh`).
