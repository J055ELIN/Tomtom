#!/usr/bin/env bash
# inspect-apk.sh - Ce que le binaire contient reellement, et verdict conforme ou non.
#
# Sert a deux choses :
#   1. documenter pourquoi un APK decompile ne peut pas etre repare (sections 0 a 6) ;
#   2. servir de PORTIQUE apres un build : --expect=fixed sort 1 si le binaire
#      produit ne sait toujours pas negocier avec un sshd Debian 13. Utile parce
#      que 'compile.sh -t' (contribs PRECOMPILEES fournies par VideoLAN) fait
#      sauter le correctif en silence : get-contrib-sha.sh se base sur l'historique
#      git, donc un patch non commitne ne change pas le SHA et VideoLAN sert ses
#      .so officiels.
#
# Usage :
#   tools/inspect-apk.sh                                  # telecharge l'APK officiel 3.7.0 arm64
#   tools/inspect-apk.sh /chemin/vers/ton.apk              # analyse ton APK
#   tools/inspect-apk.sh /chemin/libvlc.so                 # analyse un .so deja extrait
#   tools/inspect-apk.sh /chemin/libssh2.a                 # analyse une archive statique
#   tools/inspect-apk.sh --expect=fixed  ton.apk           # verdict, code retour 0/1
#   tools/inspect-apk.sh --expect=broken /chemin/VLC-officiel.apk
#   tools/inspect-apk.sh ton.apk /chemin/libssh2.a         # + comparaison ligne a ligne
set -uo pipefail

VER="${VER:-3.7.0}"
ABI_DIR="${ABI_DIR:-arm64-v8a}"
URL="https://download.videolan.org/pub/videolan/vlc-android/${VER}/VLC-Android-${VER}-${ABI_DIR}.apk"
EXPECT="off"; ARGS=()
for a in "$@"; do
    case "$a" in
        --expect=*) EXPECT="${a#--expect=}" ;;
        *) ARGS+=("$a") ;;
    esac
done
TARGET_IN="${ARGS[0]:-}"
LIBSSH2_A="${ARGS[1]:-}"
W="$(mktemp -d /tmp/apkinspect.XXXXXX)"
rc=0
trap 'rm -rf "$W"' EXIT

case "$EXPECT" in off|fixed|broken) ;; *) echo "--expect vaut off|fixed|broken (recu: $EXPECT)"; exit 9 ;; esac

if [ -z "$TARGET_IN" ]; then
    echo "telechargement de l'APK officiel : $URL"
    curl -fsSL -m 600 -o "$W/app.apk" "$URL" || { echo "ECHEC du telechargement"; exit 9; }
    TARGET_IN="$W/app.apk"
fi
[ -f "$TARGET_IN" ] || { echo "fichier introuvable : $TARGET_IN"; exit 9; }

IS_APK=0
[ "$(head -c 2 "$TARGET_IN" 2>/dev/null)" = "PK" ] && IS_APK=1
echo "=== 0. objet analyse ==="
printf "   %s\n   taille : %s octets | sha256 : %s\n" "$TARGET_IN" "$(stat -c %s "$TARGET_IN")" "$(sha256sum "$TARGET_IN" | cut -c1-64)"
if [ "$IS_APK" = 1 ]; then
    unzip -l "$TARGET_IN" | tail -1 | sed 's/^/   entrees dans l archive: /' | tr -s ' '
fi

