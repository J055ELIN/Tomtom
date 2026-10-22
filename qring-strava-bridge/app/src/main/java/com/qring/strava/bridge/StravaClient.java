package com.qring.strava.bridge;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Envoi direct d'une séance à Strava via l'API officielle (OAuth 2).
 *
 * Pourquoi : avec un seul téléphone, Strava ne peut pas lire la FC en direct
 * (un appareil ne reçoit jamais ses propres publicités BLE). En revanche l'API
 * permet de publier l'activité enregistrée (FC + GPS) sans passer par un fichier
 * ni par l'écran d'import.
 *
 * L'utilisateur crée sa propre application API sur strava.com et colle son
 * identifiant + secret une seule fois : rien n'est codé en dur dans l'appli.
 */
public class StravaClient {

    /** Domaine de retour (strava.com/settings/api → Authorization Callback Domain). */
    public static final String CALLBACK_DOMAIN = "qringhr";
    public static final String REDIRECT_URI = "qringhr://qringhr";

    /** Base des URL : modifiable uniquement pour les tests hors appareil. */
    static String base = "https://www.strava.com";
    private static String AUTHORIZE_URL() { return base + "/oauth/mobile/authorize"; }
    private static String TOKEN_URL() { return base + "/oauth/token"; }
    private static String UPLOAD_URL() { return base + "/api/v3/uploads"; }

    private static final String PREF_ACCESS = "strava_access_token";
    private static final String PREF_REFRESH = "strava_refresh_token";
    private static final String PREF_EXPIRES = "strava_expires_at";

    public interface Callback {
        void done(boolean ok, String message);
    }

