# VLC Android — correctif SFTP pour OpenSSH 9.8+ (Debian 13)

## Problème

Depuis que ultra.cc a migré ses serveurs vers **Debian 13 (Trixie)** — OpenSSH **9.8p1** —
VLC Android/Apple TV ne peut plus se connecter en **SFTP** à la seedbox :

```
Unable to negotiate with ... port 22: no matching host key type found.
Their offer: ssh-rsa,ssh-dss [preauth]
```

### Cause racine (confirmée dans les sources)

VLC 3.0.x construit **libssh2 1.11.1 avec le backend cryptographique Libgcrypt**
(`contrib/src/ssh2/rules.mak`, `-DCRYPTO_BACKEND:STRING=Libgcrypt`).

Or le backend Libgcrypt de libssh2 1.11.1 désactive les algorithmes de clé d'hôte
modernes (`src/libgcrypt.h`) :

```c
#define LIBSSH2_RSA    1
#define LIBSSH2_RSA_SHA1 1
#define LIBSSH2_RSA_SHA2 0   // <-- rsa-sha2-256/512 désactivé
#define LIBSSH2_DSA    1
#define LIBSSH2_ECDSA  0     // <-- ECDSA désactivé
#define LIBSSH2_ED25519 0    // <-- Ed25519 désactivé
```

Résultat : `libssh2_hostkey_methods()` (src/hostkey.c) n'expose que
`ssh-rsa` (SHA-1) et `ssh-dss`. Ces deux algorithmes ne sont plus négociables
avec OpenSSH ≥ 8.8 (ssh-rsa retiré des valeurs par défaut) et **DSA est
compilé hors de l'OpenSSH 9.8 de Debian 13** (définitivement supprimé).
Le tunnel SFTP échoue donc avant même l'authentification, alors que
FileZilla/OpenSSH (qui utilisent `rsa-sha2-256/512` ou Ed25519) fonctionnent.

VLC, côté `modules/access/sftp.c`, ne liste aucun algorithme explicitement :
il dépend entièrement des défauts de libssh2.

## Correctif

Le fork ajoute le support **rsa-sha2-256 / rsa-sha2-512 au backend Libgcrypt
de libssh2 1.11.1** (le même correctif que libssh2 upstream a intégré sur
`master` après 1.11.1) :

- `patches/0001-libssh2-gcrypt-rsa-sha2.patch`
  - `src/libgcrypt.h` : `LIBSSH2_RSA_SHA2 0` → `1`
  - `src/libgcrypt.c` : implémentation de
    `_libssh2_rsa_sha2_verify()` (vérification PKCS#1 v1.5/SHA-256+SHA-512
    via `gcry_pk_verify`) et `_libssh2_rsa_sha2_sign()` (via `gcry_pk_sign`),
    calquées sur les fonctions `_libssh2_rsa_sha1_*` existantes.
- `patches/0002-vlc-apply-libssh2-patch.patch`
  - `contrib/src/ssh2/rules.mak` : applique le patch ci-dessus pendant la
    construction des contribs (`$(APPLY) $(SRC)/ssh2/0001-...patch`).

Avec ce patch, le client négocie `rsa-sha2-512` (utilisé en priorité par
libssh2) avec les serveurs OpenSSH modernes, y compris ceux de Debian 13.

## Validation

Le workflow `.github/workflows/vlc-sftp-fix.yml` contient un job de test qui :

1. compile libssh2 1.11.1 **non patché** puis **patché** (backend Libgcrypt,
   pour l'hôte) ;
2. lance un `sshd` moderne configuré pour **n'offrir QUE** `rsa-sha2-512` /
   `rsa-sha2-256` (clé d'hôte RSA uniquement — reproduit exactement le
   comportement d'OpenSSH 9.8 de Debian 13) ;
3. vérifie que le client non patché **échoue** et que le client patché
   **négocie `rsa-sha2-512`**.

Le second job construit l'APK VLC Android complet (flavor `Dev`, ABI
`arm64-v8a`, bibliothèque libvlc compilée depuis les sources patchées) et
publie l'APK en artefact + Release.

## Artifact attendu

- `application/vlc-android/build/outputs/apk/dev/…-arm64-v8a.apk`
  (signé avec la clé de debug, `org.videolan.vlc.debug` — désinstaller
  l'application VLC existante avant installation, la signature diffère).

## Utilisation

1. Ouvrir la **Release** « vlc-sftp-fix » du dépôt et télécharger l'APK.
2. Dans VLC : Réseau local → SFTP (ou Flux réseau) avec les mêmes
   identifiants que FileZilla.
3. Si la seedbox propose une clé d'hôte inconnue, VLC l'affichera et
   demandera confirmation — l'accepter.

## Note licence

VLC est GPLv2+ / LGPLv2 ; libssh2 est BSD-3-Clause. Le patch est BSD-3-Clause
(identique à la licence libssh2).
