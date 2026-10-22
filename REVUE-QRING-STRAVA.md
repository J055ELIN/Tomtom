# Revue de l'application QRing → Strava

**Date :** 21 octobre 2026
**Projet examiné :** `qring-strava-bridge/` — branche `arena/20770d9e-tomtom`, commit `cc27db1`
(« QRing v4.1 : client Strava testable et testé hors téléphone »)
**APK examinée :** `qring-strava-bridge/releases/QRingStravaBridge-v4.1.apk`
(66 087 octets, `versionCode 14`, `versionName 4.1`, package `com.qring.strava.bridge`)

> L'application **n'existe ni sur `main` ni sur la branche de cette session** (`arena/5a914645-tomtom`) :
> elle a été lue depuis la branche `arena/20770d9e-tomtom` (fetch en lecture seule, sans changer de branche).
> Toutes les références de ligne ci-dessous correspondent à ce commit.

---

## 1. Ce que fait l'application (et ce qui marche)

```
Bague QRing/Colmi ──BLE──► Android ──BLE (périphérique)──► Strava / Wahoo / Garmin
 (UART 6E40FFF0, 0x69)     GATT 0x180D + publicité          (FC en direct, 2e téléphone)
                              │
                              └──► enregistrement FC + GPS ──► TCX ──► import ou API Strava
```

Points solides :

* le serveur GATT (FC `0x180D` / `0x2A37`, batterie, Device Info) et la publicité BLE sont
  correctement construits, avec enregistrement **séquentiel** des services (`HrmPeripheral`) ;
* le protocole de la bague (trames 16 octets, checksum, `0x69`/`0x6A`/`0x1E`) est documenté
  et cohérent avec le client Python `qlam-ai/qring` ;
* la contrainte « un téléphone ne voit jamais ses propres publicités » est bien comprise
  et documentée ; le test à deux téléphones est la bonne méthode ;
* aucune dépendance externe, APK compacte, permissions Android 12+/14 largement traitées ;
* le tableau « vérifié / non vérifié » du README est une excellente pratique.

En revanche, **l'envoi direct à Strava (fonction phare de la v3.9) ne peut pas fonctionner
en l'état** : le champ multipart du fichier porte le mauvais nom. C'est le point n°1.

---

## 2. Bloquant — le fichier multipart s'appelle `data` au lieu de `file`

**Fichier :** `app/src/main/java/com/qring/strava/bridge/StravaClient.java:134`

```java
writeFile(buf, boundary, "data", fileName, tcx);   // ← nom du champ
```

L'API Strava exige un champ nommé **`file`** (insensible à la casse) :

> `file:` *multipart/form-data — required, case insensitive — the actual activity data*
> — <https://developers.strava.com/docs/uploads/>

Avec un champ `data`, la requête ne contient aucun fichier : Strava répond **400**
(« file is required » / fichier manquant), donc **aucune séance n'est jamais publiée**.
Les autres champs (`data_type=tcx`, `external_id`) sont corrects.

Preuve matérielle : le dex de l'APK v4.1 contient la chaîne `data`, `data_type`,
`external_id`, `tcx`… mais **pas la chaîne `file`**. Le bug est donc bien dans l'APK livrée.

### Correctif

```java
writeFile(buf, boundary, "file", fileName, tcx);
```

### Pourquoi le test « hors téléphone » ne l'a pas vu

`tests/stravaclient/mock.py:26-28` vérifie `data_type`, le nom du fichier et le XML, mais
**jamais le nom du champ** :

```python
assert b'name="data_type"' in body and b'tcx' in body
assert b'filename="QRingHR-test.tcx"' in body
assert b'<TrainingCenterDatabase>' in body
```

Ajouter, au minimum :

```python
assert b'name="file"' in body, 'champ file manquant (Strava exige "file")'
assert b'name="data"' not in body, 'champ data interdit'
```

