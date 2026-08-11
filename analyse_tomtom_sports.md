# Analyse de l'APK TomTom Sports 10.0.9 — et protocole Bluetooth de la montre

> Analyse réalisée à partir des sources décompilées de `com.tomtom.Sports_10.0.9.apk`
> (16 790 fichiers, 219 Mo décompressés : 5 636 fichiers `.java` JADX + 5 605 fichiers smali + ressources).
> Toutes les informations ci-dessous proviennent du code de l'application officielle
> (`com.tomtom.ble.*` et `com.tomtom.daemonlibrary.*`).

---

## 1. Vue d'ensemble de l'application

| Élément | Valeur |
|---|---|
| Package | `com.tomtom.Sports` |
| Version | 10.0.9 (versionCode 934) |
| minSdk / targetSdk | 19 / 26 (application React Native) |
| Fonction Bluetooth | `DaemonBleService` dans un **processus dédié** `:daemon_library_process` |
| Permissions BLE | `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION` (scan), `android.hardware.bluetooth_le` (requis) |

Architecture : l'interface utilisateur est **React Native** (`com.facebook.react.*`),
mais toute la couche Bluetooth est native Java :
`com.tomtom.ble` (pile GATT + protocole), `com.tomtom.daemonlibrary` (agents scan/connexion).

## 2. Découverte de la montre (scan)

`DaemonBleDiscoveryLollipopAgent` (et `KitKatAgent`) scannent **toutes** les publicités BLE puis filtrent :

- **Donnée fabricant (Manufacturer Specific Data)** avec l'ID compagnie **TomTom = `0x0100` (256)**.
- Type de la montre déduit du **service GATT annoncé** dans le scan record :
  - `170d0d30-4213-11e3-aa6e-0800200c9a66` → **V1** (anciennes montres)
  - `b993bf90-81e1-11e4-b4a9-0800200c9a66` → **V2** (montres actuelles)
- Octet `manufacturerData[3] == 1` → la montre est en **mode appairage**.

## 3. Services GATT utilisés

| Service | UUID | Rôle |
|---|---|---|
| Device Information | `0000180a-0000-1000-8000-00805f9b34fb` | infos standard (modèle, S/N, firmware…) |
| Battery | `0000180f-0000-1000-8000-00805f9b34fb` | batterie (`2a19`) |
| **File Transfer V1** | `170d0d30-4213-11e3-aa6e-0800200c9a66` | transfert de fichiers (anciennes montres) |
| **File Transfer V2** | `b993bf90-81e1-11e4-b4a9-0800200c9a66` | transfert de fichiers (montres actuelles) |
| **Communications Setup** (V2) | `b993bf91-81e1-11e4-b4a9-0800200c9a66` | appairage / authentification |

### Service Communications Setup (appairage)

| Caractéristique | UUID | Usage |
|---|---|---|
| AUTH_TOKEN | `b993bf92-81e1-11e4-b4a9-0800200c9a66` | écriture du PIN + notification de réponse |
| APP_VERSION | `b993bf93-81e1-11e4-b4a9-0800200c9a66` | écriture (8 octets) |
| SYNC | `47ec27b0-5c56-11e5-a837-0800200c9a66` | notifications « UIProd » (synchro REST, états) |
| DEVICE_CAPABILITY | `c6945cb0-4ab4-11e7-9598-0800200c9a66` | lecture des capacités |

**Séquence d'appairage (V2)** — vue dans `WatchDevice.doCommsSetup()` :

