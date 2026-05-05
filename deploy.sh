#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# ── CONFIGURATION ─────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

# Passphrase SSH pour GitHub (laisser vide si clé sans passphrase)
# Ce fichier est dans .gitignore — ne jamais le commiter
GIT_PASSPHRASE="VOTRE_PASSPHRASE_ICI"

# Identifiant Docker Hub (ex: monusername)
DOCKER_HUB_USER="pixelsia"

# Nom de l'image Docker Hub (sans le username)
DOCKER_HUB_REPO="nexusvault"

# ══════════════════════════════════════════════════════════════════════════════
# ── VALIDATION ────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

# Usage: ./deploy.sh "Description" [main|dev] [--docker]
# Exemples :
#   ./deploy.sh "Fix login"               → push sur dev (défaut)
#   ./deploy.sh "Release v1.0" main       → push sur main
#   ./deploy.sh "Release v1.0" main --docker  → push sur main + build Docker Hub
#   ./deploy.sh "Fix bug" dev --docker    → push sur dev + build Docker Hub

if [ -z "$1" ]; then
    echo ""
    echo "Usage:  ./deploy.sh \"Description\" [main|dev] [--docker]"
    echo ""
    echo "  Branche :  dev   (défaut) — branche de développement"
    echo "             main           — branche de production"
    echo ""
    echo "  --docker : builder et pusher les images sur Docker Hub"
    echo ""
    echo "Exemples :"
    echo "  ./deploy.sh \"Ajout option pays\"           # push git → dev"
    echo "  ./deploy.sh \"Release 1.2\" main            # push git → main"
    echo "  ./deploy.sh \"Release 1.2\" main --docker   # git + Docker Hub"
    exit 1
fi

DESCRIPTION="$1"
BRANCH="${2:-dev}"
PUSH_DOCKER=false

# Accepter --docker en 2e ou 3e argument
for arg in "$@"; do
    [ "$arg" = "--docker" ] && PUSH_DOCKER=true
done

if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "dev" ]; then
    echo "Erreur : branche invalide '$BRANCH'. Utilisez 'main' ou 'dev'."
    exit 1
fi

if [ "$PUSH_DOCKER" = true ] && [ "$DOCKER_HUB_USER" = "VOTRE_DOCKERHUB_USER" ]; then
    echo "Erreur : configurez DOCKER_HUB_USER dans ce fichier avant d'utiliser --docker."
    exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# ── SSH AGENT ─────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

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

# ══════════════════════════════════════════════════════════════════════════════
# ── VERSION ───────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

VERSION=$(python3 -c "
import json
with open('.build_meta') as f:
    m = json.load(f)
print('v{}-b{}.{}'.format(m['date'], m['build'], m['requests']))
")

# Mettre à jour version.js (source unique de vérité pour le frontend)
echo "export const APP_VERSION = '${VERSION}';" > frontend/src/version.js
echo "  version.js: ${VERSION}"

MSG="${VERSION} - ${DESCRIPTION}"

# ══════════════════════════════════════════════════════════════════════════════
# ── GIT PUSH ──────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo "── Git push → origin/${BRANCH} ─────────────────────────────────────────"
git add -A
git restore --staged deploy.sh 2>/dev/null || git reset HEAD deploy.sh 2>/dev/null || true
git commit -m "${MSG}" || echo "  (rien à commiter)"
git push origin "${BRANCH}"
echo "  ✓ Poussé vers ${BRANCH} : ${MSG}"

# ══════════════════════════════════════════════════════════════════════════════
# ── DOCKER HUB ────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

if [ "$PUSH_DOCKER" = true ]; then
    IMAGE_BASE="${DOCKER_HUB_USER}/${DOCKER_HUB_REPO}"
    BUILD_TAG="${VERSION}"

    echo ""
    echo "── Docker Hub : ${IMAGE_BASE} ───────────────────────────────────────"
    echo "  Build en cours..."

    # Build backend
    echo "  [1/2] Backend..."
    docker build \
        -t "${IMAGE_BASE}-backend:latest" \
        -t "${IMAGE_BASE}-backend:${BUILD_TAG}" \
        ./backend

    # Build frontend
    echo "  [2/2] Frontend..."
    docker build \
        --build-arg CACHEBUST="$(date +%s)" \
        -t "${IMAGE_BASE}-frontend:latest" \
        -t "${IMAGE_BASE}-frontend:${BUILD_TAG}" \
        ./frontend

    # Push
    echo "  Push backend..."
    docker push "${IMAGE_BASE}-backend:latest"
    docker push "${IMAGE_BASE}-backend:${BUILD_TAG}"

    echo "  Push frontend..."
    docker push "${IMAGE_BASE}-frontend:latest"
    docker push "${IMAGE_BASE}-frontend:${BUILD_TAG}"

    echo "  ✓ Images publiées sur Docker Hub :"
    echo "    ${IMAGE_BASE}-backend:latest"
    echo "    ${IMAGE_BASE}-backend:${BUILD_TAG}"
    echo "    ${IMAGE_BASE}-frontend:latest"
    echo "    ${IMAGE_BASE}-frontend:${BUILD_TAG}"
fi

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "✓ Déploiement terminé — ${MSG}"
[ "$PUSH_DOCKER" = true ] && echo "  Docker Hub : ${DOCKER_HUB_USER}/${DOCKER_HUB_REPO}"
echo ""
