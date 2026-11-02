# Gosie

This is a port of the supplied Lovable website, not a new implementation of the Gosie product.
Preserve the imported visual design, copy, fonts, and interactive illustrative previews.
The original website explicitly says the product is in development: no public signup,
calendar connection, live recommendations, authentication, or persistent user data exists.
Do not imply that the illustrative previews are real personal data or live listings.

## Development
- PNPM workspace; web app: `artifacts/gosie`.
- Run the managed workflow `artifacts/gosie: web`. It supplies `PORT` and `BASE_PATH`.
- Tests: `pnpm --filter @workspace/gosie test`.
- Build: `PORT=23967 BASE_PATH=/ pnpm --filter @workspace/gosie build`.
- Vite React frontend, Tailwind v4, TanStack Router. The original page and mock components
  are copied from the source archive; Lovable hosting/error-reporting hooks are removed.
- The imported app had no backend, so none was added.
