const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const workspaceRoot = path.resolve(__dirname, '../..');
const fixtureName = `.vite-access-check-${randomUUID()}.zip`;
const protectedFixtures = [
  path.join(workspaceRoot, 'attached_assets', fixtureName),
  path.join(workspaceRoot, '.migration-backup', fixtureName),
];
let server;
let origin;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestStatus(method, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(pathname, origin), { method }, (response) => {
      const status = response.statusCode;
      // Never consume response bodies. The test only needs the status code.
      response.destroy();
      resolve(status);
    });
    request.setTimeout(3000, () => request.destroy(new Error(`${method} ${pathname} timed out`)));
    request.once('error', reject);
    request.end();
  });
}

async function waitForVite() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited before becoming ready (${server.exitCode}).`);
    try {
      if ((await requestStatus('GET', '/src/main.tsx')) === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error('Vite did not serve /src/main.tsx within 10 seconds.');
}

before(async () => {
  for (const fixture of protectedFixtures) {
    fs.mkdirSync(path.dirname(fixture), { recursive: true });
    // An empty, uniquely named canary ensures Vite applies its deny rule even
    // in CI checkouts where user-uploaded directories are otherwise absent.
    fs.writeFileSync(fixture, Buffer.alloc(0), { flag: 'wx' });
  }

  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), BASE_PATH: '/', NODE_ENV: 'test' };
  delete env.REPL_ID;
  server = spawn('pnpm', ['exec', 'vite', '--config', 'vite.config.ts', '--host', '127.0.0.1'], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await waitForVite();
  } catch (error) {
    server.kill('SIGTERM');
    throw new Error(`${error.message}\n${stderr}`);
  }
});

after(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await stopped;
  }
  for (const fixture of protectedFixtures) {
    try { fs.unlinkSync(fixture); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
});

test('GET and HEAD do not expose attachment or migration-backup files', async (context) => {
  for (const fixture of protectedFixtures) {
    const pathname = `/@fs${fixture}`;
    for (const method of ['GET', 'HEAD']) {
      await context.test(`${method} ${path.relative(workspaceRoot, fixture)}`, async () => {
        const status = await requestStatus(method, pathname);
        assert.ok([403, 404].includes(status), `expected 403 or 404, received ${status}`);
      });
    }
  }
});

test('public app entry, stylesheet, and favicon remain available', async (context) => {
  for (const pathname of ['/src/main.tsx', '/src/styles.css', '/favicon.svg']) {
    for (const method of ['GET', 'HEAD']) {
      await context.test(`${method} ${pathname}`, async () => {
        assert.equal(await requestStatus(method, pathname), 200);
      });
    }
  }
});
