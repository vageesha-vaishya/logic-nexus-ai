#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json ]]; then
  echo "package.json missing"
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid semantic version in package.json: $VERSION"
  exit 1
fi

echo "Semantic version format valid: $VERSION"
