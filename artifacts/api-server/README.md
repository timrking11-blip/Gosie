# Gosie API server (B1/B2 recreation)

Zero-dependency Node service (`node:sqlite`, Node >= 22.5) ported from the local Option B recreation
of the Personal Intelligence Template (`pit-b1`). Auth, profiles, feedback, import/export, and
deterministic `/week` and `/weekend` engines over **fictional demo data only**.

```
DB_PATH=./data/b1.db PORT=8791 node server.js
DB_PATH=/tmp/t.db PORT=8791 AUTH_RATE_LIMIT=1000 node server.js &  node test-b1.js
```

Env: `PORT` (validated), `DB_PATH`, `COOKIE_SECURE=1` (required behind HTTPS), `TRUST_PROXY=1` (key rate limit by `X-Forwarded-For`; only behind a trusted proxy), `AUTH_RATE_LIMIT` (auth attempts/min/IP, default 20), `ALLOWED_ORIGINS` (comma-separated extra browser origins; same-origin always allowed). Login-CSRF defence: state-changing requests with a foreign/`null` `Origin` get 403, and bodies must be `application/json` (415 otherwise).

Tests: `node --test hardening.test.js` (spawns its own server on a free port); `test-b1.js` is the B1 acceptance script (needs a running server).

Hardening: auth rate limiting, lowercase-normalized emails, constant-ish login timing for unknown users, config/title/feedback validation, per-user profile cap (50), 413 on oversize bodies, security headers, JSON request logs (no bodies), error boundary (500 instead of crash), request timeouts, session cleanup, graceful shutdown. (see `docs/roadmap.md`): login CSRF, absolute-score parity with Muse, real-host durability
(SQLite on Replit/Cloud Run is ephemeral; move to Postgres), not wired to any UI yet.

## Storage, migrations and same-origin web serving

- Storage: DATABASE_URL selects Postgres (Replit Postgres; never commit it), STORAGE=memory selects in-memory, otherwise SQLite at DB_PATH.
- Postgres migrations in migrations/*.sql run at startup under an advisory lock. Set TEST_DATABASE_URL to run the contract test against a real Postgres.
- If STATIC_DIR (default ../gosie/dist/public) contains index.html, the server serves the web app and the API moves under /api/* (/health stays available); GET /api/me returns the session and CSRF token. Set STATIC_DIR to a nonexistent path to keep the legacy unprefixed routes.

