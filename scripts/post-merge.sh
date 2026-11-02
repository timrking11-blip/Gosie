#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

service_manifest="artifacts/gosie/.replit-artifact/artifact.toml"
PORT="${PORT:-$(awk -F '"' '/^PORT =/ { print $2; exit }' "$service_manifest")}"
BASE_PATH="${BASE_PATH:-$(awk -F '"' '/^BASE_PATH =/ { print $2; exit }' "$service_manifest")}"
export PORT BASE_PATH

echo "Installing workspace dependencies from the committed lockfile..."
pnpm install --frozen-lockfile

echo "Building the Gosie web artifact..."
pnpm --filter @workspace/gosie run build
