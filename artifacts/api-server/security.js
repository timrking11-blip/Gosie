const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { pool } = require('./db');

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'gosie_session';
const SESSION_DAYS = 1;
const MAX_AUTH_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT) || 20;
const RATE_LIMIT_SECRET = process.env.SESSION_SECRET || process.env.RATE_LIMIT_SECRET;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

if (process.env.NODE_ENV === 'production' && !RATE_LIMIT_SECRET) {
  throw new Error('SESSION_SECRET is required for production rate-limit hashing.');
}
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '1') {
  throw new Error('COOKIE_SECURE=1 is required for production sign-in.');
}

function token(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ipFingerprint(ip) {
  const key = RATE_LIMIT_SECRET || 'gosie-development-only-rate-limit-key';
  return crypto.createHmac('sha256', key).update(ip).digest('hex');
}

async function hashPassword(password, salt = token(16)) {
  const result = await scrypt(password, salt, 64);
  return { salt, hash: result.toString('hex') };
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

async function rateLimited(req) {
  const fingerprint = ipFingerprint(clientIp(req));
  const result = await pool.query(
    `INSERT INTO gosie_auth_rate_limits (ip_hash, window_started_at, hits)
     VALUES ($1, NOW(), 1)
     ON CONFLICT (ip_hash) DO UPDATE SET
       hits = CASE
         WHEN gosie_auth_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
         ELSE gosie_auth_rate_limits.hits + 1
       END,
       window_started_at = CASE
         WHEN gosie_auth_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
         ELSE gosie_auth_rate_limits.window_started_at
       END
     RETURNING hits`,
    [fingerprint],
  );
  return result.rows[0].hits > MAX_AUTH_ATTEMPTS;
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

async function sessionOf(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) return null;
  const result = await pool.query(
    `SELECT s.id_hash, s.user_id, s.csrf_token, s.expires_at, u.email
     FROM gosie_sessions s JOIN gosie_users u ON u.id = s.user_id
     WHERE s.id_hash = $1 AND s.expires_at > NOW()`,
    [hash(sessionId)],
  );
  if (!result.rowCount) {
    await pool.query('DELETE FROM gosie_sessions WHERE id_hash = $1 AND expires_at <= NOW()', [hash(sessionId)]);
    return null;
  }
  return { session: result.rows[0], user: { id: result.rows[0].user_id, email: result.rows[0].email } };
}

function setSessionCookie(res, sessionId) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`,
  );
}

function clearSessionCookie(res) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function hasCsrf(req, session) {
  const supplied = req.headers['x-csrf-token'];
  return typeof supplied === 'string' && safeEqual(supplied, session.csrf_token);
}

module.exports = {
  SESSION_COOKIE,
  SESSION_DAYS,
  clearSessionCookie,
  hash,
  hashPassword,
  hasCsrf,
  rateLimited,
  safeEqual,
  sessionOf,
  setSessionCookie,
  token,
};
