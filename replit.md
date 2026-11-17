# Gosie

The promotional homepage is a port of the supplied Lovable website.
Preserve its imported visual design, fonts, and illustrative previews.
The separate `/login` and `/app` routes implement a private, web-first planning
pilot backed by `artifacts/api-server` and Replit Postgres. Registration remains
closed by default. This is not the private Muse application or a parity claim.
Do not imply that fictional recommendations or sample plans are live listings.
Calendar access, connectors, invitations, and publishing remain separate approvals.
Read `docs/planning-pilot-status.md` and the API README before pilot changes.

## Development
- PNPM workspace; web app: `artifacts/gosie`.
- Run the managed workflow `artifacts/gosie: web`. It supplies `PORT` and `BASE_PATH`.
- Tests: `pnpm --filter @workspace/gosie test`.
- Build: `PORT=23967 BASE_PATH=/ pnpm --filter @workspace/gosie build`.
- Vite React frontend, Tailwind v4, TanStack Router. The original page and mock components
  are copied from the source archive; Lovable hosting/error-reporting hooks are removed.
- API tests: `GOSIE_DB_ENV=test pnpm --filter @workspace/api-server test`.
- Explicit development schema: `GOSIE_DB_ENV=development node artifacts/api-server/apply-schema.js`.
  Never run schema DDL during application startup or production builds.
- `production-server.js` serves the built website and `/api` on one origin.
- A process-restart test is not redeploy/recovery evidence or pilot readiness.
