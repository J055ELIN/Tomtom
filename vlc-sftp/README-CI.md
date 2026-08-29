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
