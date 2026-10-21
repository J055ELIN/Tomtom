# Analyse de l'application Strava officielle (`com.strava`)

**Objet** — comprendre ce que fait réellement Strava côté **capteurs BLE** et **envoi d'activités**, afin de valider ou de corriger le pont `qring-strava-bridge`.

**Version visée** : 484.10 (XAPK déposé sur Drive)
**Version réellement analysée** : **456.10** (analyse statique publique documentée) + documentation officielle Strava
**Date** : 21 octobre 2026

---

## 0. Résumé exécutif

1. **Le XAPK 484.10 n'a pas pu être ouvert ici.** Le fichier pèse 152 556 102 octets, au-delà du plafond de 100 MiB (104 857 600 octets) des outils de ce workspace, et le réseau Google est coupé côté `curl`. Aucun octet du binaire 484.10 n'a donc été lu. Les conclusions ci-dessous reposent sur trois sources indirectes, explicitées au §1.2, et sont notées **[DOC]**, **[OBS]** ou **[INF]** (voir §1.3).
2. **Strava n'accepte qu'un seul type de capteur BLE : le cardiofréquencemètre** (service `0x180D`). Pas de puissance, pas de cadence, pas d'ANT+ — c'est écrit noir sur blanc dans l'aide officielle. **Le choix architectural du pont QRing (se faire passer pour une ceinture HR) est donc le seul compatible**, et Strava cite même explicitement les « bridge devices » comme solution.
3. **L'application est centrale BLE uniquement.** Elle embarque `RxAndroidBle3` 1.18.1 et demande `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT`, mais **jamais** `BLUETOOTH_ADVERTISE` : elle ne peut pas s'annoncer comme périphérique. Un téléphone ne peut pas voir ses propres *advertisements* → **le pont a besoin d'un second téléphone**, ce que la revue disait déjà, et ce que le binaire confirme.
4. **L'upload public passe par `POST /api/v3/uploads` avec un champ multipart nommé `file`.** Le pont envoie `data` → **400 systématique**. Le P0 n°1 de la revue est confirmé par le contrat officiel.
5. **TCX : seuls `biking`, `running`, `hiking`, `walking`, `swimming` sont mappés.** `Sport="Other"` — ce qu'écrit le pont — n'est pas reconnu. Le P1 est confirmé, et la correction exacte est connue (§4.4).
6. **Chaque point de trace doit porter un `<Time>`.** Le pont saute tous les points où `bpm <= 0`, donc peut produire un TCX **sans aucun trackpoint**. P0 n°3 confirmé.
7. **Nouveau, et important** : le pont enregistre bien le GPS (`LocationManager.GPS_PROVIDER`), mais son service de premier plan est typé `connectedDevice` **sans** `location`. Écran éteint, Android coupe la localisation → la trace GPS se vide. C'est la vraie formulation du P0 n°2 (§5.2), plus précise que celle de la revue.
8. **Nouveau** : Strava ne lit **pas** la fréquence cardiaque depuis Health Connect (il y *écrit* des activités et y *lit* le poids). Il n'existe donc **aucune** voie alternative au pont HRS pour injecter de la FC live (§6.3).
9. **Nouveau** : un appareil inconnu dans `<Creator><Name>` n'est pas mappé. Le pont déclare `QRing HR Bridge` sans enregistrement → libellé générique côté Strava (§4.3).
10. Le mode d'usage recommandé n'est pas l'upload par le pont, mais **le pont comme ceinture HR d'un second téléphone qui enregistre avec Strava** : c'est le seul qui produise une activité avec trace GPS + FC, sans doublon ni activité « stationnaire » (§4.5).

---

## 1. Portée, méthode et preuves

### 1.1 Pourquoi 484.10 n'a pas été analysé

| Tentative | Résultat |
|---|---|
| `get_file` Drive `1X6pVpDwOQF7XEFRHQQdhXHRTHU8h-5MN` | métadonnées OK — 152 556 102 B, MD5 `444c7cb13e1e09949c85a083dbb8f361`, SHA-256 `e0ddf038e7660613b741438a3bbc9d83662d60c5241379b61567068057c7e5e7` |
| `download_file` | **refusé** : 152 556 102 B > 100 MiB (104 857 600 B) |
| `read_file_text` | **refusé** : plafond d'extraction 25 Mo |
| `curl` Drive / `www.googleapis.com` | **HTTP 000**, `exit 35` (`SSL_ERROR_SYSCALL`) — réseau Google bloqué |
| Variante `STRAVA-477.14.zip` (`17NrxRQA5KgZE38JrnR8OtWdjLat9KgW2`) | 153 793 181 B — même plafond, même échec |

