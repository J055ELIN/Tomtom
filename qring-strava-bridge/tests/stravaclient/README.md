# Vérification du client Strava hors téléphone

`StravaClient` est compilé ici sans Android, contre des bouchons de `Context` et
`SharedPreferences`, puis exécuté face à un **faux serveur Strava** (`mock.py`) qui
refuse tout ce qui ne serait pas conforme :

* `/oauth/token` : vérifie `client_id`, `client_secret`, `grant_type` ;
* `/api/v3/uploads` : vérifie l'en-tête `multipart/form-data`, la présence de
  `data_type=tcx`, du fichier `QRingHR-test.tcx`, du XML, et du jeton `Bearer` ;
* `/api/v3/uploads/{id}` : vérifie le jeton et renvoie « Your activity is ready. ».

Résultat attendu :

```
LIAISON  ok=true | Compte Strava lié.
LIE=true
ENVOI    ok=true | Séance publiée sur Strava (activité n°987654).
== faux serveur Strava ==
TOKEN: requete conforme -> client_id=12345&client_secret=sekret&code=CODE-TEST&grant_type=authorization_code
UPLOAD: multipart conforme -> 458 octets
POLL: jeton accepte
```

Lancer : `ECJ_JAR=/tmp/ecj/ecj.jar bash run.sh`

Ce que cela **ne** couvre pas : le vrai serveur Strava (quotas, refus métier), le
retour du navigateur vers l'appli (`qringhr://qringhr`) et l'interface Android.
