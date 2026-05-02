FROM node:22-alpine

# Outils de compilation + su-exec pour drop privileges + wget pour healthcheck
RUN apk add --no-cache python3 make g++ wget su-exec

# Créer utilisateur non-root avec mot de passe root complexe
RUN addgroup -S app-nexus && adduser -S -G app-nexus app-nexus && \
    echo "root:$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9!@#$%^&*' | head -c 32)" | chpasswd 2>/dev/null || true

WORKDIR /app

COPY package.json .

RUN npm install --production && \
    npm rebuild better-sqlite3

COPY . .

# Rendre l'entrypoint exécutable (doit être fait en root)
RUN chmod +x /app/entrypoint.sh

# Dossier de données — créé ici, chown fait à l'entrypoint après montage du volume
RUN mkdir -p /data && chown -R app-nexus:app-nexus /app

EXPOSE 3001

# Healthcheck (lancé par le démon Docker, pas par le processus)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Entrypoint : tourne en root → chown /data → su-exec app-nexus node server.js
ENTRYPOINT ["/app/entrypoint.sh"]
