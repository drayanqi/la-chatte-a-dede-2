// Simple static file server - zero external deps
// Usage: PORT=3000 node serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const argPort = parseInt(process.argv[2], 10);
const port = (!Number.isNaN(argPort) && argPort > 0) ? argPort : parseInt(process.env.PORT, 10) || 3000;
const base = process.cwd();

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404');
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mime[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';

    const filePath = path.join(base, reqPath.replace(/^\//, ''));
    if (!filePath.startsWith(base)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) {
        sendFile(res, filePath);
        return;
      }

      // SPA/deep-link support: if the route has no extension, serve index.html
      if (!path.extname(filePath)) {
        const fallback = path.join(base, 'index.html');
        if (fs.existsSync(fallback)) {
          sendFile(res, fallback);
          return;
        }
      }

      send404(res);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Server error');
  }
}).listen(port, () => {
  console.log(`Static server running at http://localhost:${port}`);
  console.log('Press Ctrl+C to stop.');
});
