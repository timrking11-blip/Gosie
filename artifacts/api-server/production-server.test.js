// Run after the Gosie web build. These checks never connect to a database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
let child;
let base;
before(async () => {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(__dirname, 'production-server.js')], {
    env: { ...process.env, PORT: String(port), SESSION_SECRET: 'synthetic-static-server-test-only',
      DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Production server exited: ${logs}`);
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Production server did not start: ${logs}`);
});
after(async () => {
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
});
test('production serves marketing and app routes and routes API requests to the handler', async () => {
  for (const route of ['/', '/login', '/app']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.doesNotMatch(await response.text(), /\/@vite\/client/);
  }
  const response = await fetch(`${base}/api/auth/session`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});
test('source archives are not served and range requests have correct byte counts', async () => {
  assert.equal((await fetch(`${base}/attached_assets/private.zip`)).status, 404);
  const response = await fetch(base, { headers: { Range: 'bytes=0-15' } });
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 16);
  assert.match(response.headers.get('content-range'), /^bytes 0-15\//);
  assert.equal((await fetch(base, { headers: { Range: 'bytes=999999999-' } })).status, 416);
});
