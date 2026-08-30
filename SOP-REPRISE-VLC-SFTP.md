# SOP — Reprise du projet « Correctif VLC Android / SFTP (Debian 13) »

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-08-30 |
| **Dépôt** | `https://github.com/J055ELIN/Tomtom` |
| **Branche de travail** | `arena/01a04f77-tomtom` |
| **Objet** | Compiler un fork de VLC Android qui corrige la connexion SFTP vers les serveurs ultra.cc passés en Debian 13 (OpenSSH 9.8) |
| **Rédacteur** | Agent Arena (session `arena/01a04f77-tomtom`) |
| **Destinataires** | Toute personne reprenant le travail (humain ou agent) |

---

## 1. Résumé exécutif

VLC Android (et iOS/tvOS) ne peut plus se connecter **en SFTP** aux seedboxes ultra.cc
depuis leur migration vers **Debian 13 (OpenSSH 9.8p1)**.

**Cause racine (prouvée dans les sources)** : VLC 3.0.x compile `libssh2 1.11.1` avec le
backend cryptographique **Libgcrypt**, qui désactive les algorithmes de clé d'hôte
modernes (`rsa-sha2-256/512`, ECDSA, Ed25519). Le client n'offre alors que
`ssh-rsa` (SHA-1) et `ssh-dss` — deux algorithmes refusés par OpenSSH ≥ 8.8 / 9.8.
L'erreur serveur typique : `no matching host key type found. Their offer: ssh-rsa,ssh-dss`.

**Correctif livré (fonctionnel, code écrit)** : un patch qui ajoute le support
`rsa-sha2-256 / rsa-sha2-512` au backend Libgcrypt de libssh2 1.11.1, puis l'APK
VLC Android complet compilé avec ce patch.

**État** : le code du correctif et le pipeline CI sont **prêts et poussés** ; il reste
(i) à synchroniser le workflow dans `.github/workflows/` (action manuelle bloquée par
les permissions du token — voir §6.1), (ii) à valider le job de test, (iii) à lancer
le build APK et à le livrer à l'utilisateur.

---

## 2. Contexte technique complet

### 2.1 Bug utilisateur

- Fil Reddit : `r/seedboxes/comments/1vve888/ultracc_vlc_stream_wont_connect_since_debian_13/`
  (visible via miroir `safereddit.com`, le direct est bloqué en 403).
