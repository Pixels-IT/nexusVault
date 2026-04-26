FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
ARG CACHEBUST=1
COPY . .
RUN npm run build

FROM nginx:alpine

# Créer un utilisateur non-root et définir un mot de passe root complexe
RUN addgroup -S app-nexus && adduser -S -G app-nexus app-nexus && \
    echo "root:$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9!@#$%^&*' | head -c 32)" | chpasswd 2>/dev/null || true

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

# Configurer nginx pour fonctionner sans root (pid dans /tmp)
RUN sed -i 's|pid.*nginx.pid.*|pid /tmp/nginx.pid;|g' /etc/nginx/nginx.conf || \
    echo "pid /tmp/nginx.pid;" >> /etc/nginx/nginx.conf
RUN sed -i '/^user /d' /etc/nginx/nginx.conf

# Nginx besoin d'écrire dans ces dossiers — donner les droits à app-nexus
RUN chown -R app-nexus:app-nexus /usr/share/nginx/html && \
    chown -R app-nexus:app-nexus /var/cache/nginx && \
    chown -R app-nexus:app-nexus /var/log/nginx && \
    touch /tmp/nginx.pid && \
    chown app-nexus:app-nexus /tmp/nginx.pid

USER app-nexus

EXPOSE 8080

# Healthcheck : vérifie que nginx sert bien le fichier index
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/ | grep -q "nexusvault" || exit 1

CMD ["nginx", "-g", "daemon off;"]
