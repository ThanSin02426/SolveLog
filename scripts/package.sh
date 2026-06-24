#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run validate
rm -rf dist
mkdir -p dist
zip -qr dist/solvelog-v1.3.0.zip \
  manifest.json \
  src \
  assets \
  LICENSE
printf 'Created dist/solvelog-v1.3.0.zip\n'
