const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.resolve(__dirname, 'dist/public');
const archiveExtensions = new Set([
  '.7z', '.bz2', '.gz', '.rar', '.tar', '.tgz', '.xz', '.zip', '.zst',
]);
const archiveSignatures = [
  (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3]),
  (bytes) => bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b,
  (bytes) => bytes.length >= 6 && bytes.subarray(0, 6).equals(Buffer.from('377abcaf271c', 'hex')),
  (bytes) => bytes.length >= 7 && bytes.subarray(0, 7).equals(Buffer.from('526172211a0700', 'hex')),
  (bytes) => bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from('425a68', 'hex')),
  (bytes) => bytes.length >= 6 && bytes.subarray(0, 6).equals(Buffer.from('fd377a585a00', 'hex')),
  (bytes) => bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from('28b52ffd', 'hex')),
  (bytes) => bytes.length >= 262 && bytes.subarray(257, 262).toString('ascii') === 'ustar',
];
const forbiddenDirectories = new Set(['.migration-backup', 'attached_assets', 'uploads']);

function walk(directory, relative = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const childRelative = path.join(relative, entry.name);
    const childPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? [{ relative: childRelative, directory: true }, ...walk(childPath, childRelative)]
      : [{ relative: childRelative, directory: false, fullPath: childPath }];
  });
}

function checkBuiltOutput() {
  const indexPath = path.join(publicRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Production build is missing ${indexPath}; build Gosie before this check.`);
  }

  const entries = walk(publicRoot);
  const leakedDirectories = entries.filter((entry) =>
    entry.directory && forbiddenDirectories.has(path.basename(entry.relative).toLowerCase()));
  if (leakedDirectories.length) {
    throw new Error(`Private source directory found in dist/public: ${leakedDirectories.map((entry) => entry.relative).join(', ')}`);
  }

  const leakedArchives = entries.filter((entry) => {
    if (entry.directory) return false;
    if (archiveExtensions.has(path.extname(entry.relative).toLowerCase())) return true;
    const signature = Buffer.alloc(512);
    const fd = fs.openSync(entry.fullPath, 'r');
    let bytesRead;
    try {
      bytesRead = fs.readSync(fd, signature, 0, signature.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    const header = signature.subarray(0, bytesRead);
    return archiveSignatures.some((matches) => matches(header));
  });
  if (leakedArchives.length) {
    throw new Error(`Archive found in dist/public: ${leakedArchives.map((entry) => entry.relative).join(', ')}`);
  }

  const privateRouteFiles = entries.filter((entry) => {
    if (entry.directory) return false;
    const segments = entry.relative.split(/[\\/]/).map((segment) => segment.toLowerCase());
    return segments.includes('api') ||
      segments.includes('export') ||
      (segments[0] === 'profiles' && segments.length >= 3 && segments.at(-1) === 'export');
  });
  if (privateRouteFiles.length) {
    throw new Error(`Private export/API route file found in dist/public: ${privateRouteFiles.map((entry) => entry.relative).join(', ')}`);
  }

  console.log(`PASS dist/public contains ${entries.filter((entry) => !entry.directory).length} files and no uploaded archives or private export/API route files.`);
}

async function request(url, method, readBody = false) {
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  if (readBody) return { response, body: await response.text() };
  if (response.body) await response.body.cancel();
  return { response };
}

async function checkProductionUrl(value) {
  const base = new URL(value);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('GOSIE_PRODUCTION_URL must be a clean HTTPS URL without credentials, query, or fragment.');
  }

  const homepage = await request(new URL('/', base), 'GET', true);
  if (homepage.response.status !== 200 ||
      !homepage.response.headers.get('content-type')?.includes('text/html') ||
      /\/@vite\/client|vite\.svg/i.test(homepage.body)) {
    throw new Error(`Production homepage check failed with HTTP ${homepage.response.status} or development-server content.`);
  }
  console.log('PASS production homepage serves HTML without Vite development content.');

  for (const route of ['/attached_assets/private.zip', '/.migration-backup/private.zip', '/uploads/private.zip']) {
    const { response } = await request(new URL(route, base), 'GET');
    if (![403, 404].includes(response.status)) {
      throw new Error(`Production archive probe ${route} returned HTTP ${response.status}; expected 403 or 404.`);
    }
  }
  console.log('PASS production archive probes are not publicly served.');

  const exportRoute = '/api/profiles/00000000-0000-4000-8000-000000000000/export';
  const { response } = await request(new URL(exportRoute, base), 'GET');
  if (![401, 403, 404].includes(response.status)) {
    throw new Error(`Unauthenticated production export probe returned HTTP ${response.status}; expected 401, 403, or 404.`);
  }
  console.log('PASS unauthenticated production profile export is denied.');
}

async function main() {
  checkBuiltOutput();
  const productionUrl = process.env.GOSIE_PRODUCTION_URL;
  if (productionUrl) {
    await checkProductionUrl(productionUrl);
  } else {
    console.log('SKIP live production probes: GOSIE_PRODUCTION_URL is not configured.');
  }
}

main().catch((error) => {
  console.error(`FAIL release privacy check: ${error.message}`);
  process.exitCode = 1;
});
