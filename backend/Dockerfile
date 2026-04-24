FROM node:22-alpine


# Outils de compilation pour better-sqlite3 (binaire natif) + wget pour healthcheck
RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

COPY package.json .

RUN npm install --production && \
    npm rebuild better-sqlite3

COPY . .

RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "server.js"]

# ssh2 ne nécessite pas de compilation native, mais on s'assure que node_modules est propre
