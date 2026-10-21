# SOP — Reprise du chantier « bague QRing ↔ Strava »

**Version 1.0 — 21 octobre 2026**
**Objet** : permettre à quiconque (toi dans trois semaines, ou un tiers) de reprendre le travail sans relire tout l'historique.
**Temps de reprise** : 10 minutes de lecture, 2 minutes pour savoir quoi faire ensuite.

---

## 0. Carte d'identité du chantier

| Élément | Valeur |
|---|---|
| Dépôt | `github.com/J055ELIN/Tomtom` |
| Branche de travail (session en cours) | `arena/5a914645-tomtom` |
| Branche du pont (le code) | `arena/20770d9e-tomtom` @ **`cc27db1`** |
| Application étudiée | Strava Android `com.strava` — **484.10** (déposée), analyse réelle sur **456.10** |
| Application du pont | `com.qring.strava.bridge` **4.1 / 14**, APK de **66 087 octets** |
| Matériel | bague QRing (R02/R03/Titan Pro/Colmi R06/R10/Herz P1) + 2 téléphones Android |
| Livrables | `REVUE-QRING-STRAVA.md`, `ANALYSE-STRAVA-app-officielle.md`, `STRAVA-MODIFIEE-faisabilite.md`, ce document |

**Règle de branche, à ne pas enfreindre** : la session est liée à `arena/5a914645-tomtom`. On n'y crée pas de code du pont. Le pont vit sur `arena/20770d9e-tomtom` ; pour le lire sans changer de branche :

```bash
cd ~/Tomtom
git fetch origin arena/20770d9e-tomtom
git archive FETCH_HEAD qring-strava-bridge | tar -x -C ~/qring-travail
```

---

## 1. En 3 minutes

### 1.1 Où on en est

| Bloc | État | Fichier |
|---|---|---|
| Revue statique du pont | ✅ **livrée**, 363 lignes, 3 P0 + 6 P1 + 9 P2 localisés | `REVUE-QRING-STRAVA.md` |
| Analyse de Strava (capteurs, upload, vie privée) | ✅ **livrée**, 3 sources, notation DOC/OBS/INF | `ANALYSE-STRAVA-app-officielle.md` |
| Faisabilité d'un Strava modifié | ✅ **livrée**, verdict défavorable chiffré | `STRAVA-MODIFIEE-faisabilite.md` |
| Application des correctifs au pont | ❌ **non faite** — aucun go-ahead reçu | — |
| Test sur appareil | ❌ **jamais fait** | — |
| Analyse de la version 484.10 | ⛔ **bloquée** (fichier 152 Mo > plafond 100 MiB) | — |

### 1.2 La prochaine action, par ordre de valeur

1. **Corriger les 3 P0 du pont et le tester** → procédure C et D. C'est ce qui produit un résultat visible (la bague apparaît dans Strava).
2. **Obtenir l'analyse de la 484.10** (facultatif) → procédure E.
3. **Un Strava modifié** (déconseillé) → procédure F, seulement après lecture du document de faisabilité.

### 1.3 Le montage, en un schéma

```
   bague QRing                     tél. 2 (pont)                    tél. 1 (Strava)
  ┌──────────┐   Nordic UART   ┌──────────────────┐   HRS 0x180D  ┌──────────────┐
  │ 0x69/6A  │ ──────────────► │ QRingStravaBridge│ ────────────► │ Strava       │
  │ 16 octets│                 │ + advertising    │  notifications│ GPS + FC live│
  └──────────┘                 └──────────────────┘               └──────────────┘
                                        │
                                        └─ (mode B) enregistre GPS + FC → TCX → API v3
```

---

## 2. Décisions actées

