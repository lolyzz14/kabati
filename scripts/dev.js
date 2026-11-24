// Runs Kabati on this computer the way Vercel runs it online.
// FAKE_IG=1 LOCAL_ADMIN=1 node scripts/dev.js   ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('../api/index');

const PORT = Number(process.env.PORT || 3000);
const PUB = path.join(__dirname, '..', 'public');
const BLOBS = path.join(__dirname, '..', '.data', 'blobs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function file(res, p) {
  fs.readFile(p, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) return api(req, res);
  if (u.pathname.startsWith('/blob/')) return file(res, path.join(BLOBS, path.basename(u.pathname)));
  const p = path.join(PUB, path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (u.pathname !== '/' && fs.existsSync(p) && fs.statSync(p).isFile()) return file(res, p);
  return file(res, path.join(PUB, 'index.html'));
}).listen(PORT, () => console.log('Kabati running on http://localhost:' + PORT));