1. Activer les notifications sur AUTH_TOKEN et SYNC.
2. Écrire `APP_VERSION` = `[0x01, SDK_INT, 0x00, 0x00, 0x01, versionCode, 0x00, 0x00]`
   (l'appli officielle envoie `(byte)1, Build.VERSION.SDK_INT, 0, 0, (byte)1, versionCode, 0, 0`).
3. Écrire `AUTH_TOKEN` = **PIN 4 octets little-endian**, affiché sur l'écran de la montre.
4. La montre notifie `AUTH_TOKEN` avec un octet de réponse :
   - `0x01` = PIN valide (appairage accepté)
   - `0x02` = PIN invalide
   - `0x03` = reconnexion (PIN déjà connu)

### Service File Transfer (V1 et V2, mêmes caractéristiques)

| Caractéristique | UUID | Taille utile |
|---|---|---|
| COMMAND | `170d0d31-4213-11e3-aa6e-0800200c9a66` | 4 octets (write + notify) |
| TRANSFER_LENGTH | `170d0d32-4213-11e3-aa6e-0800200c9a66` | 4 octets LE (write + notify) |
| TRANSFER_PACKET | `170d0d33-4213-11e3-aa6e-0800200c9a66` | **20 octets** (write + notify) |
| TRANSFER_BLOCK | `170d0d34-4213-11e3-aa6e-0800200c9a66` | 4 octets LE (write + notify) |

## 4. Commandes (caractéristique COMMAND)

Paquet de commande : `[code, typeFichier, numFichierLo, numFichierHi]` (4 octets) ;

`FileTransferCommand` (enum `AbstractFileTransferGattService`) :

| Code | Commande | Réponse attendue |
|---|---|---|
| 0 | SEND_TO_WATCH (upload) | oui |
| 1 | RECEIVE_FROM_WATCH (download) | oui |
| 2 | CANCEL_CURRENT_TRANSFER | oui |
| 3 | LIST_FILES | oui |
| 4 | DELETE_FILE | oui |
| 5 | UPDATE_EPHEMERIS | non |
| 6 | UPDATE_GOLF_MAPS | non |
| 7 | RESET_DEVICE | non |
| **8** | **SET_TIME** | non — paquet `[8, t0, t1, t2, t3]` = timestamp Unix 32 bits LE |
| 9 | UIPROD (messages UI 20 octets) | — |
| 10 / 11 | variantes « recoverable » (reprise après coupure) | oui |

Réponse sur COMMAND (notification 4 octets) : `[0x01, ...]` = OK/accusé, `[0x00, ...]` = fichier inexistant (download/delete).

## 5. Transfert de fichiers (protocole par blocs)

Constantes : paquet = **20 octets**, bloc = **256 paquets = 5120 octets**, CRC16 sur chaque bloc.

### Téléchargement depuis la montre (RECEIVE_FROM_WATCH)

1. Écrire commande `[1, type, numLo, numHi]` → la montre notifie COMMAND `0x01`.
2. La montre notifie `TRANSFER_LENGTH` : taille du fichier, **uint32 little-endian**.
3. La montre envoie les données par notifications `TRANSFER_PACKET` (20 octets).
   Les 256 premiers paquets forment un bloc de 5120 octets ; **les 2 derniers octets du bloc
   sont le CRC16 des 5118 premiers** (little-endian).
4. Vérifier le CRC, puis écrire `TRANSFER_BLOCK` avec le **numéro du prochain bloc attendu**
   (`int32` little-endian) : `1, 2, 3, …`
   - réponse bloc `-1` (`0xFFFFFFFF`) = redemander le bloc (variante recoverable) ;
   - réponse `0` = transfert annulé / fichier existe déjà.
5. Recommencer jusqu'à `octetsReçus >= tailleTotale` → fichier terminé.

### Envoi vers la montre (SEND_TO_WATCH)

1. Commande `[0, type, numLo, numHi]` → la montre notifie COMMAND `0x01`.
2. Écrire `TRANSFER_LENGTH` = taille du fichier (uint32 LE).
3. Envoyer bloc par bloc : 256 paquets de 20 octets + **CRC16 (2 octets LE) du bloc**, paquets
   espacés d'~25 ms (débit ~800 o/s ; ~50 ms, 400 o/s pour le firmware).
4. La montre notifie `TRANSFER_BLOCK` avec le numéro du bloc suivant ; `-1` = à renvoyer.

### Liste des fichiers (LIST_FILES)

1. Commande `[3, type, 0, 0]` → la montre notifie COMMAND `0x01`.
2. Notifications `TRANSFER_PACKET` :
   - **premier paquet** : `[nbFichiersLo, nbFichiersHi, numLo, numHi, numLo, numHi, …]`
   - paquets suivants : uniquement des paires `(numLo, numHi)`.
   - chaque numéro = numéro de fichier sur 16 bits LE.
3. Terminé quand le nombre de fichiers reçus atteint `nbFichiers`.

### CRC16

`CRCUtil` : **CRC-16/MODBUS** — poly `0x8005` réfléchi (`0xA001`), init `0xFFFF`, pas de
final XOR. Vérifié numériquement : `CRC("123456789") = 0x4B37`, table identique à la table
décompilée (`0x0, 0xc0c1, 0xc181, 0x0140, 0xc301, 0x03c0, 0x0280, 0xc241, …`).

## 6. Types de fichiers (FileTransferType — valeurs lues dans le smali)

| Type | Code | Extension / contenu |
|---|---|---|
| BRIDGEHEAD | 0 | — |
| EPHEMERIS | 1 | éphémérides GPS |
| MANIFEST | 2 | manifeste |
| WORKOUT | 145 (`0x91`) | **entraînements `.ttbin`** |
| REST_PROTO_FILE | 137 (`0x89`) | échanges REST (synchronisation compte) |
| STEP_BUCKET | **177 (`0xb1`)** | **données pas `.bucket`** |
| GOLF_MANIFEST | 176 (`0xb0`) | golf |
| GOLF_SCORECARDS / GOLF_ROUNDS | 148 (`0x94`) | golf |
| NOTIFICATION | 181 (`0xb5`) | notifications téléphone → montre |
| FIRMWARE_CHUNK | 253 (`0xfd`) | mises à jour firmware |

> Note : valeurs vérifiées dans le **smali** (`FileTransferType.smali`) — la sortie JADX
> (Java) est trompeuse sur certains codes. Attention notamment : STEP_BUCKET = 177 et
> non 148 (148 = golf).

## 7. Machine à états de synchronisation

`WatchDeviceTransferState` (V2) : CONNECTING → GETTING_AUTH_TOKEN → SENDING_AUTH_TOKEN →
GETTING_DEVICE_CAPABILITIES → GETTING_DEVICE_INFORMATION → DELETING_MASTER_NAME →
SENDING_MASTER_NAME → SENDING_VERSION_REQUEST → GETTING_EVENTLOG → DELETING_EVENTLOG →
GETTING_PREFERENCES → CHECK_WATCH_CREDENTIALS (compte MySports) → SENDING_PREFERENCES → DONE.

`SportsWatchHandler2` (synchro données) : LIST_WORKOUTS → GETTING_WORKOUT → DELETING_WORKOUT →
LIST_STEP_BUCKETS → GETTING_STEP_BUCKETS → DELETING_STEP_BUCKETS → retour à IDLE.
Chaque fichier reçu est **supprimé de la montre** après téléchargement réussi.

## 8. Canaux « UIProd » (SYNC)

Messages de 20 octets (`UIProdMessage`) : `[9, version=1, seqSrc(2), commande, procType,
procState, cache, refSrcSeq(2), refDevSeq(2), …, numFichier(2), typeFichier(2)]`.
Commandes : 1 = REST_API, 2 = PHONE_NOTIFICATIONS, 4 = DEVICE_STATE_CHANGE_NOTIFICATION.
La montre pousse des notifications « besoin de synchro » sur la caractéristique SYNC.

## 9. Conclusion pour un client tiers

Tout ce qu'il faut pour se connecter à une montre TomTom depuis une application indépendante :

1. **Scanner** en filtrant la donnée fabricant `0x0100` / services `170d0d30…` ou `b993bf90…`.
2. **V2** : service Comms Setup → PIN affiché sur la montre → `APP_VERSION` puis `AUTH_TOKEN`.
3. **V1** : pas d'authentification, connexion directe sur le service File Transfer V1.
4. Lire Device Information + Battery (services standards).
5. Commandes COMMAND/LENGTH/PACKET/BLOCK pour lister et télécharger les `.ttbin` (entraînements)
   et `.bucket` (pas) — protocole par blocs de 5120 octets avec CRC-16/MODBUS.
6. `SET_TIME` (code 8) pour régler l'heure.

> Note : l'appairage officiel enchaîne ensuite des étapes liées au compte MySports
> (préférences, credentials) qui ne sont **pas nécessaires** pour dialoguer avec la montre
> en local — un client tiers peut s'arrêter après l'échange de PIN et le transfert de fichiers.

---

## 10. Comment la connexion est maintenue dans la durée (analyse approfondie)

> Section ajoutée après un retour matériel : le PIN était accepté mais la montre restait
> sur l'écran PIN puis **se déconnectait seule au bout de ~20 s**. Cause identifiée :
> **le handshake post-PIN n'était pas exécuté**.

### 10.1 La machine à états de `WatchDevice` (post-PIN)

Après la réponse `AUTH_TOKEN = 1` (PIN valide), l'application officielle enchaîne
immédiatement la machine `WatchDeviceTransferState` (c'est elle qui fait sortir la montre
de l'écran PIN et qui « valide » la connexion côté firmware) :

| Étape | État | Opération BLE | Réussite → |
|---|---|---|---|
| 1 | GETTING_DEVICE_CAPABILITIES | lecture DEVICE_CAPABILITY (`c6945cb0…`) | `onDeviceCapabilitiesReceived` → étape 2 |
| 2 | GETTING_DEVICE_INFORMATION | lecture des 6 caractéristiques Device Information | `onDeviceInformationReceived` → étape 3 |
| 3 | DELETING_MASTER_NAME | **DELETE_FILE** type=2 n°=2 (`mastername`) | `onMasterNameDeleteComplete` → étape 4 |
| 4 | SENDING_MASTER_NAME | **SEND_TO_WATCH** type=2 n°=2 (contenu = nom BT du téléphone) | `onMasterNameSendComplete` → étape 5 |
| 5 | SENDING_VERSION_REQUEST… | étapes réseau (API version, eventlog, préférences MySports) | — |
| … | DONE | `setConnectionState(IDLE)` → connexion **maintenue** | |

**Preuve que les étapes 1 à 4 sont les seules obligatoires côté montre** :
`onMasterNameSendComplete()` contient une branche « application en arrière-plan » qui passe
directement à `DONE` **après l'envoi du mastername**, en sautant version/eventlog/préférences.
L'appli officielle considère donc la connexion comme complète dès que le mastername est
envoyé.

### 10.2 Le fichier « mastername » (type 2, n° 2)

- **Contenu** : les octets du nom Bluetooth du téléphone (`BluetoothAdapter.getName()`,
  « UNKNOWN » en secours) — pas de format particulier, c'est un simple fichier texte.
- **Suppression** : commande `DELETE_FILE [4, 2, 2, 0]`. **La suppression n'est terminée
  qu'après 2 confirmations** (d'où un échec d'appairage si l'on enchaîne trop vite) :
  1. notification `COMMAND = 1` (commande acceptée) ;
  2. paquet `TRANSFER_PACKET` (3 octets) — statut `0` ou `2` = suppression **terminée**,
     `1` = échec, `3` = progression (octets 1-2 = durée estimée en secondes, la montre
     enverra ensuite le paquet final `0/2`) ;
  3. notification `COMMAND` **finale** (clôt la commande, valeur quelconque).
- Réponse `COMMAND = 0` dès le départ → fichier inexistant → l'officiel considère la
  suppression comme inutile et **continue**.
- **Envoi** : commande `SEND_TO_WATCH [0, 2, 2, 0]` puis protocole par blocs ; si la
  montre répond `COMMAND = 0`, c'est un rejet (typiquement « fichier déjà présent »
  car la suppression précédente n'était pas terminée).
- **Timeout d'inactivité officiel** : `INACTIVITY_TIMEOUT_MILLISECONDS = 20000`
  (les ~20 s de déconnexion observées sur une montre en attente de handshake).

### 10.3 Protocole d'envoi exact (sendNextPacketAfterDelay, vérifié au smali)

- Bloc = **5118 octets de données** (255 paquets de 20 + paquet final de 18).
- Paquets de 20 octets espacés de ~25 ms (débit 800 o/s).
- **CRC16 sur les données du bloc** (accumulées), ajouté au **dernier paquet de données** :
  - cas normal : dernier paquet = données restantes (≤ 18) + **2 octets CRC** ;
  - cas limite (19 octets restants) : paquet = 19 données + **1 octet CRC**, puis un
    paquet séparé d'1 octet avec le 2e octet CRC ;
  - **cas multiples de 20** : après les paquets de 20, un paquet final ne contenant que
    les 2 octets CRC (la boucle continue tant que le paquet de fin de bloc n'est pas parti).
- La montre accuse chaque bloc via une notification `TRANSFER_BLOCK` (int32 LE) :
  - `n` = numéro du bloc suivant attendu (commence à 1) ;
  - `-1` (0xFFFFFFFF) = renvoi du bloc ;
  - `0` = refus du fichier.
- Tous les blocs envoyés → la montre notifie `COMMAND 0x01` (confirmation finale).

### 10.4 Détails complémentaires

- **Types d'écriture GATT** (officiel) : `COMMAND`, `APP_VERSION`, `AUTH_TOKEN` →
  `WRITE_TYPE_SIGNED` (2) ; `TRANSFER_LENGTH/PACKET/BLOCK` → `WRITE_TYPE_NO_RESPONSE` (1).
- **Bonding** : l'appli appelle `createBond()` si l'appareil n'est pas lié
  (`BleDevice.connect` → `initiateBonding`).
- **Reconnexion** : après un état PRÊT, si la montre coupe, l'appli se reconnecte
  automatiquement (daemon `AUTO_CONNECT_BACKGROUND_TIMEOUT(10 s, 20 s)`).
- **PIN en reconnexion** : si le token stocké est encore connu de la montre, la montre
  répond `AUTH_TOKEN = 3` (RECONNECT) et l'appli enchaîne sans redemander le PIN. En
  revanche, un nouvel appairage affiche un **nouveau PIN** — un client doit toujours
  laisser la possibilité de saisir le nouveau code (ne pas réutiliser aveuglément
  l'ancien).
- **Réglages de l'heure** : `SET_TIME` (code 8) est envoyé au démarrage du watch handler
  (`SportsWatchHandler2`), avec la lecture de la batterie, puis l'état passe IDLE
  (connexion maintenue, en attente de notifications SYNC).
