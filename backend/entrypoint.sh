#!/bin/sh
set -e

# Ce script tourne en ROOT (pas de USER dans le Dockerfile)
# Il fixe les permissions du volume /data avant de drop vers app-nexus

# Chown /data pour que app-nexus puisse écrire la base SQLite
chown -R app-nexus:app-nexus /data

echo "[entrypoint] /data permissions set for app-nexus"
echo "[entrypoint] Starting NexusVault backend as app-nexus..."

# Drop vers app-nexus et lancer node
exec su-exec app-nexus node server.js