| # | Décision | Raison | Réversible ? |
|---|---|---|---|
| D1 | **Ne pas modifier Strava.** Passer par le profil standard HRS `0x180D` | Strava n'accepte que les cardiofréquencemètres BLE ; l'app est centrale seule (pas de `BLUETOOTH_ADVERTISE`) ; un patch casse à chaque version | oui, mais coûteux |
| D2 | **Deux téléphones** pour la FC live (mode A) | un téléphone ne capte pas ses propres *advertisements* | non (limite matérielle) |
| D3 | **Mode B** (pont enregistreur) comme filet de sécurité | fonctionne sur un seul téléphone, sans Strava | — |
| D4 | Ne pas retenter le téléchargement du zip 484.10 tel quel | 152 556 102 B > 100 MiB, 3 échecs documentés | — |

**Question ouverte** : appliquer les P0 seuls, ou P0 + P1 d'un coup ? Recommandation : **P0 d'abord**, test réel, puis P1.

---

## 3. Procédure A — remettre le contexte en tête (20 min)

1. Lire `ANALYSE-STRAVA-app-officielle.md` §0 (résumé) et §7 (ce que ça change).
2. Lire `REVUE-QRING-STRAVA.md` §« Défauts » (les P0/P1 avec fichier et ligne).
3. Ouvrir `STRAVA-MODIFIEE-faisabilite.md` §6 si l'envie de patcher Strava revient.
4. Récupérer le code (commande du §0) et vérifier qu'il correspond :

```bash
git -C ~/qring-travail log --oneline -1        # doit afficher cc27db1
```

---

## 4. Procédure B — corriger le pont

> Tout se fait dans `~/qring-travail/qring-strava-bridge/`.
> Chemins relatifs à `app/src/main/java/com/qring/strava/bridge/`.

### B.1 — P0 n°1 : le champ multipart (bloquant, 1 ligne)

**Fichier** : `StravaClient.java`, ligne **134**.

```java
// AVANT
writeFile(buf, boundary, "data", fileName, tcx);
// APRÈS
writeFile(buf, boundary, "file", fileName, tcx);
```

**Vérification** : `grep -n '"file"' StravaClient.java` → une occurrence.

**Test unitaire à renforcer en même temps** — `tests/stravaclient/mock.py`, lignes 26-28 : le faux serveur accepte n'importe quel nom de champ. Ajouter le refus explicite :

```python
if b'name="file"' not in raw_body:
    self.send_response(400); self.end_headers()
    self.wfile.write(b'{"message":"missing file"}'); return
```

Sans ça, le test passera au vert même avec le bug.

### B.2 — P0 n°2 : le service de premier plan (GPS)

**Fichier 1** : `app/src/main/AndroidManifest.xml`

```xml
<!-- après FOREGROUND_SERVICE_CONNECTED_DEVICE -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

<!-- ligne 60 -->
android:foregroundServiceType="connectedDevice|location"
```

**Fichier 2** : `HrBridgeService.java`, ligne **97**

```java
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    startForeground(NOTIF_ID, buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
          | ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
} else {
    startForeground(NOTIF_ID, buildNotification());
}
```

Imports : `android.content.pm.ServiceInfo`, `android.os.Build`.

**Ne pas** retirer `connectedDevice` : le pont est périphérique BLE, il en a besoin.

### B.3 — P0 n°3 : le trackpoint systématique

**Fichier** : `SessionRecorder.java`, ligne **355**.

```java
// AVANT
for (Sample s : copy) {
    if (s.bpm <= 0) {
        continue;
    }
    sb.append("          <Trackpoint>\n");
    sb.append("            <Time>")...
```

```java
// APRÈS : on émet toujours le point, la FC seulement si elle existe
int lastBpm = 0;
for (Sample s : copy) {
    if (s.bpm > 0) lastBpm = s.bpm;
    sb.append("          <Trackpoint>\n");
    sb.append("            <Time>").append(fmt.format(new Date(s.time))).append("</Time>\n");
    // ... Position inchangé ...
    if (lastBpm > 0) {
        sb.append("            <HeartRateBpm>\n");
        sb.append("              <Value>").append(lastBpm).append("</Value>\n");
        sb.append("            </HeartRateBpm>\n");
    }
    sb.append("          </Trackpoint>\n");
}
```

**Justification** : la doc officielle exige un `<Time>` sur **chaque** trackpoint. Le code actuel peut produire un `<Track>` vide → fichier refusé ou activité vide.

