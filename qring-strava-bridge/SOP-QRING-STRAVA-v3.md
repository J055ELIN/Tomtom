# SOP — QRing → Strava HR Bridge (v3.0)

**Date :** 2026-10-20
**Projet :** application Android qui transforme une bague QRing/Colmi en capteur de
fréquence cardiaque BLE standard, détectable par Strava
**Emplacement :** `/home/user/Tomtom/qring-strava-bridge/` (dépôt `J055ELIN/Tomtom`,
branche `arena/20770d9e-tomtom`)
**APK :** `releases/QRingStravaBridge-v3.0.apk` — 37 415 octets, v1 + v2, minSdk 23, targetSdk 34

---

## 1. Résumé exécutif

| Point | v1 (SOP précédent) | v3.0 (ce document) |
|---|---|---|
| Blocage « `openGattServer()` n'existe pas » | considéré comme bloquant | **corrigé : l'API est publique depuis l'API 18**, mauvais point d'entrée utilisé avant |
| Diffusion FC vers Strava | impossible | **implémentée** (service `0x180D`, caractéristique `0x2A37`, publicité BLE) |
| Protocole bague | supposé (`0x1e` seul) | **vérifié octet pour octet** contre `qlam-ai/qring` |
| APK | 34 Ko, non testable | 37 Ko, signée, **compilée et validée** (compilation + DEX + manifeste + signature) |
| Environnement de build | `/opt/sfa-tools` (JDK 21 + SDK) | **absent de ce sandbox** → chaîne de compilation alternative reconstituée (§3) |
| Test matériel | à faire | à faire (le sandbox n'a ni adb ni émulateur KVM) |

---

## 2. Architecture livrée

```
┌────────────────┐   BLE (central)      ┌──────────────────────────────┐   BLE (périphérique)   ┌──────────┐
│ bague QRing /  │  UART Nordique       │  HrBridgeService (FGS)       │   GATT server          │  Strava  │
│ Colmi R02/R06  │  6E40FFF0 / 6E400002 │  ├── RingBleClient  (client) │   0x180D / 0x2A37      │  Wahoo   │
│                │ ───────────────────► │  └── HrmPeripheral  (serveur)│ ─────────────────────► │  Garmin  │
└────────────────┘  0x69 / 0x6A / 0x1E  └──────────────────────────────┘   publicité + notify    └──────────┘
```

* **Un seul service de premier plan** (`connectedDevice` + wake lock) porte les deux rôles BLE
  simultanément : central vers la bague, périphérique vers Strava.
* **Mode test** : FC simulée (62–158 bpm) pour valider la liaison Strava sans bague.

### Fichiers

| Fichier | Lignes | Rôle |
|---|---|---|
| `RingBleClient.java` | ~430 | connexion bague, trames 16 octets, checksum, keep-alive 20 s, relance si silence > 25 s, reconnexion auto |
| `HrmPeripheral.java` | ~470 | `BluetoothManager.openGattServer()`, services FC/batterie/infos, `BluetoothLeAdvertiser`, gestion des abonnements CCCD |
| `HrBridgeService.java` | ~300 | service de premier plan, notification permanente, simulation, wake lock |
| `MainActivity.java` | ~440 | scan filtré (UUID UART ou nom R02/R03/R06/R10/Colmi/QRing), sélection, FC, journal |
| `BridgeState.java`, `Logs.java` | ~120 | état partagé et journal (UI + logcat `QRingBridge`) |

---

## 3. Environnement de compilation : ce qui a changé

### 3.1 Constat

Le sandbox de cette session **n'a ni JDK, ni Android SDK, ni Gradle** (`/opt/sfa-tools`
n'existe pas) et l'accès réseau est limité à `github.com`, `codeload.github.com`,
`api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`
(`dl.google.com`, `services.gradle.org`, `objects.githubusercontent.com` et
`raw.githubusercontent.com` sont bloqués).

### 3.2 Chaîne de compilation reconstituée (100 % hors ligne)

| Besoin | Outil retenu | Provenance |
|---|---|---|
| JVM | **Temurin JRE 25** (`jdk4py`) | PyPI : `pip download jdk4py` → `jdk4py/java-runtime` |
| `android.jar` API 34 | `Sable/android-platforms` → `android-34/android.jar` (26 Mo) | API GitHub blobs (non-LFS) |
| Compilateur Java | **ECJ 4.10** (`ecj-4.10.jar`) | `facebook/buck` → `third-party/java/eclipse/ecj-4.10.jar` |
| `aapt2` (Linux) | aapt2 2.19 | PyPI `aapt2` → `aapt2/bin/Linux/aapt2` |
| `zipalign`, `apksigner.jar`, `aapt` | build-tools 28 (Linux) | PyPI `adapktools` → `adapktools/lib/linux/` |
| Dexer | **dx 1.10** (`dx.jar`) | `hekai/android-sdk-linux` → `build-tools/21.0.1/lib/dx.jar` |
| Validation DEX | `baksmali 2.2.4` | `facebook/buck` (jeu de test smali) |
| Keystore | `keytool` du JRE | généré au premier build |

> **Conséquence importante :** `dx` (2014) ne gère **pas** `invokedynamic`.
> Tout le code a donc été réécrit en **Java 7 strict** (classes anonymes au lieu de lambdas).
> C'est transparent pour l'utilisateur et reste compilable par `javac`/Gradle/d8/R8.
> Si l'on veut revenir aux lambdas : remplacer les classes anonymes par des lambdas et
> compiler avec `javac` + `d8` (les deux sont déjà supportés par `build.sh`).

### 3.3 Commandes exactes utilisées dans ce sandbox

```bash
# outils (une seule fois)
pip download jdk4py --no-deps -d /tmp/jdk        && unzip -q /tmp/jdk/*.whl -d /tmp/jdk/ex
pip download aapt2   --no-deps -d /tmp/pipx      && unzip -q /tmp/pipx/aapt2-*.whl -d /tmp/pipx/aa
pip download adapktools --no-deps -d /tmp/adapt  && tar xzf /tmp/adapt/adApkTools-*.tar.gz -C /tmp/adapt
# android.jar
gh api repos/Sable/android-platforms/git/blobs/<sha> --jq .content | base64 -d > /tmp/sdk/android-34.jar
# ecj, dx, baksmali : idem via l'API blobs (voir SOP historique pour les chemins)

# compilation
cd qring-strava-bridge
env JAVA_HOME=/tmp/jdk/ex/jdk4py/java-runtime \
    ANDROID_PLATFORM=/tmp/sdk/android-34.jar \
    AAPT2=/tmp/pipx/aa/aapt2/bin/Linux/aapt2 \
    ZIPALIGN=/tmp/adapt/adApkTools-1.0.6/adapktools/lib/linux/zipalign \
    APKSIGNER_JAR=/tmp/adapt/adApkTools-1.0.6/adapktools/lib/linux/apksigner.jar \
    ECJ_JAR=/tmp/ecj/ecj.jar DX_JAR=/tmp/dx.jar \
    bash build.sh
```

### 3.4 Avec un vrai SDK (recommandé, chemin B du SOP historique)

```bash
export ANDROID_HOME=/opt/sfa-tools/sdk
export ANDROID_BUILD_TOOLS=$ANDROID_HOME/build-tools/34.0.0
export ANDROID_PLATFORM=$ANDROID_HOME/platforms/android-34/android.jar
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
bash build.sh          # aapt2 + javac + d8 + zipalign + apksigner
# ou : ./gradlew :app:assembleDebug
```

---

## 4. Protocole de la bague (vérifié)

Source de vérité : `qlam-ai/qring` (`packet.py`, `real_time.py`, `battery.py`, `set_time.py`),
recoupé avec Gadgetbridge PR #3896.

* Service UART : `6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E`
  * écriture (vers la bague) : `6E400002-…`
  * notifications : `6E400003-…`
* Trame = **16 octets** : `[commande, données…, 0x00…, checksum]`, `checksum = somme(octets 0..14) & 0xFF`.

| Commande | Payload | Effet |
|---|---|---|
| `0x69` | `01 01` | démarrer le flux FC temps réel (type 1 = FC, action 1 = START) |
| `0x6A` | `01 00 00` | arrêter le flux |
| `0x1E` | `33` | keep-alive « continue » (toutes les 20 s) |
| `0x03` | — | niveau de batterie → réponse `[03, niveau%, enCharge]` |
| `0x01` | 7 octets BCD (année-2000, mois, jour, h, m, s, langue) | règle l'horloge de la bague (UTC) |
| `0x15` | timestamp 4 octets LE | historique FC 288 points / 5 min (non utilisé ici) |

Réponse temps réel : `[0x69, type=0x01, codeErreur, bpm]`.

**Test automatisé ajouté** : les 5 trames produites par `RingBleClient.buildPacket()` ont été
comparées à `make_packet()` du prototype Python — **identiques octet pour octet** :

```
start_hr = 6901010000000000000000000000006B
stop_hr  = 6A01000000000000000000000000006B
continue = 1E330000000000000000000000000051
battery  = 03000000000000000000000000000003
set_time = 012510201435000100000000000000A0
```

---

## 5. Validation effectuée / restante

### 5.1 Fait dans cette session

| Étape | Résultat |
|---|---|
| Compilation ECJ contre `android.jar` 34 | 37 classes, 0 erreur, 21 avertissements (dépréciations API) |
| `aapt2 link` (manifeste + ressources) | OK, `foregroundServiceType=0x10` bien présent |
| DEX (`dx`) puis réassemblage `baksmali` | 37 classes, DEX valide |
| `zipalign -p 4` + `apksigner` | v1 ✔ v2 ✔ |
| `aapt2 dump badging` | `com.qring.strava.bridge`, v3, cible 34, permissions BLE + FGS |
| Trames bague vs prototype Python | identiques |

### 5.2 Reste à faire sur le Pixel 9a

```bash
adb install -r qring-strava-bridge/releases/QRingStravaBridge-v3.0.apk
adb shell pm grant com.qring.strava.bridge android.permission.BLUETOOTH_SCAN
adb shell pm grant com.qring.strava.bridge android.permission.BLUETOOTH_CONNECT
adb shell pm grant com.qring.strava.bridge android.permission.BLUETOOTH_ADVERTISE
adb shell am start -n com.qring.strava.bridge/.MainActivity
adb logcat -s QRingBridge
```

1. **Mode test d'abord** : bouton « Mode test (FC simulée) » → dans Strava, la ceinture
   le nom Bluetooth du téléphone doit apparaître et afficher 62–158 bpm. Si ce point fonctionne, la moitié
   « Strava » du problème est validée (indépendamment de la bague).
2. **Puis la bague** : Scanner → sélection → « Connecter la bague ». Vérifier le journal :
   * `Notifications activées` → connexion GATT OK ;
   * `→ démarrage du flux FC temps réel (0x69)` → commande envoyée ;
   * trames `0x69` avec bpm → protocole conforme.
3. Si la FC reste à `--` : le journal affiche les trames brutes reçues (ligne
   `Trame 0x.. : …`). Cas fréquents : R06/R10 qui répondent avec un autre type, ou
   bague qui exige `0x69 01 03` (CONTINUE) au lieu de START. Ajuster
   `RingBleClient.handlePacket()` / `startHeartRateStream()` — l'architecture est prête.

---

## 6. GitHub Actions : limitation rencontrée

Le jeton disponible dans cette session ne possède pas la permission **`workflows`** :
tout push ou `PUT` API touchant `.github/workflows/**` est rejeté
(`refusing to allow a GitHub App to create or update workflow … without workflows permission`).

→ Le workflow est donc livré dans **`qring-strava-bridge/ci/qring-strava-bridge-build.yml`**.
Pour l'activer : le copier dans `.github/workflows/` depuis un compte disposant de la
permission `workflows` (web GitHub, ou PAT classique `repo` + `workflow`), puis pousser.
Il compile l'APK avec Gradle et la teste sur émulateurs API 30 et 33 en mode simulation.

---

## 7. Reprise / prochaines étapes

| Priorité | Action |
|---|---|
| 1 | Installer l'APK sur le Pixel 9a et **tester le mode simulation avec Strava** |
| 2 | Connecter la bague, lire le journal `QRingBridge`, ajuster si besoin `handlePacket()` |
| 3 | Ajouter un `HRV`/`0x2A37` multi-octets si une app demande le format 16 bits (flag `0x01`) |
| 4 | Optionnel : keystore de release + publication de l'APK dans `releases/` |
| 5 | Optionnel : ajout d'un enregistrement `.fit`/`.tcx` en parallèle, pour les apps sans BLE |

---

## 8. Notes de sécurité

* `debug.keystore` (mot de passe `android`) est généré localement et **exclu du dépôt**
  par `.gitignore`.
* Aucun jeton, aucun identifiant Strava, aucune requête réseau dans l'application.
* Les jetons GitHub communiqués en conversation ne sont **pas** stockés dans le dépôt.
