# SOP — QRing / Colmi → Strava (v4.1)

**Date :** 2026-10-21
**Projet :** application Android qui rend une bague QRing/Colmi utilisable comme
capteur de fréquence cardiaque dans Strava
**Emplacement :** `qring-strava-bridge/` — dépôt `J055ELIN/Tomtom`, branche
`arena/20770d9e-tomtom`
**APK courante :** `releases/QRingStravaBridge-v4.1.apk` — 66 087 octets,
`versionName 4.1` / `versionCode 14`, signatures v1 + v2, minSdk 23, targetSdk 34.

> Ce document remplace le SOP v3.0. Les sections techniques encore valables
> (protocole bague, chaîne de compilation hors ligne) ont été conservées et
> vérifiées ; tout le reste a été réécrit pour refléter l'état réel du 21/10.

---

## 1. Résumé exécutif

| Question | Réponse, au 2026-10-21 |
|---|---|
| La bague peut-elle fournir une FC au téléphone ? | **Oui**, vérifié (journaux : `FC 99 bpm`) |
| Strava peut-il voir le capteur émis par ce même téléphone ? | **Non** — un appareil ne reçoit jamais ses propres publicités BLE (vérifié aussi dans nRF Connect) |
| Et depuis un second téléphone ? | **Oui, vérifié** : `Abonnement FC activé par 55:DE:C5:05:82:47`, lectures `0x2A26`/`0x2A29`/`0x2A25` |
| Et avec un seul téléphone ? | La séance est **enregistrée puis publiée dans Strava** (FC + GPS) ; la FC n'est pas affichée en direct *dans Strava* |
| Modifier l'APK de Strava pour lire la bague ? | **Abandonné** : contrefaçon, risque de vol d'identifiants, à refaire à chaque mise à jour. Ne pas rouvrir ce chantier |

---

## 2. Ce qui est vérifié, ce qui ne l'est pas

Règle du projet : une ligne « vérifié » signifie qu'un **test reproductible existe
dans le dépôt** ou qu'un **journal l'a montré**. Tout le reste est une hypothèse et
est annoncé comme telle.

| Affirmation | État | Preuve |
|---|---|---|
| Protocole bague (trames 16 octets, checksum) | **vérifié** | identique octet pour octet à `qlam-ai/qring` (§5) |
| La bague diffuse sa FC | **vérifié** | journal : `→ démarrage du flux FC temps réel`, `FC 99 bpm` |
| Le service GATT `0x180D` + `0x2A37` est correct | **vérifié** | abonnement d'un central distant, lectures `0x2A26`/`0x2A29`/`0x2A25` |
| Un même téléphone ne voit pas sa propre publicité | **vérifié** | invisible dans Strava **et** dans nRF Connect sur le Pixel 9a |
| L'autotest « se voir soi-même » | **impossible** sur Android | ne jamais le réintroduire comme critère de réussite |
| Export TCX (FC + GPS) accepté par Strava | **vérifié** au niveau des règles Strava | fichier produit, `Position` + `HeartRateBpm` |
| Client d'envoi Strava (OAuth, multipart, polling) | **vérifié hors téléphone** | `tests/stravaclient` : faux serveur, `LIAISON ok=true`, `ENVOI ok=true` |
| Retour du navigateur `qringhr://qringhr` | **non vérifié** | dépend du téléphone ; échec visible à l'écran |
| Le vrai serveur Strava accepte le fichier | **non vérifié** | quotas et refus métier possibles |

---

## 3. Architecture

```
┌────────────────┐   BLE (central)      ┌──────────────────────────────┐
│ bague QRing /  │  UART Nordique       │  HrBridgeService (FGS)       │
│ Colmi R02/R06  │  6E40FFF0 / 6E400002 │  ├── RingBleClient  (client) │
│                │ ───────────────────► │  ├── HrmPeripheral  (serveur)│
└────────────────┘  0x69 / 0x6A / 0x1E  │  └── SessionRecorder (TCX)   │
                                       └──────────────────────────────┘
                                        │ 0x180D/0x2A37      │ API Strava
                                        ▼ (autre téléphone)   ▼ (même téléphone)
                                     Strava / Wahoo /      strava.com
                                     Garmin                (activité)
```

Deux voies coexistent, elles ne s'excluent pas :

1. **Pont BLE** — le téléphone se présente comme une ceinture `0x180D`. Utilisable
   par **un autre appareil** (second téléphone, montre, compteur). C'est la seule
   façon d'avoir la FC **en direct dans Strava**.
2. **Séance + API** — `SessionRecorder` enregistre FC (1 pt/s) + GPS, puis
   `StravaClient` publie l'activité via l'API officielle. Fonctionne **sur un seul
   téléphone**, mais la FC n'apparaît qu'après la séance.

### Fichiers

