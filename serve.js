// Simple static file server - zero external deps
// Usage: node serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = parseInt(process.argv[2], 10) || 3000;
const base = process.cwd();
const mime = {
  '.html':'text/html',
  '.js':'application/javascript',
  '.css':'text/css',
  '.json':'application/json',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon'
};
function send404(res) {
  res.writeHead(404, {'Content-Type':'text/plain'});
  res.end('404');
}
http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(base, reqPath.replace(/^\//,'')); // prevent leading /
    if (!filePath.startsWith(base)) {
      res.writeHead(403); res.end('Forbidden');
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        send404(res); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': type});
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
}).listen(port, () => {
  console.log('Static server running at http://localhost:' + port);
});
