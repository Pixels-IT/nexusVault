#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Lire la version depuis .build_meta
VERSION=$(python3 -c "
import json
with open('.build_meta') as f:
    m = json.load(f)
print('v{}-b{}.{}'.format(m['date'], m['build'], m['requests']))
")

# Message de commit : version + description passée en argument
# Usage: ./deploy-dev.sh "Menu Admin — Frontend unhealthy"
# Sans argument : juste la version
if [ -n "$1" ]; then
    MSG="${VERSION} - ${1}"
else
    MSG="${VERSION}"
fi

git add -A
git commit -m "${MSG}"
git push origin dev

echo "Poussé vers dev ✓ (${MSG})"