# --------------------------------------------------------------- 1 et 2 : APK
TARGET="$TARGET_IN"
if [ "$IS_APK" = 1 ]; then
    echo; echo "=== 1. bibliothèques natives embarquees (ABI $ABI_DIR) ==="
    unzip -l "$TARGET_IN" | awk -v a="$ABI_DIR" '$4 ~ ("lib/" a "/.*\\.so$") {printf "   %10s  %s\n",$1,$4}' | sort -k2
    SO_COUNT="$(unzip -l "$TARGET_IN" | grep -cE "lib/$ABI_DIR/.*\.so$")"
    echo "   -> $SO_COUNT fichier(s) .so"
    if unzip -l "$TARGET_IN" | grep -qiE "lib/$ABI_DIR/.*(sftp|ssh).*\.so$"; then
        echo "   -> un .so separe existe pour sftp/ssh : un remplacement isole serait envisageable"
    else
        echo "   -> AUCUN .so separe pour sftp/ssh : le module est lie dans le gros binaire"
        echo "      (donc 'echanger un .so' n'existe pas ici, il faut reconstruire le binaire)"
    fi
    echo; echo "=== 2. extraction des natifs ==="
    mkdir -p "$W/so"; unzip -o -q -j "$TARGET_IN" "lib/$ABI_DIR/*.so" -d "$W/so" 2>/dev/null
    ls -l "$W/so" | awk 'NR>1{printf "   %10s  %s\n",$5,$9}'
    for f in "$W/so"/*.so; do echo "   $(basename "$f") : $(file -b "$f" | cut -c1-58)"; done
    TARGET="$W/so/libvlc.so"
    [ -f "$TARGET" ] || TARGET="$(ls "$W/so"/*.so 2>/dev/null | head -1)"
fi
[ -f "$TARGET" ] || { echo "aucun binaire a analyser"; exit 9; }

# ------------------------------------------------------------------ 3 et 4
count_in() { strings -a -n 5 "$1" 2>/dev/null | grep -cxF "$2"; }
pat_in()   { strings -a -n 5 "$1" 2>/dev/null | grep -c  "$2"; }
echo; echo "=== 3. backend crypto lie statiquement (dans $(basename "$TARGET")) ==="
echo "   occurrences de chaines evocatrices (0 = le code n'est pas dans le binaire) :"
GCRY=$(pat_in "$TARGET" 'gcry_'); MBTL=$(pat_in "$TARGET" 'mbedtls_')
for pat in gcry_ mbedtls_ gnutls_ nettle_ ssh_key_; do
    printf "     %-10s %s\n" "$pat" "$(pat_in "$TARGET" "$pat")"
done
echo "   => le backend est celui annonce par ces compteurs, pas celui qu'on suppose"

echo; echo "=== 4. tables de methodes : quels algorithmes existent dans le binaire ==="
printf "   %-34s %-14s %s\n" "algorithme" "occurrences" "sert a"
declare -A C
for a in "diffie-hellman-group1-sha1" "diffie-hellman-group14-sha256" "diffie-hellman-group16-sha512" \
         "ecdh-sha2-nistp256" "curve25519-sha256" "ssh-rsa" "ssh-dss" "rsa-sha2-256" "rsa-sha2-512" \
         "ssh-ed25519" "ecdsa-sha2-nistp256"; do
    C["$a"]="$(count_in "$TARGET" "$a")"
    case "$a" in
      diffie-hellman*) why="KEX (les seuls que libgcrypt sait faire)";;
      ecdh-sha2*|curve25519*) why="KEX modernes (seuls offerts par OpenSSH 9.8+)";;
      rsa-sha2*|ssh-ed25519|ecdsa-sha2*) why="cles d'hote modernes";;
      *) why="cles d'hote heritees (SHA-1 / DSA)";;
    esac
    printf "   %-34s %-14s %s\n" "$a" "${C[$a]}" "$why"
done
echo
echo "   Lecture : ecdh-sha2-nistp256 / curve25519-sha256 / rsa-sha2-* a 0 veut dire que le"
echo "   client NE PEUT pas les proposer : la chaine n'existe pas dans le binaire. Elle est en"
echo "   .rodata d'un .so genere par le compilateur a partir des contribs C ; ni smali ni Java"
echo "   n'y peut rien (aucun de ces noms n'apparait dans les classes*.dex, cf. section 6)."

if [ -n "$LIBSSH2_A" ] && [ -f "$LIBSSH2_A" ]; then
    echo; echo "=== 5. comparaison avec une libssh2 construite localement ($LIBSSH2_A) ==="
    for a in "diffie-hellman-group14-sha256" "ecdh-sha2-nistp256" "rsa-sha2-512"; do
        printf "   %-32s binaire=%s  lib construite=%s\n" "$a" "${C[$a]}" "$(count_in "$LIBSSH2_A" "$a")"
    done
    printf "   %-32s binaire=%s  lib construite=%s\n" "mbedtls_" "$MBTL" "$(pat_in "$LIBSSH2_A" 'mbedtls_')"
fi

echo; echo "=== 6. cote Java/dex : reste-t-il seulement de quoi configurer SSH ? ==="
if [ "$IS_APK" = 1 ]; then
    mkdir -p "$W/dex"; unzip -o -q "$TARGET_IN" 'classes*.dex' -d "$W/dex" 2>/dev/null
    TS=0; TK=0
    for d in "$W/dex"/classes*.dex; do
        [ -f "$d" ] || continue
        S=$(strings -a -n 5 "$d" | grep -icE 'sftp'); K=$(strings -a -n 5 "$d" | grep -cxE 'kexalgorithms|hostkeyalgorithms|libssh2_session_method_pref|prefer_languages')
        TS=$((TS+S)); TK=$((TK+K))
        printf "   %-16s mentions de «sftp»=%-4s refs a une config d'algorithmes=%s\n" "$(basename "$d")" "$S" "$K"
    done
    echo "   total dex : sftp=$TS, config d'algorithmes=$TK"
else
    echo "   (non applicable : l'objet analyse n'est pas un APK)"
fi
echo "   => le code Java ne fait que passer l'URL ; modules/access/sftp.c de VLC n'appelle"
echo "      aucune fonction de preference d'algorithmes (verifie dans le depot : aucun"
echo "      libssh2_session_method_pref n'y figure)."

# ------------------------------------------------------------------ verdict
if [ "$EXPECT" != "off" ]; then
    echo; echo "=== 7. verdict (--expect=$EXPECT) ==="
    # Critere retenu : le NOM DU KEX, pas la chaine rsa-sha2-*. Mesure ici :
    #   - libssh2.a en backend libgcrypt contient « rsa-sha2-512 » (les tables de noms
    #     sont compilees) MAIS pas « ecdh-sha2-nistp256 » : la verification rsa-sha2,
    #     elle, est coupee par LIBSSH2_RSA_SHA2 0. Un test naive sur rsa-sha2 donnerait
    #     donc un faux negatif (le binaire « casse » passerait le test).
    #   - libvlc.so de VLC 3.7.0 : les deux a 0 (cf. section 4).
    KEX_MOD=$((${C[ecdh-sha2-nistp256]} + ${C[curve25519-sha256]}))
    FIXED_OK=1
    [ "$KEX_MOD" -ge 1 ] || FIXED_OK=0
    [ "$MBTL" -ge 1 ] || FIXED_OK=0
    BROKEN_OK=1
    [ "$KEX_MOD" -eq 0 ] || BROKEN_OK=0
    printf "   KEX modernes presents (ecdh+curve25519) : %s | mbedtls_ : %s occ. | gcry_ : %s occ.\n" "$KEX_MOD" "$MBTL" "$GCRY"
    printf "   (rsa-sha2-512 en clair dans le binaire : %s occ. - indicatif, NON discriminant)\n" "${C[rsa-sha2-512]}"
    printf "   criteres « corrige » : KEX modernes >= 1 ET mbedtls_ >= 1 -> %s\n" "$([ "$FIXED_OK" = 1 ] && echo OUI || echo NON)"
    printf "   criteres « embarque » : KEX modernes a 0                   -> %s\n" "$([ "$BROKEN_OK" = 1 ] && echo OUI || echo NON)"
    case "$EXPECT" in
      fixed)
        if [ "$FIXED_OK" = 1 ]; then
            echo "   VERDICT : CONFORME - le binaire expose des KEX acceptes par un sshd Debian 13."
        else
            echo "   VERDICT : NON CONFORME - le correctif n'est pas arrive jusqu'au binaire."
            echo "   Causes possibles, dans l'ordre de probabilite :"
            echo "     a) 'compile.sh -t' (ou VLC_PREBUILT_CONTRIBS_URL) : les contribs officielles"
            echo "        PRECOMPILEES ont ete telechargees, ton rules.mak n'a jamais tourne."
            echo "        get-contrib-sha.sh se base sur l'historique git : un patch non commitne"
            echo "        ne change pas le SHA, VideoLAN sert donc ses .so a lui. Relance SANS -t."
            echo "     b) le patch a ete reinitialise ('git reset --hard' sur vlc sans -b) :"
            echo "        verifie 'git -C <arbre vlc> status --porcelain'."
            echo "     c) le mauvais fichier a ete analyse (autre ABI, ancien APK) : ici"
            echo "        l'objet analyse est $(basename "$TARGET")."
            rc=1
        fi ;;
      broken)
        if [ "$BROKEN_OK" = 1 ]; then
            echo "   VERDICT : profil « VLC non patche » confirme (backend libgcrypt, aucun KEX"
            echo "   moderne) - c'est la reproduction binaire du bug, pas un artefact de mesure."
        else
            echo "   VERDICT : inattendu - ce binaire expose au moins un KEX moderne ; ce n'est"
            echo "   pas le profil du VLC officiel casse. Verifie l'objet analyse avant de conclure."
            rc=1
        fi ;;
    esac
fi
exit $rc
