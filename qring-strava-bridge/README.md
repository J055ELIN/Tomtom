# QRing / Colmi → Strava — pont de fréquence cardiaque BLE (v3.8)

Transforme une bague **QRing / Colmi R0x** (R02, R03, R06, R10…) en **capteur de fréquence
cardiaque BLE standard**, détectable par **Strava**, Wahoo, Garmin, Zwift, etc.

```
 Bague QRing/Colmi ──BLE──► Téléphone Android ──BLE (périphérique)──► Strava
   (protocole 0x69)          rôle central + rôle GATT server        (0x180D / 0x2A37)
```

* **APK prête à installer :** [`releases/QRingStravaBridge-v3.8.apk`](releases/QRingStravaBridge-v3.8.apk)
  (41 Ko, minSdk 23, targetSdk 34, signée debug v1 + v2).
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
adb install -r releases/QRingStravaBridge-v3.8.apk
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

## 3 ter. Correctif v3.2 — pourquoi Strava ne voyait rien

Android n'accepte **qu'un seul `addService()` à la fois** : il faut attendre le callback
`onServiceAdded()` avant d'en ajouter un autre. La v3.1 en ajoutait trois d'un coup →
aucun n'était réellement enregistré, donc Strava (qui se connectait bien, comme le
montraient les journaux) ne trouvait aucun service `0x180D` et repartait sans s'abonner.
La v3.2 les enregistre **en séquence**, puis démarre la publicité, et affiche
« FC souscrite » dès qu'une application active réellement les notifications.

## 3 nonies. LE POINT CLÉ : un téléphone ne voit pas ses propres publicités

