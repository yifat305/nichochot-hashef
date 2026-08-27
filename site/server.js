const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 5177;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
      return;
    }

    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const cache = /\.(html|css|js)$/.test(file) ? 'no-store' : 'public, max-age=86400';

    /* בלי תמיכה ב-Range הדפדפן מנגן וידאו אבל לא מסוגל לדלג בו,
       וגלילה על ציר הזמן פשוט לא עובדת. */
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (isNaN(start) || isNaN(end) || start > end || end >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cache,
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
