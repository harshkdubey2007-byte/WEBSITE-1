const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const port = process.argv[3] || 4174;
const homeRoute = process.argv[4];
// Optional comma-separated list: when a path 404s at the root, retry it under
// each prefix in turn. Lets a mirrored site whose runtime asks for
// root-absolute /_next/* resolve those files from the subdirectory they were
// archived into, and lets a deep page be reached by a short URL.
const fallbackPrefixes = (process.argv[5] || '').split(',').map(s => s.trim()).filter(Boolean);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

function send(res, filePath, data) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  res.end(data);
}

// Resolve one candidate path: the file itself, index.html inside it if it is a
// directory, or path + .html for extensionless requests. Calls back with null
// when nothing matched so the caller can try the next candidate.
function tryServe(filePath, cb) {
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (!err2) return cb(filePath, data);
      if (!path.extname(filePath)) {
        const htmlPath = filePath + '.html';
        return fs.readFile(htmlPath, (err3, data2) => {
          if (err3) return cb(null);
          cb(htmlPath, data2);
        });
      }
      cb(null);
    });
  });
}

const server = http.createServer((req, res) => {
  const [rawPath, query] = req.url.split('?');
  let reqPath = decodeURIComponent(rawPath);

  // Serve the home page at / itself. Its own ../relative asset references then
  // resolve one directory too high, which the fallback prefixes below catch.
  if (homeRoute && reqPath === '/') reqPath = homeRoute;

  if (reqPath.endsWith('/')) reqPath = reqPath + 'index.html';

  // Candidates in order: the path itself, then the same path under the
  // fallback prefix. The archiver stores query-string URLs (Next's
  // /_next/image?url=...) as filenames with '?' rewritten to '@', so when
  // there is a query string try that spelling for each location too.
  const bases = [path.join(root, reqPath)];
  for (const prefix of fallbackPrefixes) bases.push(path.join(root, prefix, reqPath));

  const candidates = [];
  for (const base of bases) {
    candidates.push(base);
    if (query) candidates.push(base + '@' + query);
  }

  (function next(i) {
    if (i >= candidates.length) {
      res.writeHead(404);
      return res.end('Not found');
    }
    tryServe(candidates[i], (found, data) => {
      if (found) return send(res, found, data);
      next(i + 1);
    });
  })(0);
});

server.listen(port, () => console.log(`Serving ${root} on port ${port}`));
