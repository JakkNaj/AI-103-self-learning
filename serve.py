"""Serve only the standalone app. --lan permits a phone on the same network."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse, posixpath

ROOT = Path(__file__).resolve().parent
ALLOWED = {'index.html','styles.css','core.js','app.js','sw.js','manifest.webmanifest',
           'quick-tests.html','quick-tests.css','quick-tests.js',
           'README.md','GROUPED-QUESTION-MAP.md','CONTENT-REVIEW.md','EXAM-SECTIONS.md','THIRD_PARTY_NOTICES.txt'}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = posixpath.normpath(unquote(urlsplit(self.path).path)).lstrip('/')
        if not path or path == '.': self.path = '/index.html'
        elif path not in ALLOWED and not path.startswith(('assets/','data/','guides/')):
            self.send_error(404); return
        super().do_GET()

    def list_directory(self, path):
        self.send_error(404); return None

    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8767)
    parser.add_argument('--lan',action='store_true',help='Allow access from your phone on the same trusted Wi-Fi.')
    args=parser.parse_args();host='0.0.0.0' if args.lan else '127.0.0.1'
    print(f'AI-103 Topic Lab: http://127.0.0.1:{args.port}/',flush=True)
    if args.lan:print(f'Phone: http://<computer-LAN-IP>:{args.port}/ (same Wi-Fi)',flush=True)
    ThreadingHTTPServer((host,args.port),Handler).serve_forever()