Trois options permettent d'aller plus loin (détail au §8) : **découper le zip en volumes < 100 MiB**, déposer le **seul `base.apk`** de l'XAPK, ou valider l'analyse indirecte ci-dessous.

### 1.2 Les trois sources réellement utilisées

| # | Source | Version | Nature | Force |
|---|---|---|---|---|
| A | `github.com/Kamalakanta01/openstride` — `docs/00` à `12`, `spec/` | **456.10** (versionCode 12397026) | analyse statique publique, méthode et outillage documentés (jadx 0.7.1, Ghidra 12.1.4, `readelf`, scripts `axml.py`/`arsc.py`/`derefx.py`) | forte sur le manifeste, les permissions, les dépendances, les chaînes DEX ; **muette sur le runtime** |
| B | `developers.strava.com/docs/uploads/` | contrat courant (2026) | documentation officielle de l'API | **autoritaire** sur l'upload |
| C | `support.strava.com` — « Pairing Sensors with the Strava app » (maj 24/03/2026) | applicable à 484.10 | aide officielle | **autoritaire** sur les capteurs |

L'écart 456.10 → 484.10 est de **28 versions** (≈ 6 mois). Tout ce qui est structurel (rôle BLE central, permissions, absence d'ANT+, contrat d'upload, formats de fichier) est stable ; tout ce qui est cosmétique ou interne a pu changer, et c'est signalé.

### 1.3 Convention de notation

- **[DOC]** — affirmé par la documentation officielle Strava, vérifiable en ligne.
- **[OBS]** — observé dans un binaire (456.10), avec la référence du fichier d'analyse.
- **[INF]** — inférence : cohérent avec les deux précédents, mais non prouvé.

---

## 2. Identité de l'application (456.10)

| Élément | Valeur | Note |
|---|---|---|
| Conteneur | **XAPK v2** (pas un APK installable) | 6 entrées, toutes stockées sans compression |
| `base` (`com.strava.apk`) | **87 210 060 B** | manifeste + 7 DEX + 2,68 Mo d'`resources.arsc` + 5 773 `res/` |
| Splits | `config.armeabi_v7a` (26,5 Mo, 12 `.so`), `config.mdpi` (6,2 Mo), `config.en` (164 Ko) | `requiredSplitTypes=base__abi,base__density` |
| `minSdk` / `targetSdk` | **26** / **35** | cible Android 15 |
| Signature | APK Signature Scheme **v2 + v3**, même signataire ; pas de v1 | distribution Play (`STAMP_TYPE_DISTRIBUTION_APK`) |
| Code | **72 470** `class_defs` sur 7 DEX, dont **63 %** renommés par R8 | analyse par nom de classe largement impossible |
| Manifeste | **336** activités, **23** services, **28** receivers, **16** providers, **130 composants exportés**, 43 permissions | [OBS] `docs/05` |
| Réseau | **58** hôtes, **182** chemins d'API distincts (dont 101 Strava) | [OBS] `docs/01` |

**Pourquoi ces chiffres servent l'analyse** : les 130 composants exportés constituent la surface par laquelle une autre application — ou l'utilisateur — peut piloter Strava. C'est de là que vient le deep link utile du §3.4.

---

## 3. Capteurs BLE — le cœur du sujet QRing

### 3.1 Ce que Strava accepte officiellement [DOC]

L'aide officielle (mise à jour le 24 mars 2026, donc valable pour 484.10) dit, en substance :

> « L'application mobile Strava (version 169 ou supérieure) prend actuellement en charge **les cardiofréquencesmètres Bluetooth Low Energy (BLE)**. »

et, à propos des autres capteurs :

> « **Pouvons-nous appairer des capteurs de puissance ou de cadence ?** Notre plan est d'abord de déployer les cardiofréquencesmètres […] avant d'étendre aux capteurs de puissance/cadence. »
> « **Pouvons-nous appairer un appareil ANT+ ?** À ce jour, nous n'avons aucun projet d'adopter ANT+ dans notre application mobile […] vous êtes libre d'explorer ce qu'on appelle un **bridge device**. Les bridge devices permettent de connecter des capteurs ANT+ en Bluetooth à votre enregistrement Strava. »

