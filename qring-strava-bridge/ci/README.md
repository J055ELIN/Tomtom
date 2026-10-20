# Activer la compilation automatique (GitHub Actions)

Le dossier `.github/workflows/` ne peut pas être modifié par l'agent de cette session
(le jeton GitHub utilisé n'a pas la permission **Workflows**). Le workflow est donc
prêt ici : `qring-strava-bridge/ci/qring-strava-bridge-build.yml`.

## Option A — 2 minutes, sans rien installer (recommandé)

1. Ouvrir le fichier :
   <https://github.com/J055ELIN/Tomtom/blob/main/qring-strava-bridge/ci/qring-strava-bridge-build.yml>

   > Si votre dépôt n'a pas encore ce fichier sur `main`, utilisez la branche :
   > `.../blob/arena/20770d9e-tomtom/qring-strava-bridge/ci/qring-strava-bridge-build.yml`

2. Bouton **✏️ (Edit)** → cliquer sur le **nom du fichier** en haut de l'éditeur et le
   remplacer par :

   ```
   .github/workflows/qring-strava-bridge-build.yml
   ```

   (GitHub crée automatiquement les dossiers `.github/workflows/`.)
   Les 3 lignes de commentaire du début peuvent rester : ce sont des commentaires YAML.

3. **Commit changes** → choisir *« Commit directly to the main branch »*.

4. Onglet **Actions** → à gauche « QRing Strava Bridge — build & test » →
   bouton **Run workflow** → branche **arena/20770d9e-tomtom** → **Run workflow**.

5. Après ~10–15 min, ouvrir le run terminé → section **Artifacts** :
   * `qring-apk` : l'APK compilée par GitHub ;
   * `qring-test-api30` / `qring-test-api33` : captures d'écran + `logcat.txt`
     (preuve que l'app démarre et affiche la FC simulée).

## Option B — donner les droits à l'agent (jeton « fine-grained »)

1. GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. **Repository access** : *Only select repositories* → `J055ELIN/Tomtom`.
3. **Permissions → Repository permissions** :
   * **Contents** : *Read and write*
   * **Workflows** : *Read and write*  ← c'est la permission qui manquait
4. Generate token, puis le transmettre dans la conversation.
5. Révoquer le jeton dès que le travail est terminé (il reste visible dans l'historique).

Avec cette permission, l'agent pousse lui-même
`.github/workflows/qring-strava-bridge-build.yml`, lance le workflow et récupère
l'APK et les captures d'écran.

## Ce que fait le workflow

| Job | Action |
|---|---|
| `build` | `./gradlew :app:assembleDebug` avec JDK 17 + SDK 34, publie l'APK en artefact |
| `emulateur` | installe l'APK sur un émulateur API 30 puis API 33, lance le **mode simulation**, vérifie l'absence de crash et l'affichage de la FC, capture écran + logcat |
