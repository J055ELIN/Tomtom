# QRing / Colmi → Strava — pont de fréquence cardiaque BLE

Transforme une bague **QRing / Colmi R0x** (R02, R03, R06, R10…) en **capteur de fréquence
cardiaque BLE standard**, détectable par **Strava**, Wahoo, Garmin, Zwift, etc.

```
 Bague QRing/Colmi ──BLE──► Téléphone Android ──BLE (périphérique)──► Strava
   (protocole 0x69)          rôle central + rôle GATT server        (0x180D / 0x2A37)
```

* **APK prête à installer :** [`releases/QRingStravaBridge-v3.0.apk`](releases/QRingStravaBridge-v3.0.apk)
  (37 Ko, minSdk 23, targetSdk 34, signée debug v1 + v2).
* **Aucune dépendance externe** : 100 % API Android, aucun Google Play Services.

---

## 1. Ce que corrige la version 3.0

Le SOP précédent concluait que « `openGattServer()` n'existe pas dans l'API publique
Android » et que le téléphone ne pouvait donc **pas** se faire passer pour un capteur FC.
**C'est inexact.**

`BluetoothManager.openGattServer(Context, BluetoothGattServerCallback)` est **public
depuis l'API 18**. Ce qui manquait dans l'ancienne version :

| Élément | v1 (SOP précédent) | v3.0 |
|---|---|---|
| Serveur GATT | appel sur `BluetoothAdapter` (inexistant) → abandon | `BluetoothManager.openGattServer()` ✔ |
| Services exposés | aucun | FC `0x180D`/`0x2A37` + Body Sensor Location `0x2A38`, batterie `0x180F`, Device Info `0x180A` |
| Publicité BLE | absente | `BluetoothLeAdvertiser` + `BLUETOOTH_ADVERTISE`, UUID `0x180D` annoncé, connectable, nom = celui du téléphone |
| Cycle de vie | service non démarré | service de premier plan `connectedDevice` + wake lock (écran éteint) |
| Protocole bague | trame « 0x1e » seule, offsets supposés | vérifié sur le client Python `qlam-ai/qring` : `0x69` start, `0x6A` stop, `0x1E`+`0x33` keep-alive, trame 16 octets + checksum |
| Reconnexion | aucune | reconnexion automatique + relance du flux si la FC se tait |
| Test sans matériel | — | bouton « Mode test (FC simulée) » |

## 2. Installation

```bash
adb install -r releases/QRingStravaBridge-v3.0.apk
```

Ou copier l'APK sur le téléphone et l'ouvrir (autoriser les sources inconnues).
Android 12+ demandera : **Appareils à proximité** (scan, connexion, **publicité**) et
**Notifications** (pour le service de premier plan). Tout accepter.

## 3. Utilisation avec Strava

1. **Allumer la bague**, la porter au doigt (capteur côté paume), la rapprocher du téléphone.
2. Ouvrir l'application → **Scanner** → sélectionner la bague dans la liste.
3. **Connecter la bague** : le service démarre, la FC s'affiche en grand, et la ligne
   « Pont BLE » indique `publicité 0x180D` puis `1 client(s)` dès qu'une app se connecte.
4. Dans **Strava** : *Enregistrer* → icône capteurs → **Fréquence cardiaque** →
   choisir l'entrée correspondant au **nom Bluetooth de votre téléphone**
   (il apparaît comme une ceinture cardiaque).
5. Démarrer l'activité : la FC est transmise en temps réel (notification `0x2A37`, 1 Hz).

> Le capteur apparaît dans Strava **sous le nom Bluetooth du téléphone**
> (l'application ne le renomme pas : cela modifierait définitivement le nom de votre
> appareil). Si vous voulez un nom explicite, changez-le une fois dans
> *Paramètres → À propos du téléphone → Nom de l'appareil*.
>
> Si Strava ne voit pas le capteur : désactiver puis réactiver le Bluetooth, puis
> relancer le scan des capteurs dans Strava.

### Mode test (sans bague)

Bouton **Mode test (FC simulée)** : le pont expose une FC sinusoïdale 62–158 bpm.
Idéal pour vérifier la liaison avec Strava avant même d'avoir la bague.