**Effet de bord à surveiller** : les échantillons pris avant la première mesure de FC porteront la FC du point suivant (`lastBpm` initialisé à 0 → pas de `HeartRateBpm`, ce qui est correct).

### B.4 — P1 (après validation des P0)

| # | Fichier:ligne | Changement |
|---|---|---|
| P1-1 | `SessionRecorder.java:344` | `<Activity Sport="Other">` → `"Biking"` (ou `Running` selon le réglage utilisateur) |
| P1-2 | `StravaClient.java:132` | ajouter `writeField(buf, boundary, "sport_type", "Ride");` avant `data_type` |
| P1-3 | `StravaClient.java:133` | `external_id` = `"qringhr-" + dateDebutSeance` (stable), pas le nom de fichier |
| P1-4 | `StravaClient.java` | ajouter `name`, `trainer` = `"0"`, `commute` = `"0"` |
| P1-5 | `HrBridgeService.java:108`, `MainActivity.java:484/769` | ne plus envoyer automatiquement une séance simulée |
| P1-6 | `MainActivity.java:929-952` | le renommage ne doit plus couper la séance ni effacer `PREF_ADDR` |
| P1-7 | `StravaClient.java:80-87` | ajouter un `state` OAuth aléatoire et le vérifier au retour |

### B.5 — Versionnage

Dans **`build.sh`** (lignes `VERSION_NAME` / `VERSION_CODE`) **et** `app/build.gradle` :

```
VERSION_NAME="4.2"   VERSION_CODE="15"
```

---

## 5. Procédure C — reconstruire l'APK

### C.1 Prérequis

| Outil | Rôle | Note |
|---|---|---|
| JDK 17+ | `javac`, `keytool` | obligatoire |
| Android SDK build-tools 34 | `aapt2`, `d8`, `zipalign`, `apksigner` | le plus simple |
| Android platform 34 | `android.jar` | |

### C.2 Build standard

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_BUILD_TOOLS=$ANDROID_HOME/build-tools/34.0.0
export ANDROID_PLATFORM=$ANDROID_HOME/platforms/android-34/android.jar
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

