// Run: node --test artifacts/gosie-mobile/server/serve.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const MOBILE = path.resolve(__dirname, '..');
const SIBLING = path.join(MOBILE, 'static-build-secret');
let child, port;

function freePort() { return new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); }); }
// Raw socket so paths are sent exactly as written (http.request would normalize some).
function raw(requestLine) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(`${requestLine}\r\nHost: localhost\r\nConnection: close\r\n\r\n`));
    let data = ''; s.on('data', d => data += d); s.on('end', () => resolve(data)); s.on('error', reject);
  });
}
const status = r => Number(r.split(' ')[1]);

before(async () => {
  fs.mkdirSync(SIBLING, { recursive: true });
  fs.writeFileSync(path.join(SIBLING, 'secret.txt'), 'TOPSECRET');
  port = await freePort();
  child = spawn(process.execPath, [path.join(__dirname, 'serve.js')], { env: Object.assign({}, process.env, { PORT: String(port), BASE_PATH: '/' }), stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await raw('GET / HTTP/1.1'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
});
after(() => { child.kill(); fs.rmSync(SIBLING, { recursive: true, force: true }); });

test('landing page served with security headers', async () => {
  const r = await raw('GET / HTTP/1.1');
  assert.strictEqual(status(r), 200);
  assert.match(r, /x-content-type-options: nosniff/i);
});

test('sibling-prefix directory traversal is blocked', async () => {
  for (const p of ['/../static-build-secret/secret.txt', '/%2e%2e/static-build-secret/secret.txt', '/..%2fstatic-build-secret/secret.txt']) {
    const r = await raw(`GET ${p} HTTP/1.1`);
    assert.ok(!r.includes('TOPSECRET'), p);
  }
});

test('bad encoding and NUL bytes return 400 and do not crash the server', async () => {
  assert.strictEqual(status(await raw('GET /%E0%A4%A HTTP/1.1')), 400);
  assert.strictEqual(status(await raw('GET /%00 HTTP/1.1')), 400);
  assert.strictEqual(status(await raw('GET / HTTP/1.1')), 200);
});

test('non-GET/HEAD methods are rejected', async () => {
  assert.strictEqual(status(await raw('POST / HTTP/1.1')), 405);
});

test('missing files return 404', async () => {
  assert.strictEqual(status(await raw('GET /nope.js HTTP/1.1')), 404);
});

test('invalid PORT fails fast', async () => {
  const code = await new Promise(r => { const c = spawn(process.execPath, [path.join(__dirname, 'serve.js')], { env: Object.assign({}, process.env, { PORT: 'abc' }), stdio: 'ignore' }); c.on('exit', r); });
  assert.strictEqual(code, 1);
});
