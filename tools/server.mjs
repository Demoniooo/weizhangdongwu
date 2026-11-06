import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.css':'text/css','.ttf':'font/ttf','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.lrc':'text/plain; charset=utf-8'};
export function startServer(root = process.cwd()) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(d);
      });
    }).listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8765);
  http.createServer((req,res)=>{}).close();
  const { srv } = await startServer();
  console.log('serving on', srv.address().port);
}