> Remarque : le test injecte un TCX factice (`Harness.java:22`) et non le TCX produit par
> `SessionRecorder`. Il ne valide donc ni le contenu réel, ni les cas « pas de FC »,
> « pas de GPS », etc. Voir §7.

---

## 3. Bloquant pour l'usage réel — le GPS s'arrête écran éteint

**Fichiers :** `AndroidManifest.xml:60`, `HrBridgeService.java:97`, `SessionRecorder.java:224`

```xml
android:foregroundServiceType="connectedDevice"   <!-- pas de type location -->
```

Or, depuis Android 10, un service de premier plan qui utilise la localisation **doit**
déclarer le type `location` (et, pour targetSdk 34, la permission
`FOREGROUND_SERVICE_LOCATION`) pour continuer à recevoir des positions quand l'application
n'est plus visible. Sans cela, les `requestLocationUpdates()` cessent d'être délivrés dès
que l'écran s'éteint / que l'activité passe en arrière-plan — exactement le cas d'usage
d'une sortie vélo, téléphone dans la poche.

Références : <https://developer.android.com/develop/background-work/services/fgs/service-types>
et <https://developer.android.com/about/versions/14/changes/fgs-types-required>.

Conséquence : la trace TCX est vide ou quasi vide, Strava refuse le fichier (« Empty file »),
et la fonction d'enregistrement perd son intérêt.

### Correctif

Manifeste :

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
...
<service
    android:name=".HrBridgeService"
    android:exported="false"
    android:foregroundServiceType="connectedDevice|location" />
