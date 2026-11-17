const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createApiHandler, pool } = require('./server');

const publicRoot = path.resolve(__dirname, '../gosie/dist/public');
const port = Number(process.env.PORT || 23967);
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
if (!fs.existsSync(path.join(publicRoot, 'index.html'))) {
  throw new Error(`Gosie production files are missing at ${publicRoot}; run the configured build first.`);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(text);
}

async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return sendText(res, 400, 'Bad request');
  }
  const requested = path.resolve(publicRoot, `.${pathname}`);
  if (requested !== publicRoot && !requested.startsWith(`${publicRoot}${path.sep}`)) return sendText(res, 403, 'Forbidden');
  let filePath = requested;
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    if (path.extname(pathname)) return sendText(res, 404, 'Not found');
    filePath = path.join(publicRoot, 'index.html');
  }
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return sendText(res, 404, 'Not found');
  } catch {
    return sendText(res, 404, 'Not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': mime.get(ext) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

async function main() {
  const apiHandler = createApiHandler();
  const server = http.createServer((req, res) => {
    if (new URL(req.url, 'http://localhost').pathname.startsWith('/api')) {
      return apiHandler(req, res);
    }
    serveStatic(req, res).catch(() => sendText(res, 500, 'Internal server error'));
  });
  server.timeout = 10000;
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'gosie_listening', port })));
  const stop = () => server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'startup_failed', message: error.message }));
  process.exit(1);
});
