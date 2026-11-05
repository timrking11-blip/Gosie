# Gosie API server (B1/B2 recreation)

Zero-dependency Node service (`node:sqlite`, Node >= 22.5) ported from the local Option B recreation
of the Personal Intelligence Template (`pit-b1`). Auth, profiles, feedback, import/export, and
deterministic `/week` and `/weekend` engines over **fictional demo data only**.

```
DB_PATH=./data/b1.db PORT=8791 node server.js
DB_PATH=/tmp/t.db PORT=8791 AUTH_RATE_LIMIT=1000 node server.js &  node test-b1.js
```

Env: `PORT`, `DB_PATH`, `COOKIE_SECURE=1` (required behind HTTPS), `AUTH_RATE_LIMIT` (auth attempts/min/IP, default 20).

Hardening added in this port: auth rate limiting, secure-cookie option, 8-char minimum password,
feedback validation, 413 on oversize bodies, graceful shutdown.
Still open (see `docs/roadmap.md`): login CSRF, absolute-score parity with Muse, real-host durability
(SQLite on Replit/Cloud Run is ephemeral; move to Postgres), not wired to any UI yet.
