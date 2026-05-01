#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Lire la version depuis .build_meta
VERSION=$(python3 -c "
import sys, json
with open('.build_meta') as f:
    m = json.load(f)
print('b{}.{} — {}'.format(m['build'], m['requests'], m['date']))
")

git add -A
git commit -m "build ${VERSION}"
git push origin dev

echo "Pushé vers dev ✓ (${VERSION})"
