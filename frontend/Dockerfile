FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
ARG CACHEBUST=1
COPY . .
RUN npm run build

# nginx:unprivileged = image nginx officielle conçue pour tourner sans root
# écoute sur 8080 par défaut, pas besoin de chown ni de USER
FROM nginxinc/nginx-unprivileged:alpine

# Mot de passe root complexe (best practice)
USER root
RUN echo "root:$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9!@#$%^&*' | head -c 32)" | chpasswd 2>/dev/null || true

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

# Revenir à l'user non-root de l'image (101 = nginx dans unprivileged)
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