## 4. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| La bague n'apparaît pas au scan | déjà connectée à l'app Colmi/QRing officielle | fermer l'app officielle, désactiver son Bluetooth |
| Bague connectée mais `-- bpm` | modèle différent (R06/R10) ou capteur mal porté | le journal affiche les trames reçues ; ajuster `RingBleClient.handlePacket()` |
| `Publicité BLE non supportée` | téléphone sans mode périphérique | le pont GATT reste actif, mais Strava ne peut pas découvrir l'appareil |
| `Publicité BLE en échec : non supporté par le matériel` | idem (émulateur, vieux téléphone) | tester sur le Pixel 9a |
| Strava ne propose pas le capteur | Strava garde en cache la liste des capteurs | fermer/rouvrir Strava, ou relancer le scan des capteurs |
| La FC se fige après quelques minutes | flux bague interrompu | l'app relance automatiquement `0x69` après 25 s sans donnée (visible au journal) |

Le **journal** de l'écran d'accueil est aussi envoyé à logcat :

```bash
adb logcat -s QRingBridge
```

## 5. Recompiler

Prérequis : Android SDK (build-tools 34, platform 34) et un JDK 17/21.

```bash
export ANDROID_HOME=/opt/sfa-tools/sdk          # adapter
export ANDROID_BUILD_TOOLS=$ANDROID_HOME/build-tools/34.0.0
export ANDROID_PLATFORM=$ANDROID_HOME/platforms/android-34/android.jar
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
bash build.sh
```

`build.sh` fait : `aapt2 compile` → `aapt2 link` → compilation Java (`javac`, ou `ECJ`
si `ECJ_JAR` est fourni) → `d8` (ou `dx` si `DX_JAR`) → ajout de `classes.dex` →
`zipalign` → signature `apksigner` (keystore debug générée au premier build).

Le projet reste également ouvrable dans **Android Studio** (`settings.gradle`,
`app/build.gradle`, AGP 8.5, Gradle 8.7) :

```bash
./gradlew :app:assembleDebug
```

> Le code est écrit en **Java 7 « pur »** (pas de lambda, pas de `invokedynamic`) :
> c'est obligatoire pour la chaîne `dx` utilisée dans l'environnement de compilation
> hors ligne, et cela reste parfaitement compilable par Gradle/javac et d8/R8.

## 6. Validation déjà effectuée

| Contrôle | Résultat |
|---|---|
| Compilation Java contre `android.jar` API 34 | ✔ 37 classes, 0 erreur |
| DEX produit et réassemblé (`baksmali`) | ✔ 37 classes, aucune erreur |
| Manifeste compilé | ✔ `package=com.qring.strava.bridge`, `versionCode=3`, `targetSdk=34`, `foregroundServiceType=connectedDevice` |
| Signature | ✔ v1 (JAR) + v2 (APK Signature Scheme) |
| Encodage des trames bague | ✔ **octet pour octet** identique au prototype Python `qring` (start, stop, keep-alive, batterie, heure) |
| Exécution sur appareil réel | ⏳ à faire (voir `SOP-QRING-STRAVA-v3.md` §5) |

## 7. Fichiers

| Fichier | Rôle |
|---|---|
| `app/src/main/java/.../RingBleClient.java` | client BLE bague (UART Nordique, trames 16 octets) |
| `app/src/main/java/.../HrmPeripheral.java` | **périphérique** BLE : serveur GATT FC + publicité |
| `app/src/main/java/.../HrBridgeService.java` | service de premier plan : relie les deux, mode simulation |
| `app/src/main/java/.../MainActivity.java` | interface : scan, connexion, FC, journal |
| `build.sh` | compilation APK sans Gradle |
| `ci/qring-strava-bridge-build.yml` | workflow GitHub Actions (build + test émulateur) — à copier dans `.github/workflows/` |
| `SOP-QRING-STRAVA-v3.md` | SOP de reprise complet (environnement, protocole, suite) |

## 8. Sécurité

* L'APK est signée avec une **keystore de debug** (`debug.keystore`, mot de passe `android`,
  non versionnée). Pour une diffusion publique : générer une keystore dédiée et la garder hors du dépôt.
* Aucun identifiant Strava, aucun compte, aucune connexion réseau : l'application ne parle
  qu'à la bague et au téléphone.
