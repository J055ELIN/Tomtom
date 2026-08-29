/* hkprobe.c - sonde de negociation d'algorithmes SFTP/SSH
 *
 * Reproduit exactement ce que fait VLC: modules/access/sftp.c ->
 * libssh2_session_init() + libssh2_session_handshake() (aucune preference
 * d'algorithmes n'est fixee par VLC).
 *
 * Usage: hkprobe <host> <port> <user> <privkey.pem> [remotepath]
 * Sortie: 0 = poignee de main + auth + SFTP OK, sinon code d'erreur.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <netdb.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#include <libssh2.h>
#include <libssh2_sftp.h>

static const char *hkname(unsigned long t)
{
    switch(t) {
    case LIBSSH2_HOSTKEY_TYPE_RSA:    return "ssh-rsa (RSA)";
    case LIBSSH2_HOSTKEY_TYPE_DSS:    return "ssh-dss (DSA)";
    case LIBSSH2_HOSTKEY_TYPE_ECDSA_256: return "ecdsa-sha2-nistp256";
    case LIBSSH2_HOSTKEY_TYPE_ECDSA_384: return "ecdsa-sha2-nistp384";
    case LIBSSH2_HOSTKEY_TYPE_ECDSA_521: return "ecdsa-sha2-nistp521";
    case LIBSSH2_HOSTKEY_TYPE_ED25519:   return "ssh-ed25519";
    case LIBSSH2_HOSTKEY_TYPE_UNKNOWN:  return "inconnu";
    default: return "?";
    }
}

int main(int argc, char *argv[])
{
    const char *host = argc > 1 ? argv[1] : "127.0.0.1";
    int port       = argc > 2 ? atoi(argv[2]) : 22;
    const char *user = argc > 3 ? argv[3] : "user";
    const char *key  = argc > 4 ? argv[4] : NULL;
    const char *path = argc > 5 ? argv[5] : ".";

    printf("libssh2 compile: %s\n", libssh2_version(0));

    struct sockaddr_in sa;
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    memset(&sa, 0, sizeof(sa));
    sa.sin_family = AF_INET;
    sa.sin_port = htons(port);
    inet_pton(AF_INET, host, &sa.sin_addr);
    if(connect(sock, (struct sockaddr *)&sa, sizeof(sa)) != 0) {
        printf("ERREUR connexion TCP: %s\n", strerror(errno));
        return 10;
    }

    LIBSSH2_SESSION *sess = libssh2_session_init();
    libssh2_session_set_blocking(sess, 1);

    int rc = libssh2_session_handshake(sess, sock);
    if(rc) {
        char *msg = NULL;
        libssh2_session_last_error(sess, &msg, NULL, 0);
        printf("ECHEC KEX (rc=%d): %s\n", rc, msg ? msg : "(sans message)");
        printf("=> c'est exactement ce que voit VLC sur un serveur Debian 13\n");
        libssh2_session_free(sess);
        close(sock);
        return 1;
    }

    size_t klen = 0;
    int hlen = 0;
    libssh2_session_hostkey(sess, &klen, &hlen);
    printf("POIGNEE DE MAIN SSH OK\n");
    printf("  algo d'hote negocie   : %s\n", hkname((unsigned long)hlen));
    printf("  taille cle publique   : %lu octets\n", klen);
    printf("  kex negoci            : %s\n",
           libssh2_session_methods(sess, LIBSSH2_METHOD_KEX));
    printf("  hostkey negoci        : %s\n",
           libssh2_session_methods(sess, LIBSSH2_METHOD_HOSTKEY));
    printf("  cipher cs             : %s\n",
           libssh2_session_methods(sess, LIBSSH2_METHOD_CRYPT_CS));

    if(!key || !*key) {
        libssh2_session_disconnect(sess, "probe");
        libssh2_session_free(sess);
        close(sock);
        return 0;
    }

        if(!strncmp(key, "pw:", 3)) {
        rc = libssh2_userauth_password(sess, user, key + 3);
        printf("  authentification      : mot de passe ... ");
    } else {
        rc = libssh2_userauth_publickey_fromfile(sess, user, NULL, key, NULL);
        printf("  authentification      : cle privee ... ");
    }
    if(rc) {
        printf("ECHEC\n");
        char *msg = NULL;
        libssh2_session_last_error(sess, &msg, NULL, 0);
        printf("                       : ECHEC rc=%d (%s)\n", rc, msg ? msg : "?");
        libssh2_session_free(sess);
        close(sock);
        return 2;
    }
    printf("                       : OK\n");

    LIBSSH2_SFTP *sftp = libssh2_sftp_init(sess);
    if(!sftp) {
        printf("  sous-systeme sftp     : ECHEC\n");
        libssh2_session_free(sess);
        close(sock);
        return 3;
    }
    LIBSSH2_SFTP_HANDLE *h = libssh2_sftp_opendir(sftp, path);
    if(!h) {
        printf("  opendir %s          : ECHEC\n", path);
    }
    else {
        char name[512];
        int n, count = 0;
        printf("  listing de %s          :", path);
        while((n = libssh2_sftp_readdir(h, name, sizeof(name), NULL)) > 0) {
            printf(" %s", name);
            if(++count >= 12) { printf(" ..."); break; }
        }
        printf("\n");
        libssh2_sftp_closedir(h);
    }
    libssh2_sftp_shutdown(sftp);
    libssh2_session_disconnect(sess, "probe ok");
    libssh2_session_free(sess);
    close(sock);
    return 0;
}