Trois conséquences directes, et une aubaine :

| Conséquence | Portée pour le pont QRing |
|---|---|
| **Seul le profil HRS (`0x180D`) est appairé** | Le choix de la revue — imiter une ceinture HR — est **le seul** qui ait une chance d'être listé par l'écran « Add a Sensor ». Un service de cadence (`0x1816`) ou de puissance (`0x1818`) ne serait jamais proposé. |
| **Pas d'ANT+** | Inutile d'envisager un pont ANT+ → BLE : Strava ne parle pas ANT+ du tout. |
| **Un seul capteur à la fois** | « Le Bluetooth ne permet de s'appairer qu'à un seul appareil à la fois. » Le pont occupera **tout l'emplacement capteur**. Si l'utilisateur veut aussi une ceinture thoracique, c'est impossible en même temps. |
| **La notion de « bridge device » est explicitement citée** | Le projet QRing n'est pas un contournement : c'est le patron que Strava recommande elle-même pour l'ANT+. |

### 3.2 Ce que le binaire montre [OBS]

| Preuve | Fichier d'analyse | Lecture |
|---|---|---|
| `com.polidea.rxandroidble3:rxandroidble:1.18.1`, 4 classes retenues | `docs/02-dependencies.md` §3 | Strava est **central BLE** : il scanne, se connecte, s'abonne. |
| `android.permission.BLUETOOTH`, `BLUETOOTH_ADMIN` (maxSdk 30), `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | `docs/05` §2 | scan + connexion autorisés |
| **`BLUETOOTH_ADVERTISE` absent** des 43 permissions | `docs/05` §2 | Strava **ne peut pas** s'annoncer comme périphérique. Aucune chance qu'il se fasse passer pour un capteur. |
| Modules `com.strava.recordingui` (« écran d'enregistrement, réglages, annonces audio, **capteurs** ») et `com.strava.recording` (« moteur d'enregistrement ») | `docs/06` §3 | la pile capteur est bien dans le module d'enregistrement, pas dans un module isolé |
| `foregroundServiceType="location"` sur `com.strava.recording.StravaActivityService` | `docs/05` §4 | l'enregistrement Strava est un FGS **location** — voir §5 |

**Ce que cela implique pour le pont** : les deux téléphones jouent des rôles **asymétriques et non interchangeables**. Le téléphone qui porte Strava est central ; celui qui porte le pont est périphérique. Le pont ne peut donc pas être « vu » par Strava s'il tourne sur le même téléphone — un téléphone ne capte pas ses propres *advertisements* (limite du contrôleur Bluetooth, pas de l'app). C'est exactement la conclusion de la revue, désormais adossée au binaire.

### 3.3 Ce qui reste invisible

Ces points ne peuvent **pas** être tranchés sans le binaire 484.10 (voire sans exécution) :

- la **liste d'UUID filtrée** au scan : Strava filtre-t-il sur `0x180D` dans l'*advertisement*, dans les *scan response*, ou après `discoverServices()` ?
- accepte-t-il un périphérique **non appairé** (pas de *bonding*) ?
- exige-t-il `0x2A37` en **Notify** uniquement, ou lit-il aussi la valeur à la connexion ?
- tolère-t-il l'absence de `0x2A38` (Body Sensor Location) ?
- que fait-il d'un `0x2A37` dont le champ *flags* indique « valeur 8 bits » vs « 16 bits » ?
- comportement en cas de **déconnexion** : reconnexion automatique, ou retour à l'écran « Add a Sensor » ?
- gestion du **MTU** et du débit de notifications.

Aucune de ces questions n'est bloquante : le profil HRS est suffisamment normé pour que l'implémentation actuelle du pont (16 bits, Notify, `0x2A38` présent) passe le filtre dans la très grande majorité des cas. Mais elles expliquent pourquoi un **test réel** reste nécessaire.

### 3.4 Le deep link utile [OBS]

Le manifeste expose `strava://record` et `strava://record/settings/sensors` (`docs/01` §3.1, `docs/05`). Le pont peut donc ouvrir **directement l'écran de recherche de capteurs** :

```java
Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("strava://record/settings/sensors"));
i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
context.startActivity(i);
```

