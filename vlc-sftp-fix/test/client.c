/*
 * Minimal libssh2 handshake test client.
 *
 * Connects to an SSH server, performs the key exchange handshake and prints
 * the negotiated host key algorithm.  Exit code 0 means the client managed
 * to negotiate an rsa-sha2-256/512 host key (i.e. the SFTP fix works with
 * modern OpenSSH servers, where ssh-rsa/SHA-1 is disabled by default).
 *
 * Usage: client [host] [port]
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <libssh2.h>

int main(int argc, char **argv)
{
    int sock, ret = 0;
    const char *host = argc > 1 ? argv[1] : "127.0.0.1";
    int port = argc > 2 ? atoi(argv[2]) : 2222;
    LIBSSH2_SESSION *session;
    const char *method;
    struct sockaddr_in sin;
    size_t key_len = 0;
    int key_type = 0;

    sock = socket(AF_INET, SOCK_STREAM, 0);
    if(sock < 0) {
        perror("socket");
        return 2;
    }

    memset(&sin, 0, sizeof(sin));
    sin.sin_family = AF_INET;
    sin.sin_port = htons((unsigned short)port);
    sin.sin_addr.s_addr = inet_addr(host);
    if(connect(sock, (struct sockaddr *)&sin, sizeof(sin)) < 0) {
        perror("connect");
        close(sock);
        return 2;
    }

    if(libssh2_init(0) != 0) {
        fprintf(stderr, "libssh2_init failed\n");
        close(sock);
        return 2;
    }

    session = libssh2_session_init();
    if(!session) {
        fprintf(stderr, "libssh2_session_init failed\n");
        libssh2_exit();
        close(sock);
        return 2;
    }
    libssh2_session_set_blocking(session, 1);

    if(libssh2_session_handshake(session, sock) != 0) {
        fprintf(stderr, "HANDSHAKE FAILED (expected with unpatched libssh2)\n");
        ret = 1;
        goto out;
    }

    method = libssh2_session_methods(session, LIBSSH2_METHOD_HOSTKEY);
    libssh2_session_hostkey(session, &key_len, &key_type);
    printf("HANDSHAKE OK hostkey_method=%s type=%d\n",
           method ? method : "(null)", key_type);

    if(!method || strncmp(method, "rsa-sha2", 8) != 0)
        ret = 1;

out:
    libssh2_session_disconnect(session, "bye");
    libssh2_session_free(session);
    libssh2_exit();
    close(sock);
    return ret;
}