cd ~/qring-travail/qring-strava-bridge
bash build.sh
```

Sortie attendue : `releases/QRingStravaBridge-v4.2.apk` (~66 Ko), signée debug (v1 + v2).

### C.3 Build sans SDK complet

`build.sh` accepte des substituts (voir l'en-tête du script) :

```bash
export ECJ_JAR=/chemin/ecj.jar      # remplace javac
export DX_JAR=/chemin/dx.jar        # remplace d8
export AAPT2=/chemin/aapt2
export ZIPALIGN=/chemin/zipalign
export APKSIGNER=/chemin/apksigner
```

> ⚠️ **Cet environnement de sandbox ne peut pas builder** : pas de JDK (seulement un JRE), pas d'`apktool`, pas d'`apksigner`, et les téléchargements GitHub Releases sont coupés. Le build doit se faire sur une machine avec Android Studio ou équivalent.

### C.4 Vérifier l'APK produit

```bash
unzip -p releases/QRingStravaBridge-v4.2.apk AndroidManifest.xml >/dev/null && echo "manifeste lisible"
ls -l releases/QRingStravaBridge-v4.2.apk     # attendu ~66 000 octets
```

### C.5 Installer

```bash
adb install -r releases/QRingStravaBridge-v4.2.apk
adb shell dumpsys package com.qring.strava.bridge | grep versionName   # → 4.2
```

---

## 6. Procédure D — tester en réel

### D.1 Mode A — le pont comme ceinture (recommandé)

| Étape | Action | Résultat attendu |
|---|---|---|
| 1 | Tél. 2 : **désactiver** l'app QRing (ou déconnecter la bague) | la bague n'est plus connectée ailleurs |
| 2 | Tél. 2 : lancer le pont, sélectionner la bague, attendre « connecté » | la FC s'affiche dans le pont |
| 3 | Tél. 2 : démarrer le pont (advertising actif) | notification persistante |
| 4 | Tél. 1 : Strava → **Record** → glisser vers le haut → **Add a Sensor** | « QRing… » apparaît dans la liste |
| 5 | Tél. 1 : sélectionner le pont | la FC s'affiche **en direct** dans Strava |
| 6 | Tél. 1 : démarrer l'activité, écran éteint 5 min | la FC continue ; le GPS continue |

**Si l'étape 4 échoue** : voir le tableau §9. C'est le point de bascule de tout le projet — tout le reste en dépend.

### D.2 Mode B — le pont enregistreur (mono-téléphone)

| Étape | Action | Résultat attendu |
|---|---|---|
| 1 | Tél. 2 seul : pont + bague, démarrer une séance | compteur de points qui monte |
| 2 | Marcher 3 min, écran éteint | la distance augmente (**test du P0 n°2**) |
| 3 | Arrêter, exporter / envoyer vers Strava | `201` puis `status: success` |
| 4 | Vérifier sur strava.com | activité avec **courbe de FC** et **trace GPS** |

**Échecs typiques** :
- `400` → le champ multipart (§B.1) ;
- `success` mais activité vide → `<Time>` manquant (§B.3) ;
- activité « home trainer » → GPS coupé (§B.2) ;
- type d'activité « Autre » → `Sport` non mappé (§B.4).

### D.3 Test de non-régression du client, hors téléphone

```bash
cd tests/stravaclient
export ECJ_JAR=/chemin/ecj.jar
bash run.sh
```

Couvre : OAuth, envoi multipart, polling, cas d'erreur.

---

## 7. Procédure E — obtenir l'analyse de la 484.10 (facultatif)

### E.1 Pourquoi

Les conclusions actuelles portent sur la **456.10**. L'écart avec la 484.10 est de 28 versions (~6 mois). Les incertitudes restantes sont listées au §3.3 de `ANALYSE-STRAVA-app-officielle.md`.

### E.2 Découper le fichier

```bash
split -b 90m com.strava_484.10.xapk_Decompiler.com.zip strava48410.part-
ls -lh strava48410.part-*
```

Chaque partie passe sous le plafond de 100 MiB. Déposer **toutes** les parties sur Drive.

### E.3 Réassembler (côté analyse)

```bash
cat strava48410.part-* > full.zip
unzip -l full.zip | head -40          # identifier la structure
```

Puis, selon le contenu :
- arbre décompilé (`sources/`, `resources/`) → lecture directe ;
- APK présent → `unzip full.zip com.strava.apk`, puis manifeste/DEX.

### E.4 Contrainte de place

Le workspace est limité à ~128 Mo par tour. Travailler dans `/tmp`, ne garder que l'extrait utile, supprimer les parties avant la fin du tour.

### E.5 Ne pas réessayer

`download_file` sur `1X6pVpDwOQF7XEFRHQQdhXHRTHU8h-5MN` ou `17NrxRQA5KgZE38JrnR8OtWdjLat9KgW2` : échec garanti (taille).

---

## 8. Procédure F — option « Strava modifiée » (go / no-go)

**Ne lancer cette procédure que si les procédures C et D ont échoué**, ou si le besoin d'un seul téléphone devient impératif.

### F.1 Porte de décision

| Question | Si « non » |
|---|---|
| Disposes-tu du `base.apk` **456.10** (87 Mo) + les 3 splits ? | **stop** — sans binaire, rien n'est possible |
| Disposes-tu d'une machine avec JDK 17 + Android SDK ? | **stop** — cette sandbox ne peut pas produire d'APK signé |
| Acceptes-tu : désinstallation Play, perte des données locales, plus de mises à jour, Play Protect ? | **stop** |
| Acceptes-tu 10 à 20 jours-homme, à refaire à chaque version ? | **stop** |
| Le gain (un seul téléphone) vaut-il ça, sachant que le mode B le donne déjà ? | **stop** |

Cinq « oui » = feu vert. Un seul « non » = revenir au pont.

### F.2 Si feu vert

Suivre `STRAVA-MODIFIEE-faisabilite.md` §2 (points d'injection) et §4 (éléments à fournir). Prévoir une sauvegarde du téléphone avant toute installation.

---

## 9. Pièges connus et dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| La bague n'apparaît pas dans le pont | déjà connectée à l'app QRing | couper QRing, désactiver son service |
| Le pont n'apparaît pas dans Strava | advertising inactif, ou nom vide | vérifier le statut dans le pont ; redémarrer l'advertising |
| Strava voit le pont mais la connexion échoue | CCCD refusé, MTU | lire les logs du pont ; `RingBleClient.java:325` ignore le statut CCCD (P2 connu) |
| FC figée dans Strava | notifications arrêtées après déconnexion | `START_STICKY` + reconnexion à implémenter (P2) |
| Upload `400` | champ `data` | §B.1 |
| Upload `success` mais activité vide | points `bpm <= 0` sautés | §B.3 |
| Activité sans GPS / « home trainer » | FGS sans type `location` | §B.2 |
| Type « Autre » | `Sport="Other"` | §B.4 |
| Doublons à chaque envoi | `external_id` instable | §B.4 P1-3 |
| Le test passe alors que le bug est là | `mock.py` ne valide pas le nom du champ | §B.1, dernier paragraphe |

---

## 10. Critères de réussite

Le chantier est « terminé » quand :

- [ ] la bague apparaît sous le nom prévu dans **Add a Sensor** de Strava ;
- [ ] la FC se met à jour **en moins de 3 s** dans Strava, écran allumé ;
- [ ] elle continue **écran éteint** au moins 10 minutes ;
- [ ] une séance enregistrée par le pont produit un `201`, puis `status: success`, puis une activité **avec courbe de FC et trace GPS** ;
- [ ] le type d'activité affiché est correct (vélo / course / marche) ;
- [ ] un second envoi de la même séance ne crée **pas** de doublon ;
- [ ] `tests/stravaclient/run.sh` passe, **y compris** avec le contrôle du nom de champ.

---

## 11. Journal des décisions

| Date | Décision | Contexte |
|---|---|---|
| 2026-10-21 | Revue du pont livrée (3 P0, 6 P1, 9 P2) | branche `arena/20770d9e-tomtom` |
| 2026-10-21 | Analyse Strava par sources indirectes | zip 484.10 inaccessible (152 Mo > 100 MiB) |
| 2026-10-21 | Rejet du patch de Strava | coût 10-20 j, signature cassée, aucune tenue dans le temps |
| 2026-10-21 | Mode A recommandé, mode B en secours | la FC live exige deux appareils |

---

## 12. Annexe — commandes utiles

```bash
# Récupérer le pont sans changer de branche
git fetch origin arena/20770d9e-tomtom
git archive FETCH_HEAD qring-strava-bridge | tar -x -C ~/qring-travail