```

Service (API 29+) : ne demander le type `location` que si la permission est accordée,
sinon on retombe proprement sur `connectedDevice` :

```java
int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
if (Build.VERSION.SDK_INT >= 29
        && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
           == PackageManager.PERMISSION_GRANTED) {
    type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
}
startForeground(NOTIF_ID, buildNotification(), type);
```

Nuances à traiter :

* le service est `START_STICKY` (`HrBridgeService.java:135`) : s'il est relancé par le
  système alors que l'application est en arrière-plan, démarrer un FGS `location` peut
  lever `SecurityException` sans `ACCESS_BACKGROUND_LOCATION`. Il faut soit démarrer en
  `connectedDevice` seul sur relance système (`intent == null`), soit passer
  `START_NOT_STICKY` et laisser l'utilisateur relancer ;
* entourer `startForeground()` d'un `try/catch (SecurityException)` pour afficher un
  message clair au lieu de tuer le processus (cf. §8).

---

## 4. TCX : tous les points sans FC sont supprimés — fichier vide possible

**Fichier :** `SessionRecorder.java:355`

```java
for (Sample s : copy) {
    if (s.bpm <= 0) {
        continue;                  // ← supprime aussi la position GPS
    }
    ...
    <Trackpoint>…</Trackpoint>
}
```

Si la bague ne délivre pas encore la FC (démarrage, capteur mal porté, flux interrompu),
les points GPS sont **jetés avec la FC**. Si aucune FC n'arrive de la séance, le fichier
contient `<Track></Track>` vide → Strava refuse. Et même avec une FC intermittente, la
trace GPS est trouée.

Or Strava n'exige que l'horodatage de chaque point ; la position et la FC sont optionnelles
(<https://developers.strava.com/docs/uploads/>, section TCX).

### Correctif

Toujours écrire le `Trackpoint` (au moins `<Time>`), et n'ajouter `<HeartRateBpm>` que si
`s.bpm > 0` :

```java
sb.append("<Trackpoint>\n");
sb.append("  <Time>").append(fmt.format(new Date(s.time))).append("</Time>\n");
if (!Double.isNaN(s.lat) && !Double.isNaN(s.lon)) { /* <Position> */ }
if (s.bpm > 0) { /* <HeartRateBpm> */ }
sb.append("</Trackpoint>\n");
```

Et refuser l'envoi avec un message explicite si la séance ne contient **ni position ni FC**
(plutôt qu'un fichier vide renvoyé par Strava).

**Bonus :** filtrer les points GPS dont `getAccuracy()` dépasse ~30 m, sinon un saut GPS
gonfle la distance (`totalDistance()` additionne tous les segments sans contrôle).

---

## 5. Une séance simulée peut être publiée sur Strava

**Fichiers :** `HrBridgeService.java:108`, `MainActivity.java:484` et `:769-782`

Le service démarre l'enregistrement **dans tous les cas**, y compris en mode test :

```java
if (recorder != null && !recorder.isRecording()) {
    recorder.start();                       // aussi en mode simulation
}
```

Le mode test alimente `recorder.onHeartRate(bpm)` avec une sinusoïde. À l'arrêt,
`stopBridge()` programme `autoUploadIfLinked()` (2,5 s plus tard) qui vérifie seulement :

* compte Strava lié ;
* séance ≥ 60 s ;
* TCX non vide.

Résultat : **un test de plus d'une minute avec la FC simulée publie une fausse activité
sur le compte Strava**. C'est un problème de confiance des données, en plus d'être
surprenant.

Même mécanisme au mauvais endroit : le bouton **« Déconnecter »** et le bouton
**« Arrêter le pont »** appellent tous les deux `stopBridge()` (donc envoi automatique),
et `stopBridge()` est aussi appelé par le renommage Bluetooth.

### Correctif

1. Marquer la séance comme simulée (`SessionRecorder.setSimulated(boolean)` au démarrage) ;
2. dans `autoUploadIfLinked()`, ne rien envoyer si la séance était simulée ;
3. ne déclencher l'envoi automatique que sur une action explicite « Terminer la séance » ;
   « Déconnecter » ne devrait pas publier ;
4. ne pas réutiliser `stopBridge()` pour le renommage (voir §6).

---

## 6. Renommage : coupe la séance et repart en simulation

**Fichier :** `MainActivity.java:929-952`

```java
stopBridge();
handler.postDelayed(new Runnable() {
    public void run() {
        startBridge(null, null, true);      // ← simulation, pas la bague
    }
}, 1200L);
```

Après un renommage Bluetooth, l'application :

* arrête le pont et la séance en cours (avec envoi automatique éventuel) ;
* supprime l'adresse de la bague mémorisée, car `startBridge(null, null, true)` écrit
  `putString(PREF_ADDR, null)` (`MainActivity.java:442`, ce qui **efface** la préférence) ;
* redémarre en **mode test** avec une FC simulée.

Il faut redémarrer avec `selectedAddress` / `selectedName` (relus dans les préférences) et
ne pas toucher aux préférences quand `address == null`.

---

## 7. Le test « vérifié hors téléphone » est plus faible qu'annoncé

Le README présente comme **vérifié** : « Le client d'envoi Strava (OAuth + multipart +
suivi) ». Ce que le harnais teste réellement :

| Testé | Non testé |
|---|---|
| l'URL, les paramètres OAuth et l'échange de code | le nom du champ fichier (`data` vs `file`) → bug §2 |
| la présence d'un multipart, de `data_type`, d'un fichier | le TCX réellement produit par `SessionRecorder` |
| le polling et le jeton Bearer | le vrai serveur Strava, les erreurs 400/401 réelles |
| | le retour du navigateur (`qringhr://qringhr`) |
| | le comportement sans FC / sans GPS |

Pour rendre la garantie honnête :

1. faire échouer le mock si le champ n'est pas `file` (§2) ;
2. extraire la construction TCX dans une classe **sans dépendance Android**
   (`TcxBuilder`, avec un calcul de distance haversine) et la compiler dans le harnais ;
3. ajouter des cas : FC présente, FC absente, GPS absent, séance d'un seul point,
   sport « Biking » ;