    // ------------------------------------------------------------------
    // Configuration (saisie une seule fois par l'utilisateur)
    // ------------------------------------------------------------------

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
    }

    public static String clientId(Context c) {
        return prefs(c).getString("strava_client_id", "");
    }

    public static String clientSecret(Context c) {
        return prefs(c).getString("strava_client_secret", "");
    }

    public static void saveCredentials(Context c, String id, String secret) {
        prefs(c).edit()
                .putString("strava_client_id", id.trim())
                .putString("strava_client_secret", secret.trim())
                .apply();
    }

    public static boolean isLinked(Context c) {
        return prefs(c).getString(PREF_REFRESH, "").length() > 0;
    }

    public static void unlink(Context c) {
        prefs(c).edit()
                .remove(PREF_ACCESS).remove(PREF_REFRESH).remove(PREF_EXPIRES)
                .apply();
    }

    public static String authorizeUrl(Context c) {
        return AUTHORIZE_URL()
                + "?client_id=" + enc(clientId(c))
                + "&redirect_uri=" + enc(REDIRECT_URI)
                + "&response_type=code"
                + "&approval_prompt=force"
                + "&scope=" + enc("activity:write,read");
    }

    // ------------------------------------------------------------------
    // Échange du code reçu en retour (qringhr://qringhr?code=...)
    // ------------------------------------------------------------------

    public static void exchangeCode(final Context ctx, final String code, final Callback cb) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String body = "client_id=" + enc(clientId(ctx))
                            + "&client_secret=" + enc(clientSecret(ctx))
                            + "&code=" + enc(code)
                            + "&grant_type=authorization_code";
                    String json = post(TOKEN_URL(), body);
                    if (storeTokens(ctx, json)) {
                        cb.done(true, "Compte Strava lié.");
                    } else {
                        cb.done(false, "Strava a refusé la liaison : " + shortError(json));
                    }
                } catch (Exception e) {
                    cb.done(false, "Impossible de joindre Strava : " + describe(e));
                }
            }
        }, "strava-token").start();
    }

    // ------------------------------------------------------------------
    // Envoi du fichier
    // ------------------------------------------------------------------

    public static void upload(final Context ctx, final byte[] tcx, final String fileName,
                              final Callback cb) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String token = validToken(ctx);
                    if (token == null) {
                        cb.done(false, "Compte Strava non lié.");
                        return;
                    }
                    String boundary = "----QRingHR" + System.currentTimeMillis();
                    ByteArrayOutputStream buf = new ByteArrayOutputStream();
                    // Strava exige un champ multipart nomme "file" (doc officielle
                    // developers.strava.com/docs/uploads). Un autre nom -> 400.
                    writeField(buf, boundary, "external_id",
                            "qringhr-" + fileName.replace(".tcx", ""));
                    writeField(buf, boundary, "data_type", "tcx");
                    writeField(buf, boundary, "sport_type", "Ride");
                    writeField(buf, boundary, "trainer", "0");
                    writeField(buf, boundary, "commute", "0");
                    writeFile(buf, boundary, "file", fileName, tcx);
                    buf.write(("--" + boundary + "--\r\n").getBytes("UTF-8"));

                    String resp = postBytes(UPLOAD_URL(), buf.toByteArray(),
                            "multipart/form-data; boundary=" + boundary, token);
                    int id = intValue(resp, "\"id\"\\s*:\\s*(\\d+)");
                    if (id <= 0) {
                        cb.done(false, "Strava a refusé le fichier : " + shortError(resp));
                        return;
                    }
                    Logs.add("[strava] envoi accepté, traitement n°" + id);

                    // Strava traite le fichier en arrière-plan : on interroge l'état.
                    for (int i = 0; i < 20; i++) {
                        Thread.sleep(3000L);
                        String status = get(UPLOAD_URL() + "/" + id, token);
                        String s = strValue(status, "\"status\"\\s*:\\s*\"([^\"]*)\"");
                        if (s == null) {
                            continue;
                        }
                        if (s.toLowerCase().contains("ready") || s.toLowerCase().contains("processed")) {
                            cb.done(true, "Séance publiée sur Strava (activité n°"
                                    + intValue(status, "\"activity_id\"\\s*:\\s*(\\d+)") + ").");
                            return;
                        }
                        if (s.toLowerCase().contains("error") || s.toLowerCase().contains("duplicate")) {
                            cb.done(false, "Strava n'a pas pu lire la séance : " + s
                                    + (s.toLowerCase().contains("duplicate")
                                    ? " (elle a déjà été envoyée)" : ""));
                            return;
                        }
                    }
                    cb.done(false, "Strava traite encore le fichier — vérifiez votre compte "
                            + "dans une minute.");
                } catch (Exception e) {
                    cb.done(false, "Envoi impossible : " + describe(e));
                }
            }
        }, "strava-upload").start();
    }

    // ------------------------------------------------------------------
    // Jetons
    // ------------------------------------------------------------------

    private static String validToken(Context ctx) throws Exception {
        SharedPreferences p = prefs(ctx);
        String access = p.getString(PREF_ACCESS, "");
        long expires = p.getLong(PREF_EXPIRES, 0L);
        if (access.length() > 0 && System.currentTimeMillis() / 1000L < expires - 60L) {
            return access;
        }
        String refresh = p.getString(PREF_REFRESH, "");
        if (refresh.length() == 0) {
            return null;
        }
        String body = "client_id=" + enc(clientId(ctx))
                + "&client_secret=" + enc(clientSecret(ctx))
                + "&grant_type=refresh_token"
                + "&refresh_token=" + enc(refresh);
        String json = post(TOKEN_URL(), body);
        if (storeTokens(ctx, json)) {
            return prefs(ctx).getString(PREF_ACCESS, null);
        }
        return null;
    }

    private static boolean storeTokens(Context ctx, String json) {
        String access = strValue(json, "\"access_token\"\\s*:\\s*\"([^\"]+)\"");
        String refresh = strValue(json, "\"refresh_token\"\\s*:\\s*\"([^\"]+)\"");
        long expires = intValue(json, "\"expires_at\"\\s*:\\s*(\\d+)");
        if (access == null) {
            return false;
        }
        SharedPreferences.Editor e = prefs(ctx).edit().putString(PREF_ACCESS, access);
        if (refresh != null) {
            e.putString(PREF_REFRESH, refresh);
        }
        if (expires > 0) {
            e.putLong(PREF_EXPIRES, expires);
        }
        e.apply();
        return true;
    }

    // ------------------------------------------------------------------
    // HTTP minimaliste (aucune dépendance)
    // ------------------------------------------------------------------

    private static String post(String url, String body) throws Exception {
        return postBytes(url, body.getBytes("UTF-8"),
                "application/x-www-form-urlencoded", null);
    }

    private static String postBytes(String url, byte[] body, String contentType, String token)
            throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", contentType);
            if (token != null) {
                c.setRequestProperty("Authorization", "Bearer " + token);
            }
            c.setFixedLengthStreamingMode(body.length);
            OutputStream out = c.getOutputStream();
            out.write(body);
            out.close();
            return read(c);
        } finally {
            c.disconnect();
        }
    }

    private static String get(String url, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setRequestProperty("Authorization", "Bearer " + token);
            return read(c);
        } finally {
            c.disconnect();
        }
    }

    private static String read(HttpURLConnection c) throws Exception {
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        if (in == null) {
            return "";
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
        }
        in.close();
        String s = new String(out.toByteArray(), "UTF-8");
        return code >= 400 ? ("HTTP " + code + " " + s) : s;
    }

    private static void writeField(ByteArrayOutputStream b, String boundary, String name, String value)
            throws Exception {
        b.write(("--" + boundary + "\r\n").getBytes("UTF-8"));
        b.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes("UTF-8"));
        b.write(value.getBytes("UTF-8"));
        b.write("\r\n".getBytes("UTF-8"));
    }

    private static void writeFile(ByteArrayOutputStream b, String boundary, String name,
                                  String fileName, byte[] data) throws Exception {
        b.write(("--" + boundary + "\r\n").getBytes("UTF-8"));
        b.write(("Content-Disposition: form-data; name=\"" + name + "\"; filename=\""
                + fileName + "\"\r\n").getBytes("UTF-8"));
        b.write("Content-Type: application/vnd.garmin.tcx+xml\r\n\r\n".getBytes("UTF-8"));
        b.write(data);
        b.write("\r\n".getBytes("UTF-8"));
    }

    // ------------------------------------------------------------------
    // Petits utilitaires
    // ------------------------------------------------------------------

    private static String enc(String s) {
        try {
            return URLEncoder.encode(s == null ? "" : s, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            return "";
        }
    }

    private static String strValue(String json, String regex) {
        if (json == null) {
            return null;
        }
        Matcher m = Pattern.compile(regex).matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static int intValue(String json, String regex) {
        String v = strValue(json, regex);
        if (v == null) {
            return -1;
        }
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static String shortError(String json) {
        if (json == null) {
            return "réponse vide";
        }
        String err = strValue(json, "\"error\"\\s*:\\s*\"([^\"]*)\"");
        String msg = strValue(json, "\"message\"\\s*:\\s*\"([^\"]*)\"");
        String out = err != null ? err : (msg != null ? msg : json);
        return out.length() > 160 ? out.substring(0, 160) : out;
    }

    private static String describe(Exception e) {
        String m = e.getMessage();
        return e.getClass().getSimpleName() + (m == null ? "" : " : " + m);
    }
}
