import http.server, json, time, re

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n)
        if self.path == '/oauth/token':
            txt = body.decode()
            assert 'grant_type=authorization_code' in txt or 'grant_type=refresh_token' in txt, txt
            assert 'client_id=12345' in txt and 'sekret' in txt, txt
            print('TOKEN: requete conforme ->', txt[:90])
            return self._send({"token_type":"Bearer","access_token":"AT-1","refresh_token":"RT-1",
                               "expires_at": int(time.time())+21600})
        if self.path == '/api/v3/uploads':
            ctype = self.headers.get('Content-Type','')
            assert ctype.startswith('multipart/form-data; boundary='), ctype
            b = ctype.split('boundary=')[1].encode()
            assert b'name="data_type"' in body and b'tcx' in body, 'data_type manquant'
            assert b'filename="QRingHR-test.tcx"' in body, 'fichier manquant'
            assert b'<TrainingCenterDatabase>' in body, 'contenu TCX absent'
            assert self.headers.get('Authorization') == 'Bearer AT-1', self.headers.get('Authorization')
            print('UPLOAD: multipart conforme ->', len(body), 'octets')
            return self._send({"id":42,"status":"Your activity is queued."})
        self._send({"error":"not found"}, 404)
    def do_GET(self):
        if self.path == '/api/v3/uploads/42':
            assert self.headers.get('Authorization') == 'Bearer AT-1'
            print('POLL: jeton accepte')
            return self._send({"id":42,"status":"Your activity is ready.","activity_id":987654})
        self._send({"error":"not found"}, 404)

http.server.HTTPServer(('127.0.0.1', 8099), H).serve_forever()