4. tester `state` OAuth (§8) ;
5. ajouter le workflow CI (actuellement seulement dans `ci/`, jamais copié dans
   `.github/workflows/` : il ne s'exécute donc pas).

---

## 8. Autres défauts (moyens)

| # | Sujet | Détail | Fichier |
|---|---|---|---|
| 1 | **OAuth sans `state`** | `qringhr://qringhr?code=…` est accepté sans contrôle. Une application tierce peut injecter un code d'autorisation et lier l'appli au compte Strava de son choix (puis les sorties y sont publiées). Générer un `state` aléatoire, le stocker, le vérifier au retour. | `StravaClient.java:80-87`, `MainActivity.java:724-760` |
| 2 | **Jeton expiré** | Si le refresh échoue, `validToken()` renvoie `null` et l'UI affiche « Compte Strava non lié. » alors que le compte l'est : l'utilisateur ne sait pas qu'il doit relier. Distinguer « non lié » et « jeton refusé, relier à nouveau ». | `StravaClient.java:179-199` |
| 3 | **CCCD non vérifié** | `onDescriptorWrite()` appelle `onReady()` même si `status != GATT_SUCCESS` : le pont croit recevoir la FC alors que les notifications sont refusées. Vérifier le statut et réessayer. | `RingBleClient.java:325-330` |
| 4 | **Type d'écriture** | `WRITE_TYPE_NO_RESPONSE` imposé ; certaines bagues n'acceptent que « write with response ». Choisir selon `rxChar.getProperties()`. | `RingBleClient.java:228-230` |
| 5 | **Sport Strava** | TCX `Sport="Other"` : Strava ne mappe que `biking`, `running`, `hiking`, `walking`, `swimming`. Une sortie vélo n'est donc pas classée comme vélo. Ajouter un choix de sport (défaut `Ride`) et le champ `sport_type` du multipart. | `SessionRecorder.java:344`, `StravaClient.java:130-134` |
| 6 | **Séance non persistée** | Les points sont uniquement en mémoire. Mort du processus, mise à jour de l'appli ou redémarrage → la sortie est perdue. Écrire un journal (JSON/CSV) toutes les 10 s et le recharger. | `SessionRecorder.java` |
| 7 | **Perf UI** | `getDistanceMeters()`, `getAverageHr()`, `getMaxHr()` recalculent **tous** les points chaque seconde sur le thread principal (jusqu'à ~15 000 points après 4 h). Maintenir des accumulateurs. | `SessionRecorder.java:119-150`, `MainActivity.java:509-523` |
| 8 | **Couleur d'état inversée** | Le README dit « bleu = une appli est connectée », mais `advertising` est testé avant `peripheralClients` : l'état reste **vert** quand un client est connecté. | `MainActivity.java:539-545` |
| 9 | **`startForeground` non protégé** | Permission `BLUETOOTH_CONNECT` refusée → `SecurityException` dans `onStartCommand` → crash. Entourer et afficher un message. | `HrBridgeService.java:97` |
| 10 | **`POST_NOTIFICATIONS` sur Android 12** | La permission n'existe qu'à partir d'Android 13 ; la demander sur 31/32 ajoute une étape inutile. Conditionner à `TIRAMISU`. | `MainActivity.java:245-262` |
| 11 | **`stravaUploadPending` volatil** | Si le processus est tué pendant l'autorisation dans le navigateur, le retour lie le compte mais n'envoie pas la séance. Persister le drapeau. | `MainActivity.java:714` |
| 12 | **Double connexion possible** | « Connecter la bague » reste actif quand le pont tourne : un second `connectGatt()` peut être créé sans fermer le premier. Désactiver le bouton ou court-circuiter si déjà connecté. | `MainActivity.java:432-465` |

---

## 9. Documentation à corriger

* README §8 (`README.md:357`) : « Aucune connexion réseau : l'application ne parle qu'à la
  bague et au téléphone » — **faux depuis la v3.9** (OAuth + upload Strava).
* README §8 (`README.md:356`) : « keystore de debug non versionnée » — elle **est**
  versionnée (`qring-strava-bridge/debug.keystore`) et le `.gitignore` l'assume.
* README §6 (`README.md:339`) : « Exécution sur appareil réel ⏳ à faire » contredit les
  sections « vérifié » du §3 quaterdecies et le test à deux téléphones.
* README ligne 11 : APK annoncée à **41 Ko** ; la v4.1 fait **66 087 octets** (la taille
  correspond à la v3.1).
* §7 « Fichiers » ne mentionne ni `StravaClient.java`, ni `SessionRecorder.java`, ni
  `SelfTest.java`, ni `tests/`.
* `SOP-QRING-STRAVA-v3.md` est resté en v3.0/v3.1 alors que l'appli est en v4.1.
* Les sections du README sont numérotées dans un ordre difficile à suivre
  (`3`, `3 ter`, `3 quater`, …, `3 quaterdecies`) : une table des matières chronologique
  serait plus lisible.

---

## 10. Plan de correction proposé (v4.2)

| Priorité | Correctif | Effort |
|---|---|---|
| P0 | Champ multipart `file` + assertion dans le mock | 5 min |
| P0 | Type FGS `location` + permission + `startForeground` typé | 30 min |
| P0 | TCX : conserver les points sans FC ; refuser un fichier sans position ni FC | 20 min |
| P1 | Pas d'envoi automatique d'une séance simulée ; « Déconnecter » ≠ « Terminer » | 30 min |
| P1 | Renommage : redémarrer avec la bague, ne pas effacer `PREF_ADDR` | 15 min |
| P1 | `sport_type` (Ride par défaut) + TCX `Biking` | 20 min |
| P1 | `state` OAuth | 20 min |
| P2 | Test TCX réel hors appareil + cas sans FC / sans GPS | 1 h |
| P2 | Persistance de la séance + accumulateurs de distance/FC | 1–2 h |
| P2 | Mise à jour README/SOP + copie du workflow CI | 30 min |

**Validation** : `bash tests/stravaclient/run.sh` (avec `ECJ_JAR`), puis build
`bash build.sh` ou `./gradlew :app:assembleDebug`, puis test sur le Pixel 9a :
mode test → Strava (second téléphone) ; sortie réelle écran éteint → TCX avec GPS ;
envoi direct → vérifier l'activité sur strava.com ; test « pas de FC » → pas de fichier vide.

---

## 11. Limites de cette revue

* Revue **statique** : le sandbox de cette session n'a ni JDK, ni SDK Android, ni émulateur ;
  l'APK n'a donc pas pu être reconstruite. Les téléchargements de JDK depuis GitHub Releases
  sont bloqués (hôte `release-assets.githubusercontent.com`).
* L'APK v4.1 a été inspectée (manifeste, permissions, dex) : `foregroundServiceType=0x10`
  (`connectedDevice`), absence de la chaîne `file` dans le dex, présence de `data`.
* Les affirmations « vérifié » du README qui reposent sur des journaux du Pixel 9a n'ont pas
  été rejouées ; elles sont prises pour acquises, mais le bug §2 montre que la catégorie
  « vérifié hors téléphone » doit être resserrée.

---

## 12. Conclusion

L'application est bien construite sur le plan BLE (le plus difficile) et l'idée du pont
GATT est validée par les tests à deux téléphones. Mais **la promesse centrale de la v3.9 —
« un bouton, la séance part sur Strava » — est cassée par un seul nom de champ multipart**,
et l'enregistrement GPS ne survit pas à l'extinction de l'écran. Ces deux points, plus la
publication possible d'une séance simulée, doivent être corrigés avant de considérer la
v4.1 comme utilisable en conditions réelles.

La base est saine : les correctifs P0 sont localisés (une ligne pour le multipart, le
manifeste + `startForeground` pour le GPS, une boucle TCX pour les points sans FC).
