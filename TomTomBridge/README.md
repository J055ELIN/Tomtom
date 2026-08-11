# TomTom Bridge — client Bluetooth LE autonome pour montres TomTom Sports

Application Android (Java, sans dépendance externe) qui se connecte en **Bluetooth LE**
à une montre TomTom Sports (Runner, Spark, Multi-Sport, Adventurer, Golf, …) et dialogue
avec elle en utilisant le protocole observé dans l'application officielle
« TomTom Sports » 10.0.9 (voir `analyse_tomtom_sports.md`).

> L'APK pré-compilé se trouve à la racine : **`TomTomBridge-debug.apk`** (signé debug,
> ~42 Ko, minSdk 23 / targetSdk 33).

## Fonctionnalités

- **Scan** des montres TomTom (filtre : données fabricant ID `0x0100` + services GATT
  `170d0d30…` V1 / `b993bf90…` V2, indicateur « appairage »).
- **Connexion + appairage V2** : la montre affiche un **PIN** sur son écran → saisie dans
  l'application → échange AUTH_TOKEN (le PIN est mémorisé pour les reconnexions).
- Montres **V1** : connexion directe, sans PIN.
- Lecture des **informations** (modèle, n° de série, firmware…) et de la **batterie**.
- **Réglage de l'heure** de la montre (commande `SET_TIME`).
- **Liste des entraînements** (.ttbin, type 145) et **téléchargement** vers le téléphone.
- **Téléchargement des données de pas** (.bucket, type 177).
- **Suppression** d'un fichier sur la montre (API prête ; le bouton n'est pas exposé).
- Journal complet des échanges (hexadécimal des trames).

## Installer

```bash
# via adb (débogage USB activé) :
adb install TomTomBridge-debug.apk
```
Ou copier `TomTomBridge-debug.apk` sur le téléphone et l'ouvrir (autoriser
« sources inconnues »).

## Utiliser

1. Activer le **Bluetooth** (et la localisation sur Android ≤ 11).
2. Ouvrir l'application → **Scanner**. La montre apparaît avec son type (V1/V2).
3. Toucher la montre dans la liste → **Connecter**.
4. La montre affiche un **PIN** → le saisir dans la boîte de dialogue
   (pré-remplie avec le dernier code ; **remplacez-le si la montre affiche un
   nouveau PIN**).
5. L'application enchaîne automatiquement le **handshake complet** :
   lecture des capacités → lecture des informations → **suppression puis envoi du
   « master name »** → réglage de l'heure → « Prêt ✓ — connexion maintenue ».
6. Boutons : **Infos**, **Batterie**, **Régler heure**, **Lister entraîn.**,
   **Téléch. entraîn.** (liste puis télécharge tous les `.ttbin`),
   **Téléch. pas** (idem pour les `.bucket`).
7. Les fichiers sont enregistrés dans :
   `Android/data/com.tomtombridge.app/files/tomtom/workouts/` et `.../steps/`
   (récupérables via `adb pull` ou l'explorateur de fichiers).

> **Pourquoi la montre se déconnectait après ~20 s ?**
> L'échange du PIN ne suffit pas : l'application officielle exécute ensuite
> **suppression + envoi du fichier « mastername »** (type 2, n° 2, contenant le nom
> Bluetooth du téléphone) — c'est cette opération qui fait sortir la montre de
> l'écran PIN et valide la connexion côté firmware. Sans elle, la montre reste en
> attente puis coupe la liaison (~20 s). La nouvelle version reproduit ce handshake
> exactement (algorithme d'envoi par blocs vérifié au smali, voir
> `analyse_tomtom_sports.md` §10), attend le lien Bluetooth système avant d'ouvrir
> le GATT, et se reconnecte automatiquement en cas de coupure.

> **Correctif v3 (après test matériel) :** la montre *acceptait* la suppression du
> master name (COMMAND=1) mais celle-ci n'était pas **terminée** — la confirmation
> réelle arrive par un paquet TRANSFER_PACKET (3 octets : 0/2 = terminé, 3 = en
> cours) puis une notification COMMAND finale. L'application enchaînait trop vite :
> le fichier existait encore, et la montre **rejetait l'envoi** du nouveau master
> name (COMMAND=0), bloquant le handshake. La v3 attend désormais les 3 étapes
> (COMMAND=1 → paquet de confirmation → COMMAND finale) avant d'envoyer, et aligne
> le timeout d'inactivité sur l'officiel (20 s).

## Recompiler

Prérequis : JDK 11+, Android SDK (platform 33 + build-tools 33.0.2).

```bash
# soit via ANDROID_HOME :
export ANDROID_HOME=/chemin/vers/android-sdk
./gradlew assembleDebug            # → app/build/outputs/apk/debug/app-debug.apk
# soit en créant un fichier local.properties :
#   sdk.dir=/chemin/vers/android-sdk
```

## Notes techniques (résumé du protocole)

| Service | UUID |
|---|---|
| File Transfer V1 | `170d0d30-4213-11e3-aa6e-0800200c9a66` |
| File Transfer V2 | `b993bf90-81e1-11e4-b4a9-0800200c9a66` |
| Communications Setup (appairage V2) | `b993bf91-81e1-11e4-b4a9-0800200c9a66` |

Caractéristiques File Transfer : COMMAND `…31`, LENGTH `…32`, PACKET `…33`
(20 octets), BLOCK `…34` (4 octets LE). Paquets de 20 octets, blocs de 256 paquets
(5120 octets), **CRC-16/MODBUS** en fin de bloc. Commandes : 0=envoi, 1=réception,
3=liste, 4=suppression, 8=heure. Types : entraînements 145 (`.ttbin`), pas 177 (`.bucket`).

Tout le détail est dans `analyse_tomtom_sports.md` (à la racine du workspace).

## Limites / à savoir

- Le code est une **implémentation originale** du protocole, basée sur l'analyse des
  sources décompilées de l'application officielle (UUID, formats d'octets : faits
  techniques non protégés). Aucun code propriétaire n'a été copié.
- **Non testé sur montre réelle** dans cet environnement : la logique a été vérifiée
  contre le code décompilé et les formats validés (CRC, commandes, structure des
  blocs), mais un essai sur matériel reste nécessaire.
- La montre ne doit pas être simultanément connectée à une autre application.
- Certaines montres peuvent exiger un appairage système (l'application déclenche
  `createBond` automatiquement).
- L'appairage officiel enchaîne des étapes liées au compte MySports (préférences,
  ownership) qui ne sont **pas nécessaires** pour un dialogue local ; elles ne sont
  donc pas implémentées ici.