| Fichier | Rôle |
|---|---|
| `RingBleClient.java` | connexion bague, trames 16 octets, checksum, keep-alive 20 s, reconnexion |
| `HrmPeripheral.java` | GATT server, services séquentiels, 5 stratégies de publicité, rafraîchissement 60 s |
| `HrBridgeService.java` | service de premier plan, notification, simulation, wake lock |
| `SessionRecorder.java` | échantillonnage FC + GPS, écriture TCX (`Téléchargements/QRingHR`) |
| `StravaClient.java` | OAuth, rafraîchissement du jeton, envoi multipart, suivi du traitement |
| `SelfTest.java` | autotest GATT + recensement hexadécimal des publicités voisines |
| `MainActivity.java` | scan, sélection, FC, bandeau de séance, boutons d'export/envoi |
| `BridgeState.java`, `Logs.java` | état partagé et journal (UI + logcat `QRingBridge`) |

---

## 4. Modes d'utilisation

### 4.1 Un seul téléphone (cas de l'utilisateur)

1. **Connecter la bague** → la FC s'affiche en gros caractères dans l'appli.
2. **Démarrer le pont** → le bandeau affiche `Séance 0:42:17 · 12.84 km · FC moy 131 / max 152`.
3. **Arrêter le pont** → si le compte Strava est lié et la séance > 1 min, l'activité
   part automatiquement. Sinon, bouton **Envoyer la séance à Strava**.
4. Repli sans réseau : **Exporter la séance (TCX)** puis Strava → Enregistrer → (+)
   → Importer un fichier.

### 4.2 Deux téléphones (seule voie pour la FC en direct dans Strava)

| Téléphone | Rôle |
|---|---|
| A (poche) | appli QRing : bague connectée + pont démarré, notification visible |
| B (guidon) | Strava : capteur « QRing HR » + GPS |

Contraintes : A à moins de 10 m, optimisation de batterie désactivée pour l'appli,
ne pas lancer l'appli QRing sur B, un seul pont à la fois.

### 4.3 Liaison Strava (une seule fois)

1. Bouton **Envoyer la séance à Strava** → **Ouvrir strava.com** → *My API Application* :
   nom `QRing`, catégorie `Other`, site `https://strava.com`.
2. Champ **Authorization Callback Domain** : `qringhr` (exactement).
3. Coller **Client ID** + **Client Secret**, puis **Autoriser** → retour automatique
   dans l'appli par `qringhr://qringhr?code=…`.

Ces deux valeurs restent dans les préférences privées de l'appli : **aucun
identifiant n'est dans le code ni dans le dépôt**.

---

## 5. Protocole de la bague (vérifié)

Source de vérité : `qlam-ai/qring` (`packet.py`, `real_time.py`, `battery.py`,
`set_time.py`), recoupé avec Gadgetbridge PR #3896.

* Service UART : `6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E`
  * écriture (vers la bague) : `6E400002-…`
  * notifications : `6E400003-…`
* Trame = **16 octets** : `[commande, données…, 0x00…, checksum]`,
  `checksum = somme(octets 0..14) & 0xFF`.

| Commande | Payload | Effet |
|---|---|---|
| `0x69` | `01 01` | démarrer le flux FC temps réel (type 1 = FC, action 1 = START) |
| `0x6A` | `01 00 00` | arrêter le flux |
| `0x1E` | `33` | keep-alive « continue » (toutes les 20 s) |
| `0x03` | — | niveau de batterie → `[03, niveau%, enCharge]` |
| `0x01` | 7 octets BCD | règle l'horloge de la bague (UTC) |
| `0x15` | timestamp 4 octets LE | historique FC 288 points / 5 min (non utilisé) |

Réponse temps réel : `[0x69, type=0x01, codeErreur, bpm]`.

Trames comparées octet pour octet avec le prototype Python — **identiques** :

```
start_hr = 6901010000000000000000000000006B
stop_hr  = 6A01000000000000000000000000006B
continue = 1E330000000000000000000000000051
battery  = 03000000000000000000000000000003
set_time = 012510201435000100000000000000A0
```

Trames réelles de ceintures voisines, relevées par nRF Connect (utiles pour la
publicité) :

```
Joss-FUSE : 0A 09 4A 6F 73 73 2D 46 55 53 45 02 01 06 03 03 0D 18 07 FF 89 01 23 12 01 80
NEW-FUSE  : 09 09 4E 45 57 2D 46 55 53 45 02 01 06 03 03 0D 18 07 FF 89 01 36 AB 00 80
```

---

## 6. Chaîne de compilation (sandbox sans SDK)

Le sandbox n'a ni JDK, ni Android SDK, ni Gradle, et les accès réseau sont limités
à GitHub / PyPI / npm. La chaîne est reconstituée entièrement hors ligne ; le script
`/tmp/setup-tools.sh` la remet en place (à recréer si `/tmp` a été réinitialisé).