C'est un gain d'ergonomie réel : l'utilisateur n'a plus à chercher « Record → glisser vers le haut → Add a Sensor ». À faire dans un `try/catch` (`ActivityNotFoundException` si Strava n'est pas installé), et **sans** `FLAG_ACTIVITY_CLEAR_TASK`.

### 3.5 Exigences du pont, une par une

| Exigence | Statut | Justification |
|---|---|---|
| S'annoncer avec le service `0x180D` | **requis** | [DOC] seul profil appairé |
| Exposer `0x2A37` (Heart Rate Measurement) en **Notify** | **requis** | standard HRS ; [INF] Strava s'abonne |
| Exposer `0x2A38` (Body Sensor Location) en **Read** | recommandé | [INF] certains centraux le lisent ; le pont le fait déjà |
| Exposer `0x180F`/`0x2A19` (batterie) et `0x180A` (Device Info) | facultatif | aucun affichage de batterie côté Strava constaté [INF] |
| Nom d'appareil lisible (`QRing HR`) | recommandé | c'est ce que l'utilisateur voit dans la liste — un nom vide ou hexadécimal rend le choix ambigu |
| `BLUETOOTH_ADVERTISE` + `BLUETOOTH_CONNECT` côté pont | **requis** | déjà présents au manifeste |
| Un seul service annoncé (pas de `0x1816`/`0x1818`) | recommandé | évite d'être écarté par un filtre « un seul service » [INF] |
| Ne pas espérer cadence ni puissance | **acquis** | [DOC] non supporté |
| Localisation activée sur le téléphone Strava | **requis** (Android ≤ 11) | [DOC] le scan BLE exige la permission de localisation sur les anciens Android ; sur Android 12+ `BLUETOOTH_SCAN` avec `neverForLocation` suffit |
| La bague ne doit pas être connectée ailleurs | **requis** | [DOC] un périphérique BLE ne sert qu'un central à la fois |

---

## 4. Envoi d'activités

### 4.1 Deux chemins distincts, à ne pas confondre [OBS]+[DOC]

| | Application Strava (456.10) | API publique v3 |
|---|---|---|
| Endpoint | **`/api/mobile/uploads.json`** et **`/api/mobile/uploads/{token}.json`** (`classes6/7.dex`) | `POST https://www.strava.com/api/v3/uploads` |
| Autre route interne | `uploads/internal_fit`, `uploads/{upload_id}` dans le groupe « Strava REST v3 » du DEX | — |
| Authentification | jeton OAuth du **client officiel Strava** | jeton OAuth d'**une application tierce** (le pont) |
| Reproductible par un tiers ? | **non** (client_id/secret Strava, non embarqués — `docs/01` §6) | **oui** |

**Lecture** : l'application ne « triche » pas par rapport à l'API ; elle utilise simplement une API mobile privée, plus riche. Un tiers n'y a pas accès. Le pont **doit** passer par `/api/v3/uploads` — ce qu'il fait. Il n'y a donc pas de « chemin caché » à imiter.

### 4.2 Le contrat exact de `POST /api/v3/uploads` [DOC]

| Paramètre | Type | Obligatoire | Remarque |
|---|---|---|---|
| **`file`** | multipart/form-data | **oui** | le contenu du fichier. **C'est ce nom que le pont n'envoie pas.** |
| `data_type` | string | **oui** | `fit`, `fit.gz`, `tcx`, `tcx.gz`, `gpx`, `gpx.gz`, `json` (insensible à la casse) |
| `name` | string | non | à défaut, Strava fabrique « date + lieu » |
| `description` | string | non | |
| `trainer` | **integer** | non | `1` pour forcer « home trainer » ; **auto** si le fichier n'a pas de lat/lng |
| `commute` | **integer** | non | `1` pour marquer le trajet domicile-travail |
| `external_id` | string | non | doit être **unique** ; sert à la détection de doublons |
| `sport_type` | string | non | **écrase** le type détecté dans le fichier (56 valeurs, §4.4) |
| `activity_type` | string | non | **déprécié**, ignoré si `sport_type` est présent |

Réponse : objet **Upload Status** (`id`, `id_str`, `external_id`, `error`, `status`, `activity_id`). `201` = accepté (traitement asynchrone), `400` = refusé (le message peut contenir du HTML). Polling recommandé : **≥ 1 s**, traitement moyen < 2 s. Avertissement officiel : l'`id` deviendra un entier 64 bits → **utiliser `id_str`** dès maintenant.

### 4.3 Ce que Strava lit vraiment dans un TCX [DOC]

- **Chaque `<Trackpoint>` doit avoir un `<Time>`.** La règle est générale : « tous les fichiers doivent inclure une heure avec chaque trackpoint ».
- Type d'activité : `<Activity Sport="…">` avec **uniquement** `biking`, `running`, `hiking`, `walking`, `swimming`. « Aucun autre type n'est actuellement pris en charge. »
- Extensions lues : `runcadence` → cadence, `watts` → puissance.
- Seuls `<Track>`, `<TotalTimeSeconds>`, `<DistanceMeters>` et `<Calories>` du `<Lap>` sont utilisés ; tout le reste des agrégats est ignoré.
- **Appareil** : `<Creator><Name>…</Name></Creator>` est comparé à une base d'appareils connus. Un nom inconnu donne un libellé générique. Astuce officielle : suffixer le nom de **`with barometer`** force Strava à utiliser l'altitude du fichier au lieu de recalculer depuis un modèle numérique de terrain.
- **Sans lat/lng, l'activité est automatiquement marquée « stationnaire »** — point capital pour le pont (§4.5).

### 4.4 Mapping `Sport` → type d'activité

| Ce que le pont écrit | Ce que Strava en fait | Correction |
|---|---|---|
| `<Activity Sport="Other">` | **perdu** — aucun mapping | écrire `Biking` (ou `Running`/`Hiking`/`Walking`/`Swimming`) **et** envoyer `sport_type` au POST |

Valeurs `sport_type` utiles (liste officielle, 56 entrées) :
`Ride`, `MountainBikeRide`, `GravelRide`, `EBikeRide`, `EMountainBikeRide`, `VirtualRide`, `Velomobile`, `Run`, `TrailRun`, `VirtualRun`, `Walk`, `Hike`, `Swim`, `Rowing`, `VirtualRow`, `WeightTraining`, `Workout`, `HighIntensityIntervalTraining`, `Yoga`, `Elliptical`, `StairStepper`, `Wheelchair`, `Handcycle`, …

**Recommandation** : faire les **deux**. Le TCX reste lisible par n'importe quel outil (`Biking`), et `sport_type` garantit le type exact côté Strava (`Ride`, `MountainBikeRide`…). `sport_type` étant prioritaire, il couvre aussi les cas où le fichier a été produit avant la correction.

### 4.5 Le problème que personne n'avait vu : le GPS

Le pont **enregistre bien la position** (`SessionRecorder.startGps()` appelle `LocationManager.requestLocationUpdates(GPS_PROVIDER, …)`), et le TCX écrit `<Position>` quand elle existe. Mais :

1. si la permission n'est pas accordée, le code le journalise et continue — **TCX sans trace** ;
2. si le service tourne écran éteint avec un type `connectedDevice`, Android **coupe la localisation** (voir §5.2) — **TCX sans trace** ;
3. un TCX sans lat/lng est marqué **stationnaire** par Strava [DOC].

Résultat : un upload réussi peut produire une activité « home trainer » de 0 km, même quand l'utilisateur a roulé. Le pont calcule pourtant `DistanceMeters` : Strava l'ignore si les positions manquent.

**Conséquence architecturale.** Deux modes, et ils ne servent pas à la même chose :

| Mode | Dispositif | Ce qui est enregistré | Qualité |
|---|---|---|---|
| **A — le pont comme capteur** (recommandé) | Tél. 1 : Strava, enregistrement GPS | GPS par Strava + FC live par le pont | **complète** : trace, distance, dénivelé, segments, FC |
| Tél. 2 : pont + bague | — | | |
| **B — le pont comme enregistreur** | Tél. 2 seul | GPS + FC du pont → TCX → upload | dépend du GPS du tél. 2 ; aucun secours si l'upload échoue |

Le mode A est celui qui exploite réellement l'app officielle, et c'est aussi celui que Strava documente (« Add a Sensor »). Le mode B reste utile comme **filet de sécurité** (pas de second téléphone, ou Strava non installé), à condition de traiter le GPS et l'idempotence.

---

## 5. Le pipeline d'enregistrement de Strava

### 5.1 Ce que fait Strava [OBS]

| Élément | Détail | Leçon pour le pont |
|---|---|---|
| `com.strava.recording.StravaActivityService` | FGS, `foregroundServiceType="location"`, notification persistante, `start_mode == "record"` | le type FGS **suit l'usage réel** (GPS) |
| `RestartRecordingJobService` | reprise de l'enregistrement | une séance survit à un redémarrage |
| `RecoverActivityReceiver` | `BOOT_COMPLETED` + `MY_PACKAGE_REPLACED` | idem |
| `UnsyncedActivity` | activité non envoyée conservée | **pas de perte** en cas d'échec réseau |
| `workflowData` sérialisé dans l'intent | reprise à l'identique | — |

### 5.2 Ce que le pont fait, et la correction exacte

Le manifeste du pont déclare :

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
…
<service android:name=".HrBridgeService"
         android:foregroundServiceType="connectedDevice" />
```

et `HrBridgeService.java:97` appelle `startForeground(NOTIF_ID, buildNotification())`.

**Précision apportée à la revue** : l'appel à deux arguments n'est **pas** illégal ici, puisque le type est déclaré au manifeste (sur Android 14, l'exception `MissingForegroundServiceTypeException` ne frappe que les services **sans** type déclaré). Le défaut réel est ailleurs, et il est plus grave :

- le service **utilise la localisation** (`SessionRecorder` → `GPS_PROVIDER`) mais n'a **pas** le type `location` ;
- depuis Android 14 (`targetSdk` 34, celui du pont), l'accès à la position depuis un service d'arrière-plan exige précisément le type `location` : un FGS `connectedDevice` ne suffit pas. Écran éteint, la trace se vide silencieusement ;
- `FOREGROUND_SERVICE_LOCATION` est absent du manifeste.

**Correction** :

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
…
android:foregroundServiceType="connectedDevice|location"
```

```java
if (Build.VERSION.SDK_INT >= 29) {
    startForeground(NOTIF_ID, buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
          | ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
} else {
    startForeground(NOTIF_ID, buildNotification());
}
```

C'est exactement le choix que Strava fait pour lui-même — sauf que lui n'a que `location` (il n'est pas périphérique), quand le pont a besoin des **deux**.

---

## 6. Sécurité, vie privée, et voies alternatives

### 6.1 Transport [OBS]

- Pas de `<base-config>` dans `network_security_config.xml` → CAs système, TLS obligatoire, clair refusé (sauf `10.0.2.2`, alias émulateur).
- **Une seule** épingle de certificat dans tout l'APK, appliquée à `cdn-1.strava.com` et `graphql.strava.com`. **`www.strava.com/api/v3` n'est pas épinglé.** → aucune obstacle pour le pont.
- `usesCleartextTraffic` non défini.

### 6.2 Surface d'attaque [OBS]

130 composants exportés, dont des activités de debug atteignables par deep link (`MapPlaygroundActivity`, `FeatureSwitch`, `ToggleSubscriptionFragmentActivity`). Sans incidence sur le pont, sinon deux règles : **ne pas exposer de `ContentProvider`** dans le pont, et vérifier `getCallingPackage()` si un jour un receiver est exporté.

### 6.3 Health Connect / Google Fit : pas une alternative [OBS]

Permissions santé déclarées par Strava :

```
android.permission.health.WRITE_EXERCISE
android.permission.health.WRITE_DISTANCE
android.permission.health.WRITE_TOTAL_CALORIES_BURNED
android.permission.health.READ_WEIGHT
```

Strava **écrit** ses activités dans Health Connect et **lit** le poids. Il ne lit **pas** la fréquence cardiaque : on ne peut donc pas « injecter » la FC de la bague par Health Connect. Idem Google Fit (scopes `fitness.activity.read/write`, `fitness.heart_rate.*` côté API Google — c'est Strava qui écrit). **Conclusion : le profil HRS reste la seule voie.**

### 6.4 Sauvegarde [OBS]

`allowBackup=true`, mais la base `strava` et `com.strava.preference.excludeFromBackup.xml` sont exclues. `androidx.security:security-crypto` 1.1.0 présent (Tink), usage non établi.

---

## 7. Ce que cela change dans `REVUE-QRING-STRAVA.md`

| Constat de la revue | Statut après analyse | Précision |
|---|---|---|
| **P0-1** — `StravaClient.java:134` envoie `data` au lieu de `file` | **CONFIRMÉ** | [DOC] le paramètre s'appelle `file`. Vérifié dans le code : `writeFile(buf, boundary, "data", fileName, tcx)` |
| **P0-2** — FGS `connectedDevice` sans `location` | **CONFIRMÉ, reformulé** | ce n'est pas l'appel à deux arguments qui est illégal (le type est déclaré), c'est l'**accès GPS en arrière-plan** qui est refusé. Ajouter `location` + `FOREGROUND_SERVICE_LOCATION` |
| **P0-3** — `SessionRecorder.java:355` saute les points `bpm <= 0` | **CONFIRMÉ** | [DOC] « chaque trackpoint doit avoir un `<Time>` ». Un TCX sans trackpoint est rejeté ou vide. Toujours émettre le point, avec `Value` à la dernière FC connue ou sans `HeartRateBpm` |
| **P1** — `Sport="Other"` non mappé | **CONFIRMÉ** | [DOC] seuls biking/running/hiking/walking/swimming. Écrire `Biking` **et** envoyer `sport_type` |
| **P1** — séance simulée uploadée / « Déconnecter » déclenche l'envoi | **CONFIRMÉ** | aggravé par l'absence d'`external_id` unique : chaque envoi crée un doublon |
| **P1** — OAuth sans `state` | **CONFIRMÉ** | inchangé |
| **P2** — pas de persistance de séance | **CONFIRMÉ** | Strava, lui, a `UnsyncedActivity` + reprise sur `BOOT_COMPLETED` |
| **P2** — couleurs de bandeau inversées, statut CCCD ignoré, `WRITE_TYPE_NO_RESPONSE`, `POST_NOTIFICATIONS` 31/32, `stravaUploadPending` volatile, double `connectGatt` | **inchangés** | indépendants de Strava |

**Nouveaux points, issus de cette analyse**

| # | Constat | Correctif |
|---|---|---|
| N1 | `trainer` et `commute` sont des **entiers** (`0`/`1`) dans l'API, pas des booléens ; le pont n'envoie ni l'un ni l'autre | envoyer `trainer=0`, `commute=0` explicitement (sinon l'auto-détection « stationnaire » s'applique) |
| N2 | `external_id` = `qringhr-<fichier>` : le nom de fichier variant, les doublons passent | `external_id` = horodatage de début de séance (`qringhr-20261021T073000Z`) |
| N3 | l'`id` d'upload peut dépasser 32 bits | lire `id_str` (chaîne) et le stocker tel quel |
| N4 | `name` absent → Strava fabrique un titre | envoyer un nom lisible (`QRing — 21/10 07:30`) |
| N5 | `<Creator><Name>QRing HR Bridge</Name>` inconnu de Strava | assumé ; ne pas ajouter `with barometer` (le pont ne mesure pas l'altitude, Strava doit recalculer) |
| N6 | le pont vise `sport_type` absent | ajouter le champ, avec une préférence utilisateur (route/VTT/gravel/course) |
| N7 | mode d'usage non explicité dans l'app | afficher clairement « mode A (capteur pour un 2ᵉ téléphone) » vs « mode B (enregistrement + envoi) », et le fait que le mode B exige le GPS |

---

## 8. Comment obtenir l'analyse de 484.10

Trois voies, par ordre de rapport effort/résultat.

### Option A — découper le zip en volumes < 100 MiB (marche quel que soit le contenu)

Le fichier livré s'appelle `…_Decompiler.com.zip` : c'est la sortie du décompilateur en ligne, pas l'XAPK d'origine. Il contient selon toute vraisemblance l'arbre décompilé (`sources/`, `resources/`) et peut-être les APK extraits — c'est justement le matériau le plus utile. Le découper suffit donc :

```bash
zip -s 90m com.strava_484.10.xapk_Decompiler.com.zip --out strava-484.10-part
# → strava-484.10-part.z01 … .z04 + .zip
```

Chaque volume passe sous 100 MiB. Je les réassemble (`cat`), j'extrais ce qui m'intéresse, j'analyse, puis je supprime les volumes (limite d'environ 128 Mo du workspace par tour).

### Option B — déposer le seul `base.apk` (si vous avez l'XAPK d'origine)

L'XAPK est une archive : l'APK de base est l'entrée `com.strava.apk`. En 456.10 elle pèse **87 210 060 B**, sous le plafond.

```bash
unzip com.strava_484.10.xapk com.strava.apk
```

En 484.10 il faudra vérifier, mais le conteneur complet ne fait que 152 Mo : la base reste très probablement < 100 MiB. J'aurais alors le manifeste, les DEX et les ressources de **la bonne version**.

### Option C — valider l'analyse indirecte

Ce document couvre l'essentiel de ce qui conditionne le pont. Les incertitudes restantes (§3.3) se règlent mieux par un **test sur appareil** que par la lecture de 484.10 : appairer le pont et vérifier qu'il apparaît dans « Add a Sensor ».

**Recommandation** : A d'abord (une seule commande, et le contenu décompilé est plus exploitable que l'APK), B si vous préférez repartir du binaire, C si vous voulez avancer sans attendre.

---

## 9. Plan d'action

| Priorité | Action | Où |
|---|---|---|
| 0 | `"data"` → `"file"` dans le multipart | `StravaClient.java:134` |
| 0 | émettre un `<Trackpoint><Time>` pour **chaque** échantillon | `SessionRecorder.java:355` |
| 0 | ajouter `location` au FGS + `FOREGROUND_SERVICE_LOCATION`, appeler la surcharge typée | `AndroidManifest.xml:60`, `HrBridgeService.java:97` |
| 1 | `Sport="Biking"` + `sport_type` au POST | `SessionRecorder.java:344`, `StravaClient` |
| 1 | `external_id` stable par séance, lecture de `id_str` | `StravaClient.java:133` |
| 1 | `trainer`/`commute` entiers explicites, `name` lisible | `StravaClient` |
| 2 | deep link `strava://record/settings/sensors` | `MainActivity` |
| 2 | distinguer mode A / mode B dans l'UI et la doc | `MainActivity`, `README.md` |
| 2 | persistance de la séance + reprise | nouveau `SessionStore` |

---

## Annexe A — Sources

| Référence | Usage |
|---|---|
| `developers.strava.com/docs/uploads/` | contrat `POST /api/v3/uploads`, formats TCX/FIT/GPX, mapping `Sport`, `sport_type`, `trainer`/`commute` |
| `support.strava.com` — « Pairing Sensors with the Strava app » (maj 24/03/2026) | BLE HRM uniquement, pas de puissance/cadence, pas d'ANT+, « bridge devices » |
| `github.com/Kamalakanta01/openstride` — `docs/01`, `02`, `04`, `05`, `06`, `08`, `10`, `spec/` | binaire 456.10 : conteneur, dépendances (RxAndroidBle), permissions, composants, architecture, réseau |
| `developers.strava.com/docs/authentication/` | OAuth, scopes, `state` |
| Code du pont, commit `cc27db1`, branche `arena/20770d9e-tomtom` | `SessionRecorder`, `StravaClient`, `HrBridgeService`, `AndroidManifest.xml` |

## Annexe B — À surveiller si Strava passe à 485+

1. **Support d'autres capteurs** : la feuille de route officielle mentionne puissance/cadence « plus tard ». Le jour où c'est fait, le pont pourrait exposer `0x1816`/`0x1818` — mais seulement si Strava quitte le modèle « un seul capteur ».
2. **ANT+** : formellement écarté, mais une bascule changerait la donne.
3. **Endpoints privés** : `/api/mobile/uploads.json` peut disparaître sans préavis — sans impact, le pont utilise l'API publique.
4. **`sport_type`** : la liste s'allonge à chaque version (Cricket, Dance, Padel, PhysicalTherapy, Pickleball, Volleyball sont récents). Un `sport_type` inconnu est refusé → valider la valeur avant l'envoi.
5. **Health Connect** : si Strava se met à lire la FC, une voie alternative apparaît.

## Annexe C — Glossaire BLE

| Terme | Sens |
|---|---|
| **HRS** | *Heart Rate Service*, `0x180D` — le seul profil que Strava appaire |
| **`0x2A37`** | *Heart Rate Measurement* — la valeur de FC, en Notify |
| **`0x2A38`** | *Body Sensor Location* — où est porté le capteur (poitrine, poignet…) |
| **`0x180F` / `0x2A19`** | service / caractéristique de batterie |
| **`0x180A`** | *Device Information Service* (fabricant, modèle, firmware) |
| **central / périphérique** | le téléphone Strava est central ; le pont est périphérique (*peripheral*) |
| **advertisement** | la trame qu'un périphérique diffuse ; un central ne capte pas la sienne |
| **CCCD** | descripteur d'abonnement aux notifications — c'est lui que le central écrit pour « s'abonner » |
