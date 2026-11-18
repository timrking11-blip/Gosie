#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

service_manifest="artifacts/gosie/.replit-artifact/artifact.toml"
PORT="${PORT:-$(awk -F '"' '/^PORT =/ { print $2; exit }' "$service_manifest")}"
BASE_PATH="${BASE_PATH:-$(awk -F '"' '/^BASE_PATH =/ { print $2; exit }' "$service_manifest")}"
export PORT BASE_PATH

echo "Installing workspace dependencies from the committed lockfile..."
pnpm install --frozen-lockfile

echo "Applying the development-only Gosie schema..."
GOSIE_DB_ENV=development node artifacts/api-server/apply-schema.js

echo "Building the Gosie web artifact..."
pnpm --filter @workspace/gosie run build

echo "Building the Week Ahead artifact..."
week_manifest="artifacts/gosie-week-ahead/.replit-artifact/artifact.toml"
PORT="$(awk -F '"' '/^PORT =/ { print $2; exit }' "$week_manifest")" \
BASE_PATH="$(awk -F '"' '/^BASE_PATH =/ { print $2; exit }' "$week_manifest")" \
  pnpm --filter @workspace/gosie-week-ahead run build
