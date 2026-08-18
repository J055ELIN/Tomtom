# 🧪 Tester ANGi avec GitHub Actions (émulateur Android réel)

Ce dossier contient tout le nécessaire pour tester **`ANGi-v1.1.apk`** sur un
**vrai émulateur Android** hébergé par **GitHub Actions**, via l'action officielle
[ReactiveCircus/android-emulator-runner](https://github.com/ReactiveCircus/android-emulator-runner).

## Pourquoi GitHub Actions ?

| | Ce sandbox | GitHub Actions |
|---|---|---|
| Accélération (KVM) | ❌ non | ✅ **oui** |
| CPU / RAM | 1 cœur / 1,8 Go | 2-4 cœurs / 7 Go |
| Boot Android | ~40 min, instable | **2-3 min**, stable |
| Résultat | impossible à stabiliser | **captures + logs téléchargeables** |

→ C'est LA solution pour tester sans téléphone.

## Prérequis (5 minutes)

1. **Un compte GitHub** (gratuit).
2. Créer un dépôt **privé** : https://github.com/new → nom `angi-test` → Create repository.
   (Privé recommandé : l'APK et les logs ne sont pas publics.)
3. Copier les fichiers suivants dans le dépôt (structure ci-dessous) :

```
angi-test/
├── .github/
│   ├── workflows/
│   │   └── angi-test.yml        ← le workflow
│   └── scripts/
│       └── ui_tap.py            ← clic automatique sur l'UI
├── ANGi-v1.1.apk                ← copier depuis /home/user/work/ANGi-v1.1.apk
└── README.md                    ← (facultatif)
```

4. Pousser :
```bash
git init
git add .
git commit -m "Test ANGi v1.1"
git branch -M main
git remote add origin https://github.com/<TON_COMPTE>/angi-test.git
git push -u origin main
```
⚠️ Si `git push` demande un mot de passe : créer un **Personal Access Token**
(GitHub → Settings → Developer settings → Personal access tokens → Fine-grained,
permission **Contents: Read and write**) et l'utiliser comme mot de passe.

## Lancer le test

1. Sur GitHub → onglet **Actions** → workflow **« Test ANGi sur émulateur »**.
2. Bouton **« Run workflow »** (ou simplement attendre le push, le workflow se lance tout seul).
3. Attendre ~10-15 min (téléchargement de l'image Android + boot + tests).
4. Ouvrir le run terminé → section **Artifacts** → télécharger **tests-api30.zip**.

## Ce que le test vérifie (et ce que tu récupères)

| Vérification | Artefact |
|---|---|
| L'app s'installe et **ne crashe pas** au lancement | `logcat.txt` (recherche FATAL/NPE) |
| Écran d'accueil ANGi affiché | `ecran_accueil.png` + `ui_accueil.xml` (texte de l'UI) |
| Navigation Réglages → Contacts d'urgence | `ecran_reglages.png`, `ecran_contacts.png` + XML |
| **Journal de debug de l'app** (SYS, SMS, CONTACTS…) | `angi_debug.txt` (= contenu de Téléchargements/ANGi_debug.log) |
| Crash/ANR dans logcat | `logcat.txt` |

**Que faire des résultats** : envoyer le zip (ou les fichiers) à l'agent — il pourra lire
les captures (OCR), analyser le journal ANGi et corriger l'APK en conséquence.

## Tester aussi Android 13 (Pixel 9a)

Dans `.github/workflows/angi-test.yml`, décommenter la ligne :
```yaml
        # api-level: [30, 33]
```
→ le workflow tournera sur API 30 **et** API 33 (deux runs parallèles).

## Modifier le test

- Le test est un « smoke test » : lancement + navigation + logs.
- Pour ajouter une étape (ex. déclencher le mode test ANGi, vérifier un SMS) :
  éditer la section `script:` du workflow (commandes adb classiques).
- Les numéros de téléphone de test (SMS) ne sont pas simulables sur l'émulateur :
  le test vérifie que le **chemin de code** est exécuté (le journal `SMS` montre
  l'envoi tenté + l'échec éventuel sans SIM — comportement attendu).

## Coût

GitHub Actions gratuit : 2000 minutes/mois sur dépôts privés (un run ≈ 15 min),
illimité sur dépôts publics. Largement suffisant.

---

⚠️ Le keystore et les identifiants ne doivent **jamais** être poussés sur GitHub
(ils sont déjà exclus : ne pas copier `specializedride.jks` dans ce dépôt).