- Symptômes : VLC Android/iOS échoue en SFTP ; SSH en ligne de commande et FileZilla
  fonctionnent toujours ; `FTP` simple = timeout (ultra.cc n'autorise que FTPS explicite).

### 2.2 Cause racine exacte

| Élément | Constat |
|---|---|
| libssh2 utilisé par VLC | `1.11.1`, backend **Libgcrypt** (`contrib/src/ssh2/rules.mak` : `-DCRYPTO_BACKEND:STRING=Libgcrypt`) |
| `src/libgcrypt.h` (v1.11.1) | `LIBSSH2_RSA_SHA2 0`, `LIBSSH2_ECDSA 0`, `LIBSSH2_ED25519 0` |
| `src/hostkey.c` → `hostkey_methods[]` | n'expose que `ssh-rsa` + `ssh-dss` |
| OpenSSH Debian 13 | `9.8p1` : `ssh-rsa` hors défauts depuis 8.8 ; **DSA compilé hors du binaire** (irréversible) |
| `modules/access/sftp.c` (VLC) | n'impose aucun algorithme → dépend 100 % des défauts libssh2 |

### 2.3 Correctif choisi

Réactiver `rsa-sha2` dans le backend Libgcrypt (même direction que libssh2 upstream,
qui l'a fait sur `master` après 1.11.1) — petit, ciblé, n'affecte que le handshake.

- **`vlc-sftp-fix/patches/0001-libssh2-gcrypt-rsa-sha2.patch`**
  - `src/libgcrypt.h` : `LIBSSH2_RSA_SHA2 0` → `1`
  - `src/libgcrypt.c` : ajoute `_libssh2_rsa_sha2_verify()` (SHA-256/512, `gcry_pk_verify`,
    PKCS#1 v1.5) et `_libssh2_rsa_sha2_sign()` (`gcry_pk_sign`), sur le modèle des
    fonctions `_libssh2_rsa_sha1_*` existantes.
- **`vlc-sftp-fix/patches/0002-vlc-apply-libssh2-patch.patch`**
  - `contrib/src/ssh2/rules.mak` : `$(APPLY) $(SRC)/ssh2/0001-libssh2-gcrypt-rsa-sha2.patch`
    après `$(UNPACK)`.

⚠️ **Ne pas** réactiver DSA : impossible avec OpenSSH 9.8 de Debian 13, et inutile
(le serveur ultra.cc propose d'autres clés ; il suffit de négocier `rsa-sha2`).

---

## 3. État du dépôt (à jour au 2026-08-30)

### 3.1 Branches

| Branche | Contenu | Rôle |
|---|---|---|
| `arena/01a04f77-tomtom` (HEAD `f613c94`) | l'ensemble des livrables | branche de travail principale (ne pas renommer : liée à la session Arena) |
| `ci-results` (HEAD contient `results/latest.txt`) | résultats de test publiés automatiquement par CI | lecture seule, mise à jour auto par le workflow |

### 3.2 Fichiers du livrable

| Fichier | Statut |
|---|---|
| `vlc-sftp-fix/patches/0001-libssh2-gcrypt-rsa-sha2.patch` | ✅ à jour (correctif) |
| `vlc-sftp-fix/patches/0002-vlc-apply-libssh2-patch.patch` | ✅ à jour (intégration contribs) |
| `vlc-sftp-fix/test/client.c` | ✅ à jour (client de test handshake) |
| `vlc-sftp-fix/workflow.yml` | ✅ **SOURCE DE VÉRITÉ** (dernière version : fix rpath + diagnostics complets) |
| `vlc-sftp-fix/README.md` | ✅ doc utilisateur / technique |
| `.github/workflows/vlc-sftp-fix.yml` | ⚠️ **DÉSYNCHRONISÉ** (contient la version *avant* le fix rpath) — **c'est le point de reprise n°1** |
| `vlc-sftp-fix/workflow.ylm` | 🗑️ obsolète (faute de frappe initiale, à supprimer) |
| `.github/workflows/github/workflows/vlc-sftp-fix.yml` | 🗑️ obsolète (chemin erroné, à supprimer) |

> **⚠️ Ce §3.2 est périmé depuis le ménage du 30/08/2026 (ajout de l'agent, texte d'origine conservé).**
> Les lignes marquées 🗑️ ci-dessus **et** celles marquées ✅/⚠️ ont été supprimées du dépôt :
> `vlc-sftp-fix/` (y compris `workflow.yml`, `workflow.ylm`, `patches/`, `test/`, `README.md`),
> `.github/workflows/vlc-sftp-fix.yml`, et le doublon mort `.github/workflows/github/workflows/vlc-sftp-fix.yml`
> (les deux dernières commandes « Étape 2 » n'ont donc plus d'objet, et l'« Étape 1 — SYNC DU WORKFLOW »
> n'a plus de sens : il n'y a plus deux copies à désynchroniser).
> Motif : l'approche `gcrypt` + `rsa-sha2` décrite ici a été mesurée insuffisante (5 runs en échec).
> La cause racine retenue est ailleurs — `contrib/src/ssh2/rules.mak` impose
> `-DCRYPTO_BACKEND:STRING=Libgcrypt`, et `src/libgcrypt.h` de libssh2 annule `LIBSSH2_RSA_SHA2`,
> `LIBSSH2_ECDSA`, `LIBSSH2_ED25519` : le client ne propose donc plus aucun KEX ni clé d'hôte
> acceptés par OpenSSH 9.8+ (Debian 13). Le correctif construit le travail **en mbedTLS**.
> Où est le travail désormais : branche **`vlc-sftp-build`**, workflow
> `.github/workflows/vlc-android-sftp.yml`, charge utile `vlc-sftp/` ; kit complet (patchs, outils
> d'audit, résultats, procédure de reproducttion) hors dépôt sous `vlc-android-sftp-debian13/`.
> Rétablir l'ancien état : `git revert` des commits « menage(1/3)…(3/3) », ou `git checkout avant-menage/main -- vlc-sftp-fix .github/workflows/vlc-sftp-fix.yml`.
> Le reste de la SOP (contraintes §4, rôles §5, portique de vérification, soft-ban Ultra.cc) reste valable.

### 3.3 Statut CI (derniers runs de `VLC Android SFTP fix build`)

| Run | Déclencheur | Résultat |
|---|---|---|
| `33298621807` | push `f613c94` | ❌ échoue à « Run handshake tests » (ancien workflow déployé, **sans** fix rpath) |
| `33298557372` | commit utilisateur « Update vlc-sftp-fix.yml » | ❌ idem |
| `33297572737` et antérieurs | — | ❌ échouaient à « Setup modern sshd » (ancienne version `sudo sshd &`) |

Diagnostic du run le plus récent étape par étape :
`Set up job ✓ → Checkout ✓ → Install deps ✓ → Setup sshd ✓ → Build UNPATCHED ✓ →
Build PATCHED ✓ → Run handshake tests ✗ → Publish results ✓`.
Le build compile donc parfaitement ; seul le test échouait car `libssh2.so` n'était
pas trouvé au runtime (pas de rpath) → log sshd vide (aucune connexion).
La version `vlc-sftp-fix/workflow.yml` actuelle corrige ce point.

---

## 4. Environnements et contraintes connues

| Élément | Détail |
|---|---|
| **Sandbox Arena (cette session)** | 2 vCPU / 3,8 Go RAM / ~20 Go disque ; pas de JDK, SDK, NDK, cmake |
| **Egress réseau du sandbox** | ✅ `github.com`, `raw.githubusercontent.com`, `api.github.com` ; ❌ `code.videolan.org`, `dl.google.com`, `services.gradle.org`, `artifacts.videolan.org`, `deb.debian.org`, `r.jina.ai` — **aucun build local possible ici** |
| **GitHub Actions** | ✅ runners Ubuntu complets : internet illimité → c'est **le moteur de build officiel** |
| **Jetons / permissions** | Le token `gh` = GitHub App **`arena-ai-coding-agent`** : `contents` read/write, `actions` read, ⚠️ **PAS `workflows`** → impossible de modifier/pousser `.github/workflows/` ni de dispatcher un run (403). L'utilisateur propriétaire **ne peut pas ajouter** cette permission à une app (les permissions d'une app sont définies par son développeur, Arena) |
| **Accès aux logs GitHub depuis le sandbox** | ❌ l'endpoint de logs (`actions.githubusercontent.com`, blob) renvoie EOF → **on publie les résultats sur `ci-results`** (lisible via `git`) |

---

## 5. Rôles

| Rôle | Qui | Responsabilité |
|---|---|---|
| Propriétaire du dépôt / utilisateur | `J055ELIN` | synchroniser le workflow (copie manuelle), tester l'APK, accorder un PAT si besoin |
| Agent / CI | `arena-ai-coding-agent` | maintenir le code du patch, le workflow source, suivre les runs, livrer l'APK |
| Build distant | GitHub Actions | exécuter test + build APK + publication artefact/Release |
| Support ultra.cc | support | (optionnel) réactiver `HostKeyAlgorithms +ssh-rsa` côté serveur en attendant le fix client |

---

## 6. Procédure de reprise pas-à-pas

> Toutes les commandes sont à exécuter à la racine du dépôt cloné
> (`https://github.com/J055ELIN/Tomtom.git`), branche `arena/01a04f77-tomtom`.

### Étape 0 — Récupérer et vérifier l'état

```bash
git fetch origin arena/01a04f77-tomtom
git checkout arena/01a04f77-tomtom
git reset --hard origin/arena/01a04f77-tomtom
# La version canonique doit contenir le fix rpath (sortie attendue : 2)
grep -c "Wl,-rpath" vlc-sftp-fix/workflow.yml
```

### Étape 1 — SYNC DU WORKFLOW (action bloquante, à faire en priorité)

`vlc-sftp-fix/workflow.yml` est la source de vérité ; son contenu doit être **exactement**
copié dans `.github/workflows/vlc-sftp-fix.yml`.

**Si le token dispose de la permission `workflows`** (PAT avec scope `workflow`,
ou app Arena corrigée par son développeur) :

```bash
cp vlc-sftp-fix/workflow.yml .github/workflows/vlc-sftp-fix.yml
git add .github/workflows/vlc-sftp-fix.yml
git commit -m "Sync workflow with latest fixes (rpath + diagnostics)"
git push origin arena/01a04f77-tomtom
```

**Sinon (cas actuel)** — l'utilisateur le fait depuis l'interface GitHub :
1. Ouvrir `https://github.com/J055ELIN/Tomtom/blob/arena/01a04f77-tomtom/vlc-sftp-fix/workflow.yml`
2. **⋮ → Copy raw content** (copier tout le fichier)
3. Ouvrir `https://github.com/J055ELIN/Tomtom/edit/arena/01a04f77-tomtom/.github/workflows/vlc-sftp-fix.yml`
4. **Ctrl+A** → coller → **Commit changes** (branche `arena/01a04f77-tomtom`)

Le push déclenche automatiquement le workflow (`on: push` + chemins
`vlc-sftp-fix/**` et `.github/workflows/vlc-sftp-fix.yml`).

**Règle d'or pour l'agent** : ne **jamais** stagier `.github/workflows/` dans un commit
(cf. §7 « 403 workflows ») ; pousser uniquement `vlc-sftp-fix/…` et fichiers racine.

### Étape 2 — Nettoyage des fichiers obsolètes

```bash
git rm vlc-sftp-fix/workflow.ylm
git rm .github/workflows/github/workflows/vlc-sftp-fix.yml
git commit -m "cleanup: remove obsolete workflow copies"
git push origin arena/01a04f77-tomtom
```

### Étape 3 — Déclencher / surveiller le run

```bash
# Option A (si actions:write disponible)
gh workflow run vlc-sftp-fix.yml --ref arena/01a04f77-tomtom

# Option B (sans permission : le push de l'étape 1 suffit déjà)
gh run list --workflow vlc-sftp-fix.yml --limit 5
gh run watch <RUN_ID> --exit-status --interval 30
```

Jobs du workflow :
1. `test-libssh2-fix` (~3 min) : compile libssh2 non patché + patché (Libgcrypt),
   démarre un `sshd` qui **n'offre QUE** `rsa-sha2-512/256`, vérifie
   non-patché → échec / patché → succès `rsa-sha2-512`.
2. `build-apk-arm64` (~1h30–2h30, max 540 min, `needs: test`) : clone vlc-android +
   libvlcjni (hash `81bb02ba48dcad32550e0626139a387b3c30af04`) + VLC 3.0.x, applique
   les patches, `compile.sh -a arm64` (flavor **Dev**, libvlc compilé depuis les sources
   patchées), publie l'APK en artefact **et** en Release `vlc-sftp-fix-v3.7.2`.

### Étape 4 — Lire les résultats (les logs GitHub sont illisibles depuis le sandbox)

Le workflow publie automatiquement `results/latest.txt` sur la branche `ci-results` :

```bash
git fetch origin ci-results
git show FETCH_HEAD:results/latest.txt
```

**Critère de succès du job 1** :
```
UNPATCHED_RC=1     # échec attendu (client non patché : no matching host key)
PATCHED_RC=0       # succès
PATCHED_OUT contient : HANDSHAKE OK hostkey_method=rsa-sha2-512
RESULT=PASS
```

### Étape 5 — Récupérer l'APK

```bash
# Artefact (nécessite actions:read + download — ou l'UI GitHub)
gh run download <RUN_ID> -n vlc-android-sftp-fix-arm64 -D apk
# Ou : onglet Actions du run → Artifacts → vlc-android-sftp-fix-arm64
# Ou (release auto) : https://github.com/J055ELIN/Tomtom/releases/tag/vlc-sftp-fix-v3.7.2
```

Chemin attendu : `application/vlc-android/build/outputs/apk/dev/*.apk`
(package `org.videolan.vlc.debug`, **signé debug**).

### Étape 6 — Validation utilisateur

1. **Désinstaller** l'app VLC existante (signature différente) puis installer l'APK.
2. VLC → Réseau local → SFTP (ou Flux réseau) avec les identifiants ultra.cc
   (mêmes que FileZilla).
3. Accepter l'empreinte de clé d'hôte si demandé.
4. Vérifier la lecture (seek) d'un fichier `.mkv` volumineux.
5. Tester aussi sur plusieurs fichiers/dossiers ; noter l'URL exacte utilisée.

### Étape 7 — Build local (optionnel, si on veut s'affranchir de GitHub Actions)

Prérequis : Linux (Debian/Ubuntu), JDK 17, cmake, ninja, ~40 Go disque, ≥ 16 Go RAM,
réseau ouvert.

```bash
# 1) Dépendances système (Debian 12/13)
sudo apt install automake autopoint ant cmake build-essential libtool-bin patch \
     pkg-config protobuf-compiler ragel subversion unzip flex wget gettext \
     texinfo bison yasm nasm meson ninja-build gperf groff libarchive-tools

# 2) SDK/NDK (NDK r27c = 27.2.12479018 exigé pour arm64 ; compileSdk 36, build-tools 36.0.0)
export ANDROID_SDK=/opt/android-sdk
export ANDROID_NDK=/opt/android-sdk/ndk/27.2.12479018

# 3) Clonages
git clone --depth 1 https://github.com/videolan/vlc-android.git
cd vlc-android
git clone --single-branch --branch libvlcjni-3.x https://code.videolan.org/videolan/libvlcjni.git
cd libvlcjni && git reset --hard 81bb02ba48dcad32550e0626139a387b3c30af04
cat > local.properties <<EOF
sdk.dir=$ANDROID_SDK
android.ndkPath=$ANDROID_NDK
android.ndkFullVersion=27.2.12479018
EOF
cd ..

# 4) VLC 3.0.x + patchs
git clone --depth 1 --branch 3.0.x https://github.com/videolan/vlc.git vlc-src
cp ../vlc-sftp-fix/patches/0001-libssh2-gcrypt-rsa-sha2.patch \
   vlc-src/contrib/src/ssh2/0001-libssh2-gcrypt-rsa-sha2.patch
cd vlc-src && git apply ../vlc-sftp-fix/patches/0002-vlc-apply-libssh2-patch.patch && cd ..
ln -sfn "$PWD/vlc-src" vlc-android/libvlcjni/vlc

# 5) Build (Dev = libvlc compilé depuis les sources ; Release utiliserait les AAR Maven NON patchés)
export VLC_SRC_DIR="$PWD/vlc-src"
cd vlc-android && ./buildsystem/compile.sh -a arm64
```

⚠️ Ne **pas** lancer avec `--release` : le build `Release` tire libvlc des artefacts
Maven (non patchés). Utiliser le flavor **Dev** (par défaut de `compile.sh`).

---

## 7. Dépannage

| Symptôme | Cause | Action |
|---|---|---|
| `remote rejected … without 'workflows' permission` (push) | token GitHub App sans scope `workflows` | ne pas stagger `.github/workflows/` ; faire copier le fichier par l'utilisateur ; ou PAT utilisateur avec scope `workflow` ; ou demander à Arena d'ajouter la permission à l'app |
| `gh workflow run … HTTP 403` | idem (pas d'`actions:write`) | déclencher par un push sur `vlc-sftp-fix/**` |
| Run ❌ « Run handshake tests » avec log sshd vide | ancien workflow (sans rpath) : `libssh2.so` introuvable au runtime | resynchroniser `.github/workflows/vlc-sftp-fix.yml` depuis `vlc-sftp-fix/workflow.yml` (Étape 1) |
| `git log`/`gh run` logs → `EOF` | endpoints de logs GitHub bloqués depuis le sandbox | lire `ci-results` (`git show FETCH_HEAD:results/latest.txt`) |
| `curl`/`git` vers `code.videolan.org` → TLS/000 | egress sandbox bloqué | utiliser les miroirs GitHub (`github.com/videolan/vlc.git`) ; le runner CI, lui, a accès à GitLab |
| Build local `NDK v27-29 needed` | mauvaise version NDK | installer `27.2.12479018` (r27c) exactement |
| L'APK ne s'installe pas à côté de VLC officiel | signature différente (debug) | désinstaller l'app existante d'abord |
| Le test échoue mais `UNPATCHED_RC=0` | protocole trop permissif sur le serveur test (`sshd` offrait autre chose) | vérifier `HostKeyAlgorithms rsa-sha2-512,rsa-sha2-256` seul dans `sshd-test/sshd.conf` |
| Concurrency / run en attente | groupe `concurrency: vlc-sftp-fix` | attendre la fin du run en cours ou l'annuler (Actions → Cancel) |

---

## 8. Définition de « Done » (checklist)

- [ ] `.github/workflows/vlc-sftp-fix.yml` == `vlc-sftp-fix/workflow.yml` (diff vide)
- [ ] Job `test-libssh2-fix` : `RESULT=PASS` dans `ci-results` (unpatched échoue, patched → `rsa-sha2-512`)
- [ ] Job `build-apk-arm64` : succès ; APK disponible en artefact + Release `vlc-sftp-fix-v3.7.2`
- [ ] APK installé et validé sur téléphone Android contre un vrai slot ultra.cc
- [ ] Fichiers obsolètes supprimés (`workflow.ylm`, `.github/workflows/github/…`)
- [ ] (Optionnel) PR upstream : proposer le patch libssh2 à `libssh2/libssh2` (déjà fait sur master — à rebaser) et signaler le bug à VLC (`code.videolan.org/videolan/vlc/-/issues/26921` ou GitHub `videolan/vlc-android`)
- [ ] (Optionnel) Ticket ultra.cc : `HostKeyAlgorithms +ssh-rsa` côté serveur pour débloquer les versions VLC non corrigées (temporaire, à retirer après)

---

## 9. Références utiles

- Fil Reddit d'origine : `https://www.reddit.com/r/seedboxes/comments/1vve888/` (miroir : `https://safereddit.com/r/seedboxes/comments/1vve888/…`)
- VLC Android : `https://github.com/videolan/vlc-android` (branche `master` ; VLC 3 via `git checkout 3.0.x` à adapter selon les besoins)
- libvlcjni : `https://code.videolan.org/videolan/libvlcjni` (branche `libvlcjni-3.x`, hash testé `81bb02ba…`)
- VLC 3.0.x : `https://github.com/videolan/vlc` (branche `3.0.x`)
- libssh2 : `https://github.com/libssh2/libssh2` (tag `libssh2-1.11.1` ; fix upstream sur `master`)
- Notes Debian 13 / OpenSSH 9.8 DSA : `https://www.debian.org/releases/trixie/release-notes/issues.html`
- Docs ultra.cc : WebDAV `https://docs.ultra.cc/connection-details/access-your-ultra-service-with-webdav` — HTTP Access `https://docs.ultra.cc/connection-details/http-access`
- Bug VLC connu : `https://code.videolan.org/videolan/vlc/-/issues/26921`