Test décisif effectué sur le Pixel 9a : le pont a été détecté, **connecté et abonné**
par le Strava d'un **second téléphone** (journal : `✔ Abonnement FC activé par
55:DE:C5:05:82:47`, `→ FC 99 bpm envoyée immédiatement`, lectures `0x2A29`/`0x2A25`).
Le même capteur est **invisible depuis le téléphone qui l'émet**.

C'est une limite du contrôleur Bluetooth, pas de l'application : **un appareil ne
reçoit jamais ses propres paquets publicitaires**. Aucune application (Strava, nRF
Connect, la nôtre) lancée sur le Pixel ne pourra donc voir le capteur émis par ce
Pixel. Deux usages possibles :

| Usage | Marche ? |
|---|---|
| Pont sur le Pixel + **Strava sur un second téléphone** | ✅ oui (vérifié) |
| Pont + **Strava sur le même téléphone** | ❌ impossible par BLE |
| Pont + **export TCX importé dans Strava (même téléphone)** | ✅ oui → voir ci-dessous |

## 3 undecies. LA configuration qui donne la FC EN DIRECT dans Strava

Objectif : FC vivante pendant l'effort **et** carte, routes et segments habituels.
Seule combinaison qui le permet (prouvée le 21/10) : **deux téléphones**.

| Téléphone | Rôle | Écran |
|---|---|---|
| **A** (n'importe lequel, poche/sac) | Pont QRing : appli lancée, bague connectée, FC affichée | peut rester éteint |
| **B** (le tien, sur le guidon) | **Strava** : capteur « QRing HR » + GPS + segments | allumé, comme d'habitude |

Mise en place, une seule fois :
1. Sur A : appli QRing → **Connecter la bague** → attendre `FC xx bpm` → **Démarrer le pont**.
2. Sur B : Strava → **Enregistrer** → icône **cœur** (capteurs) → choisir **QRing HR** →
   la FC apparaît en direct. Lancer l'activité normalement.

Règles à respecter :
* A doit rester à portée (≤ 10 m) et son Bluetooth actif ; la notification « pont actif »
  doit rester visible (sinon Android endort l'appli : désactiver l'optimisation de batterie
  pour QRing HR Bridge).
* Ne pas lancer l'appli QRing sur B : il ne doit y avoir qu'un seul pont à la fois.
* Un capteur BLE ne se connecte qu'à **une** application : si la FC se fige, fermer
  l'éventuelle autre appli (montre, appli constructeur) qui aurait pris la bague.

Sans second téléphone, il reste l'export TCX (section 3 decies) : tout est dans Strava
après coup (carte + FC + segments), mais pas de FC affichée pendant l'effort.

## 3 decies. v3.8 — enregistrement de séance + export TCX (un seul téléphone)

Pendant que le pont tourne, l'application enregistre **la FC (1 point/s) et la trace
GPS** (Strava refuse un fichier sans GPS : « Empty file »). Le bouton
**« Exporter la séance (TCX) »** écrit un fichier dans
`Téléchargements/QRingHR/QRingHR-AAAAMMJJ-HHMM.tcx` (positions + `HeartRateBpm`),
puis propose de le partager.

Dans Strava : **Enregistrer → (+) → Importer un fichier** → choisir le `.tcx`.
L'activité remonte avec la carte **et** la fréquence cardiaque.

## 3 octies. v3.7 — réplique exacte de la trame des ceintures FUSE

Les trames de vos ceintures, relevées par nRF Connect, sont :

```
02 01 06                          flags
03 03 0D 18                       liste complète des UUID 16 bits = 0x180D
0A 09 51 52 69 6E 67 ...          nom complet « Joss-FUSE » / « NEW-FUSE »
07 FF 89 01 ...                   (optionnel) données fabricant
```

La v3.7 émet la même structure (variante 1 = `0x180D` + nom, sans données
fabricant) et affiche dans le journal la **trame visée en hexadécimal** afin de
pouvoir la comparer directement à celle des ceintures.

## 3 septies. v3.6 — publicité calquée sur une vraie ceinture

Le nom « QRing HR » est accepté et diffusé, mais Strava ne le liste toujours pas.
La v3.6 reproduit donc **exactement** la structure d'une ceinture reconnue :

| Variante | Contenu |
|---|---|
| 1 | UUID `0x180D` + `0x180F` + nom complet (structure Polar H10) |
| 2 | idem + **service data `0x180D`** (flags + bpm), comme certaines ceintures |
| 3 | UUID dans la publicité, nom en réponse de scan |
| 4 | UUID seul |

La publicité est en outre **relancée toutes les 60 s** (certains contrôleurs
Bluetooth l'arrêtent silencieusement), et l'autotest journalise désormais la
**trame publicitaire brute en hexadécimal** de chaque ceinture vue — ce qui permet
de comparer avec la nôtre.

## 3 sexies. v3.5 — autotest réaliste et nom du capteur

Deux constats issus des tests sur le Pixel 9a :

1. **Un téléphone ne reçoit jamais ses propres publicités.** L'autotest v3.4 exigeait
   de se voir soi-même : il ne pouvait donc pas réussir. La v3.5 conclut désormais
   à partir de ce qui est réellement observable (confirmation du système + clients
   Bluetooth effectivement connectés) et se rabat sur la connexion GATT complète
   dans les rares cas où l'appareil se voit lui-même.
2. **Le capteur porte le nom du téléphone (« Pixel 9a »).** Certaines applications
   ignorent un appareil dont le nom est celui du téléphone. Le bouton
   **« Nom du capteur »** permet de le renommer explicitement en *QRing HR*
   (nom mémorisé, bouton **Restaurer** pour revenir en arrière).

> Le client mystérieux qui se connectait toutes les 30 ms était une **HUAWEI Band 9**
> (`D8:EF:42:01:0F:37`) : les montres connectées se branchent automatiquement sur
> tout capteur FC à proximité. Ce n'était pas Strava.

## 3 quinquies. Correctif v3.4 — l'autotest se connectait à la mauvaise ceinture

L'autotest de la v3.3 scannait tout ce qui annonce `0x180D` : il a trouvé la
**ceinture cardiaque du voisinage** (« Joss-FUSE », -90 dBm) et s'y est connecté
au lieu de se connecter au pont. La v3.4 ne se connecte plus qu'à la publicité
portant **exactement le nom Bluetooth du téléphone** (« Pixel 9a »), et
journalise au passage tous les appareils `0x180D` entendus.

> Installation : la v3.4 est signée avec la keystore de debug désormais versionnée
> dans le dépôt. Si vous aviez la v3.3, **désinstallez-la une fois**
> (l'application ne peut pas être remplacée par une APK signée avec une autre clé) ;
> les versions suivantes s'installeront par-dessus.

## 3 quater. Autotest BLE (v3.8)

Bouton **« Autotest BLE (pont → capteur) »** : le téléphone se teste lui-même, sans
application tierce.

1. il scanne sa **propre publicité** et vérifie qu'elle annonce `0x180D` ;
2. il s'y **connecte comme un client** et découvre les services ;
3. il **s'abonne à `0x2A37`** et vérifie qu'il reçoit au moins 2 mesures.

Verdict affiché dans une boîte de dialogue et consigné dans le journal :

| Verdict | Signification |
|---|---|
| « Capteur FC BLE validé … N mesures reçues » | le pont est un capteur cardiaque BLE valide ; un échec côté Strava vient alors de Strava (cache de capteurs, permission, version) et non de l'application |
| « Publicité invisible en 12 s » | le téléphone ne se voit pas lui-même annoncer `0x180D` → publicité BLE non fonctionnelle sur ce modèle/OS |
| « service 0x180D ABSENT » | la base GATT n'a pas été publiée correctement (le message liste les services vus) |
| « aucune mesure reçue » | l'abonnement est accepté mais aucune FC n'est poussée (vérifier que le mode test est actif) |

## 3 bis. La bannière de statut (v3.8)

Sous la valeur de FC, la ligne d'état est colorée :

| Couleur | Signification |
|---|---|
| **vert** | publicité BLE active : le téléphone est visible comme capteur FC |
| **bleu** | une application (Strava ?) est connectée au pont |
| **rouge** | la publicité a échoué — la raison exacte est affichée et re-tentée toutes les 15 s |
| noir | pont arrêté |

Deux boutons aident au diagnostic :

* **Diagnostic** : permissions, nom Bluetooth, support du mode périphérique,
  nombre de clients connectés, état de la bague ;
* **Partager le journal** : envoie le diagnostic + le journal complet par e-mail,
  SMS, WhatsApp… (pas besoin de copier-coller).

La publicité essaie automatiquement trois variantes (UUID + nom, UUID dans la
publicité et dans la réponse de scan, UUID seul) avant de réessayer.

## 4. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| La bague n'apparaît pas au scan | déjà connectée à l'app Colmi/QRing officielle | fermer l'app officielle, désactiver son Bluetooth |
| Bague connectée mais `-- bpm` | modèle différent (R06/R10) ou capteur mal porté | le journal affiche les trames reçues ; ajuster `RingBleClient.handlePacket()` |
| `Publicité BLE non supportée` | téléphone sans mode périphérique | le pont GATT reste actif, mais Strava ne peut pas découvrir l'appareil |
| `Publicité BLE en échec : non supporté par le matériel` | idem (émulateur, vieux téléphone) | tester sur le Pixel 9a |
| Strava ne propose pas le capteur | Strava garde en cache la liste ; le capteur y figure parfois déjà sous le **nom Bluetooth du téléphone** | vérifier la couleur de la bannière (verte ?), puis ouvrir *Capteurs → Fréquence cardiaque* et toucher l'entrée existante ; sinon désactiver/réactiver le Bluetooth et relancer la recherche |
| Le capteur apparaît mais reste « non connecté » | l'ancienne association Strava pointe vers l'app arrêtée | relancer le pont **avant** d'ouvrir Strava, puis toucher le capteur |
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
