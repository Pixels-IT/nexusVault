#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Configuration ─────────────────────────────────────────────────────────────
GIT_PASSPHRASE="PixelestmonChien2024"

cp /root/logo-login.png /root/nexusVault/frontend/public/logo-login.png

# ── Déverrouiller la clé SSH ──────────────────────────────────────────────────
if [ -n "$GIT_PASSPHRASE" ] && [ "$GIT_PASSPHRASE" != "VOTRE_PASSPHRASE_ICI" ]; then
    if [ -z "$SSH_AUTH_SOCK" ]; then
        eval "$(ssh-agent -s)" > /dev/null 2>&1
    fi
    TMP_ASKPASS=$(mktemp)
    chmod 700 "$TMP_ASKPASS"
    printf '#!/bin/sh\necho "%s"\n' "$GIT_PASSPHRASE" > "$TMP_ASKPASS"
    DISPLAY=:0 SSH_ASKPASS="$TMP_ASKPASS" SSH_ASKPASS_REQUIRE=force \
        ssh-add ~/.ssh/id_ed25519 2>/dev/null || true
    rm -f "$TMP_ASKPASS"
fi

# ── Lire la version ───────────────────────────────────────────────────────────
VERSION=$(python3 -c "
import json
with open('.build_meta') as f:
    m = json.load(f)
print('v{}-b{}.{}'.format(m['date'], m['build'], m['requests']))
")

# ── Message de commit ─────────────────────────────────────────────────────────
# Usage: ./deploy-dev.sh "Feature 1 - Feature 2 - Bugfix 3"
if [ -z "$1" ]; then
    echo "Usage: ./deploy-dev.sh \"Description 1 - Description 2\""
    echo "Exemple: ./deploy-dev.sh \"Bugfix login - Brute-force config\""
    exit 1
fi
MSG="${VERSION} - ${1}"

# ── Git push (deploy-dev.sh exclu du commit) ──────────────────────────────────
git add -A
git restore --staged deploy-main.sh 2>/dev/null || git reset HEAD deploy-main.sh 2>/dev/null || true
git commit -m "${MSG}"
git push origin main

echo ""
echo "Poussé vers main : ${MSG}"
