# Correctif SFTP Debian 13 pour VLC Android — branche de build

Le bug n'est pas dans la couche Java : VLC Android lie **libssh2 en statique**, avec le backend
crypto **libgcrypt**, qui ne connait que les KEX `diffie-hellman-group*` et les clés d'hôte
`ssh-rsa`/`ssh-dss`. Un `sshd` Debian 13 (Ultra.cc depuis la migration 2026) n'offre plus rien de
tout ça → échec **pendant la poignée de main**, avant l'authentification.

Preuve sur le binaire distribué (`ANALYSE-APK-3.7.0.txt`, `tools/inspect-apk.sh`) : dans le
`libvlc.so` de VLC-Android 3.7.0 (43 Mo, aucun `.so` séparé pour sftp), on compte `gcry_` 300,
`mbedtls_` **0**, et les noms `ecdh-sha2-nistp256` / `curve25519-sha256` / `rsa-sha2-512` : **0**.

Le correctif (`patches/0001-…`) construit libssh2 contre **Mbed TLS** pour Android uniquement :
nouveau paquet `contrib/src/mbedtls` (+ son `SHA512SUMS`, sinon la règle générique `.sum-%` des
contribs arrête le build) et `CRYPTO_BACKEND:STRING=mbedTLS` dans `contrib/src/ssh2/rules.mak`.
Desktop/iOS/Windows inchangés. Licences : Mbed TLS Apache-2.0/GPL-2.0+ avec LGPLv2.1 (libVLC) et
GPLv2 (app).

## Base choisie et correctifs jumeaux

Le workflow part de **`vlc-android@3.7.1`** (dernière version publiée : `3.7.2`/`3.8.0` répondent
404, et il n'existe pas de branche `3.7.x`). Ce tag ne contient pas le core VLC : son
`buildsystem/compile.sh` clonne `libvlcjni` en `libvlcjni-3.x`, qui amène **`videolan/vlc` 3.0.x**.
Le bug y est identique (`-DCRYPTO_BACKEND:STRING=Libgcrypt`, libssh2 1.11.1) mais le fichier a une
autre forme, et le patch écrit pour `master` refuse de s'y appliquer.

Il y a donc **deux patchs jumeaux**, et le workflow choisit tout seul : il essaie
`0001` (vlc `master`, VLC 4.x) puis `0002` (vlc **3.0.x**, la base de la 3.7.1), applique le premier
qui s'applique, et **échoue explicitement si aucun ne convient** ou si les deux conviennent.
Contrôle ici : `vlc-sftp/tools/test-choix-patch.sh` (3 cas, tous conformes).

| arbre du core | 0001 | 0002 |
|---|---|---|
| `vlc@3.0.x` | refuse | **appliqué** |
| `vlc@master` | **appliqué** | refuse |

Mesuré : handshake `ecdh-sha2-nistp256` + `rsa-sha2-512`, authentification et **listing SFTP OK**
— y compris en binaires `arm64-v8a` exécutés sous qemu (Voir `RESULTATS-CROSS-ANDROID.txt` du kit).

## Lancer le build

`.github/workflows/vlc-android-sftp.yml`, bouton **Run workflow** (branche `vlc-sftp-build`).
Option `probe_server` : mets `<ton-hote>.usbx.me` pour auditer d'abord les algorithmes du serveur
sans jamais tenter d'authentification.

**Ne pas ajouter `-t`** au `compile.sh` interne : les contribs précompilées de VideoLAN court-
circuitent le patch (le SHA des contribs vient de l'historique git, donc un patch non commité ne le
change pas). C'est exactement ce que vérifie l'étape **Portique** : sans les KEX modernes dans
`libssh2.a`, le run passe au rouge.

## Ce que le dépôt ne fait pas

Il ne publie rien : `latest.json` et les APK ANGi/TomTomBridge de `main` ne sont pas touchés.
L'APK sort en **artifact** du run.