# Vérifier la version du pont
grep -n "VERSION_NAME\|VERSION_CODE" ~/qring-travail/qring-strava-bridge/build.sh

# Chercher une régression
grep -rn "writeFile(buf" ~/qring-travail/qring-strava-bridge/app/src/main/java/
grep -rn "bpm <= 0"    ~/qring-travail/qring-strava-bridge/app/src/main/java/
grep -n  "foregroundServiceType" ~/qring-travail/qring-strava-bridge/app/src/main/AndroidManifest.xml

# Journal du pont
adb logcat -s QRingBridge:V AndroidRuntime:E
```

**Identifiants de référence**

| Objet | Valeur |
|---|---|
| Zip Strava 484.10 (Drive) | `1X6pVpDwOQF7XEFRHQQdhXHRTHU8h-5MN` — 152 556 102 B — MD5 `444c7cb13e1e09949c85a083dbb8f361` |
| Variante 477.14 (Drive) | `17NrxRQA5KgZE38JrnR8OtWdjLat9KgW2` — 153 793 181 B |
| Dossier Drive « Arena » | `1UZzeHD7ZNOVmWM91WmFUCcJD4HfvFocw` |
| Commit du pont | `cc27db1` |
| Adresse du pont de test | `55:DE:C5:05:82:47` |
