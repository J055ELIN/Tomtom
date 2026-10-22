# Modifier Strava 456.10 pour qu'elle lise la bague QRing

**Question posée** : peut-on modifier l'application Strava 456.10 pour la rendre compatible avec la bague QRing ?
**Réponse franche** : **techniquement concevable, pas dans cet environnement, et le rapport bénéfice/risque est mauvais.** Ce document explique précisément pourquoi, ce qu'il faudrait fournir, et ce que ça coûterait.

---

## 1. Trois niveaux de « modification »

| Niveau | Ce que ça veut dire | Intérêt pour la bague | Réalisme |
|---|---|---|---|
| **N1 — cosmétique** | renommer, traduire, changer des libellés | **aucun** | facile, inutile |
| **N2 — ajouter une source de FC** | Strava se connecte **elle-même** à la bague (comme le fait l'app QRing) et utilise les battements dans son enregistrement | **c'est exactement ta demande** : un seul téléphone, une seule app | difficile, fragile |
| **N3 — fork complet** | recompiler l'app depuis des sources reconstruites | aucun supplémentaire | hors de portée |

Seul **N2** mérite qu'on en parle. Son avantage réel, et il est réel : **un seul téléphone**. Pas de second appareil, pas de pont à lancer. Strava devient central BLE face à la bague, exactement comme l'app QRing.

---

## 2. À quoi ressemblerait le patch N2

### 2.1 Ce qu'il faut ajouter

| Brique | Contenu | Existe déjà ? |
|---|---|---|
| Client BLE de la bague | handshake + trames 16 octets, canaux `0x69`/`0x6A`/`0x1E`, service Nordic UART | **oui** — `RingBleClient.java`, 434 lignes, dans le pont |
| Décodage FC | extraction du `bpm` des trames | **oui** — même fichier |
| Entrée dans l'écran « Add a Sensor » | une ligne « QRing » dans la liste des capteurs | **non** — à greffer dans du code obfusqué |
| Alimentation du moteur d'enregistrement | fournir des battements là où Strava attend les notifications `0x2A37` | **non** — c'est le point dur |

### 2.2 Pourquoi c'est dur

1. **Obfuscation** : 72 470 classes, dont **63 % renommées par R8** en paquets d'une ou deux lettres. Le point d'injection ne se trouve pas en lisant les noms — il faut partir des chaînes (`"Add a Sensor"`, `"sensor"`, UUID du service HR) et remonter le graphe d'appels, comme l'a fait l'analyse publique sur 456.10.
2. **Deux architectures à recoudre** : Strava raisonne en *périphérique GATT* (`RxBleDevice` → `RxBleConnection` → notifications) ; la bague parle un protocole propriétaire. Il faut donc créer un objet qui **se fait passer** pour un périphérique GATT aux yeux du reste de l'app, tout en parlant le protocole Colmi en dessous. En smali, cela signifie écrire des classes qui implémentent des interfaces existantes — faisable, mais c'est de la chirurgie.
3. **Smali, pas Java** : on ne recompile pas Strava. On désassemble, on écrit du smali à la main (ou on assemble un DEX séparé), on réassemble, on re-sign. Chaque erreur de registre = crash au démarrage.
4. **Splits** : 456.10 est un XAPK (base + `config.armeabi_v7a` + `config.mdpi` + `config.en`). Un APK patché doit soit fusionner les splits en un APK unique, soit re-signer **tous** les splits avec la même clé. Les deux sont faisables, aucun n'est trivial.
5. **Signature** : la version Play est signée par Strava. Toute version re-signée est **une autre application** aux yeux d'Android : désinstallation obligatoire, données locales perdues, plus aucune mise à jour, et Play Protect en alerte.

### 2.3 Estimation honnête

| Étape | Durée |
|---|---|
| Retro-ingénierie du point d'injection sur 456.10 | 3 à 6 jours |
| Portage du client bague en smali/DEX additionnel | 2 à 4 jours |
| Reconstruction, signature, installation, premier démarrage | 1 à 3 jours |
| Débogage sur appareil (crashs, cycles de connexion, reconnexion) | 3 à 7 jours |
| **Total pour un build utilisable** | **~10 à 20 jours-homme** |

Et à chaque nouvelle version de Strava, **tout est à refaire**.

---

## 3. La chaîne d'outils — et ce qui manque ici

| Outil | Rôle | Disponible dans cet environnement |
|---|---|---|
| APK 456.10 (base, 87 Mo) | la matière première | **NON** — je ne l'ai jamais eu ; le seul fichier fourni est un zip décompilé de **484.10**, refusé (> 100 MiB) |
| JRE | exécuter les outils Java | **oui** (`jdk4py`) |
| `apktool` | désassembler / réassembler | **non** — absent ; le paquet npm `apktool` n'est qu'un wrapper qui télécharge le jar depuis un hôte bloqué ; absent de PyPI |
| `baksmali` / `smali` | assembler le DEX | **non** (livrés avec apktool) |
| `zipalign` | aligner l'APK | **non** (SDK Android) |
| `apksigner` | signature v2/v3 **obligatoire** (minSdk 26) | **non** — `apk-signer` et `pyapksigner` sur PyPI ne sont que des enrobages autour du SDK Android |
| JDK (compilateur) | construire un DEX annexe | **non** (`jdk4py` = JRE seul, déjà vérifié) |
| `jadx` | lire du Java | **non**, mais non bloquant (le smali suffit) |

**Conclusion technique** : même si tu déposais l'APK maintenant, **cet environnement ne peut pas produire un APK signé**. Il faudrait une machine avec JDK 17 + Android SDK (Android Studio, ou un conteneur où ces paquets sont installables), et un appareil de test.

---

## 4. Ce qu'il faudrait fournir

1. **`com.strava.apk`** — le *base* de la **456.10**, non modifié, et si possible les trois splits (`config.armeabi_v7a`, `config.mdpi`, `config.en`) pour reconstruire un paquet installable.
2. **Un environnement outillé** : JDK 17 + `apktool` + Android SDK, ou l'autorisation de travailler hors de ce sandbox.
3. **Le modèle exact de la bague et son firmware** : le protocole diffère entre R02, R03, Titan Pro, Colmi R06/R10, Herz P1. Le pont code déjà plusieurs variantes — mais le patch doit savoir laquelle.
4. **Un téléphone de test** avec `adb`/`logcat`.
5. **Ton accord explicite** sur les conséquences : désinstallation de la version Play, perte des données locales, aucune mise à jour, Play Protect.

---

## 5. Ce à quoi t'attendre, sans enrobage

| Risque | Probabilité | Impact |
|---|---|---|
| Signature cassée → désinstallation + pas de mises à jour | **certaine** | moyen |
| Play Protect signale l'app | élevée | faible (contournable) |
| Splits mal re-signés → installation refusée | moyenne | bloquant, corrigeable |
| Point d'injection introuvable / trop fragile | **élevée** | bloquant |
| Crash au démarrage (smali invalide) | moyenne | corrigeable |
| Version bloquée côté serveur (Strava impose une mise à jour minimale) | moyenne | **rédhibitoire** |
| Nouvelle version de Strava → tout à refaire | certaine | élevé |

**Sur le plan juridique** : en France, la décompilation à des fins d'**interopérabilité** est permise (CPI art. L122-6-1 IV). En revanche, la **diffusion** d'un APK modifié ne l'est pas, et l'usage peut contrevenir aux CGU de Strava. Je peux t'accompagner sur une modification **strictement personnelle**, je ne produirai pas d'APK modifié destiné à circuler.

**Sur le plan pratique** : 456.10 date de mars 2026 ; la version courante est 486.9. Patcher une version vieille de six mois, c'est partir d'une base que Strava peut déclarer obsolète à tout moment.

---

## 6. Le point qui tranche

Le patch N2 et le pont font **exactement la même chose** au même endroit du système : fournir une fréquence cardiaque à Strava.

- Le pont le fait **par l'interface standard que Strava supporte déjà** (profil HRS `0x180D`), sans toucher à l'app. Il pèse 66 Ko, il marche sur toutes les versions, il ne casse jamais.
- Le patch le fait **par effraction**, dans du code obfusqué, pour un résultat qui disparaît à la première mise à jour.

Le seul gain réel du patch — **un seul téléphone** — est déjà atteignable autrement : le **mode B du pont** (bague + GPS + enregistrement + envoi) tourne sur un seul téléphone, sans Strava. Ce que le patch ajoute par rapport à ça, c'est uniquement l'interface de Strava.

Autrement dit : **20 jours de travail très risqué pour remplacer une interface.**

---

## 7. Recommandation

| Ton objectif réel | Le chemin le plus court |
|---|---|
| « Voir ma FC dans Strava pendant que je roule » | **mode A** — le pont + un 2ᵉ téléphone. 5 minutes de mise en place, après correction des 3 bugs P0 |
| « Une seule app, un seul téléphone » | **mode B** — le pont enregistre et envoie. Aucune modification de Strava. Déjà écrit, à corriger |
| « Comprendre ce que fait Strava » | `ANALYSE-STRAVA-app-officielle.md` (livré) |
| « Quand même un Strava modifié » | fournis les 5 éléments du §4 ; je te dirai en connaissance de cause ce qui est faisable. Sans l'APK et sans JDK, je ne peux pas inventer le binaire |

**Ce que je peux faire tout de suite, sans rien de tout ça** : appliquer les correctifs P0/P1 au pont pour qu'il se présente correctement à Strava (champ `file`, `<Time>` systématique, service de premier plan typé `location`, `sport_type`, `external_id`, fin de l'envoi automatique des séances simulées). C'est ce qui débloque réellement l'usage aujourd'hui.
