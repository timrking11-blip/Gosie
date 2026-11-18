const https = require('node:https');
const dns = require('node:dns/promises');
const { publicUrl } = require('./contract.cjs');

// Conservative: IPv6 is blocked entirely, rather than attempting incomplete
// classification of IPv4-mapped, unique-local, link-local or transition ranges.
function publicAddress(address) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;
  const [a, b, c, d] = address.split('.').map(Number);
  return [a, b, c, d].every((n) => n >= 0 && n <= 255) &&
    a !== 0 && a !== 10 && a !== 127 && a < 224 &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) &&
    !(a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) &&
    !(a === 203 && b === 0 && c === 113);
}
async function resolvePublic(hostname, lookup = dns.lookup) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => !publicAddress(record.address))) throw new Error('blocked_network_address');
  return records[0];
}
async function safeFetch(value, { maxBytes = 262144, timeoutMs = 8000, headers = {}, lookup = dns.lookup, get = https.get } = {}) {
  const url = publicUrl(value);
  const started = Date.now();
  let dnsTimer;
  let address;
  try {
    address = await Promise.race([
      resolvePublic(url.hostname, lookup),
      new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('source_timeout')), timeoutMs); }),
    ]);
  } finally { clearTimeout(dnsTimer); }
  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers: { 'User-Agent': 'GosieResearch/1.0', 'Accept-Encoding': 'identity', ...headers },
      // Pin the checked address: the transport must not do a second DNS lookup.
      lookup: (_host, options, callback) => options?.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
    }, (response) => {
      if (response.statusCode !== 200) {
        response.destroy();
        reject(new Error(response.statusCode >= 300 && response.statusCode < 400 ? 'redirect_not_followed' : `source_http_${response.statusCode}`));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) response.destroy(new Error('source_too_large'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({
        text: Buffer.concat(chunks).toString('utf8'),
        contentType: String(response.headers['content-type'] || ''),
      }));
    });
    const timer = setTimeout(() => request.destroy(new Error('source_timeout')), Math.max(1, timeoutMs - (Date.now() - started)));
    request.once('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}
module.exports = { publicAddress, resolvePublic, safeFetch };