| Besoin | Outil | Provenance |
|---|---|---|
| JVM | Temurin JRE 25 (`jdk4py`) | PyPI `jdk4py` |
| `android.jar` API 34 | `Sable/android-platforms` | API blobs GitHub |
| Compilateur | ECJ 4.10 | `facebook/buck` |
| `aapt2` | 2.19 (Linux) | PyPI `aapt2` |
| `zipalign`, `apksigner` | build-tools 28 | PyPI `adapktools` |
| Dexer | dx 1.10 | `hekai/android-sdk-linux` |

> `dx` ne gère pas `invokedynamic` : **tout le code est en Java 7 strict**
> (classes anonymes, pas de lambdas).

```bash
cd qring-strava-bridge
env -i PATH=/usr/bin:/bin HOME=/tmp \
    JAVA_HOME=/tmp/jdk/ex/jdk4py/java-runtime \
    ANDROID_PLATFORM=/tmp/sdk/android-34.jar \
    AAPT2=/tmp/pipx/aa/aapt2/bin/Linux/aapt2 \
    ZIPALIGN=/tmp/adapt/adApkTools-1.0.6/adapktools/lib/linux/zipalign \
    APKSIGNER_JAR=/tmp/adapt/adApkTools-1.0.6/adapktools/lib/linux/apksigner.jar \
    ECJ_JAR=/tmp/ecj/ecj.jar DX_JAR=/tmp/dx.jar \
    bash build.sh
```

Avec un vrai SDK : `ANDROID_HOME`, `ANDROID_BUILD_TOOLS=34.0.0`, `JAVA_HOME` en
JDK 21+, puis `bash build.sh`.

---

## 7. Validation

| Étape | Résultat |
|---|---|
| Compilation ECJ contre `android.jar` 34 | 0 erreur |
| `aapt2 link` | OK, `foregroundServiceType` présent |
| `dx` + réassemblage dans l'APK | DEX valide |
| `zipalign` + `apksigner` | v1 ✔ v2 ✔ |
| `tests/stravaclient/run.sh` | `LIAISON ok=true`, `ENVOI ok=true`, `activité n°987654` |
| Test matériel Pixel 9a | fait : bague OK, pont OK, second téléphone OK ; même téléphone impossible |

Rejouer le test du client Strava :

```bash
cd qring-strava-bridge/tests/stravaclient
ECJ_JAR=/tmp/ecj/ecj.jar JAVA=/tmp/jdk/ex/jdk4py/java-runtime/bin/java bash run.sh
```

---

## 8. Sécurité et limites légales

* `debug.keystore` (mot de passe `android`, alias `androiddebugkey`) est **versionné**
  pour que toutes les APK ≥ 3.4 s'installent par-dessus. Ce n'est pas une clé de
  production : si l'appli devait être publiée, générer une vraie keystore.
* Aucun jeton GitHub, aucune clé, aucun identifiant Strava dans le dépôt.
* L'application demande `INTERNET` uniquement pour l'API Strava ; l'identifiant et
  le secret saisis par l'utilisateur restent dans `SharedPreferences` privées.
* **Ne pas modifier ni redistribuer l'APK de Strava** : contrefaçon, conditions
  d'utilisation, et risque direct d'exfiltration des identifiants de connexion.
  La démonstration de patch binaire de nos propres APK (`releases/DEMO-patch-v4.0.apk`)
  illustre la technique sans toucher à un logiciel tiers.

---

## 9. Reprise / prochaines étapes

| Priorité | Action |
|---|---|
| 1 | Utilisateur : installer la v4.1, faire la liaison Strava, vérifier le retour `qringhr://` (seule inconnue restante) |
| 2 | Vérifier sur une vraie sortie que le fichier envoyé est accepté par strava.com |
| 3 | Si le retour navigateur échoue : ajouter une saisie manuelle du `code` en secours |
| 4 | Optionnel : écran d'effort plus riche (allure, dénivelé) |
| 5 | Optionnel : `0x2A37` au format 16 bits si une app le réclame (flag `0x01`) |
| 6 | Workflow CI : copier `ci/qring-strava-bridge-build.yml` dans `.github/workflows/` depuis un compte disposant de la permission `workflows` |

---

## 10. Historique

| Version | Apport |
|---|---|
| 3.0 → 3.2 | GATT server, services séquentiels (corrige `addService()` en rafale), `0x180D`/`0x2A37` |
| 3.3 → 3.4 | autotest, 4 variantes de publicité, correctif de connexion au mauvais appareil |
| 3.5 → 3.7 | autotest honnête, renommage réversible, publicité calquée sur les ceintures FUSE |
| 3.8 | enregistrement de séance (FC + GPS) et export TCX |
| 3.9 | envoi direct à Strava (OAuth, multipart, suivi) |
| 4.0 | bandeau de séance en direct + envoi automatique en fin de séance |
| 4.1 | client Strava testable et testé hors téléphone, tableau vérifié/non vérifié |
