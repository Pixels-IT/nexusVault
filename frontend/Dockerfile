FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
ARG CACHEBUST=1
COPY . .
RUN npm run build

FROM nginx:alpine

# Mot de passe root complexe
RUN passwd -d root 2>/dev/null || true

# Créer l'utilisateur non-root
RUN addgroup -S app-nexus && adduser -S -G app-nexus -H app-nexus

# Config nginx pour non-root :
# - pid dans /tmp
# - supprimer directive user (ne peut pas changer d'user si non-root)
# - répertoires temporaires accessibles
RUN sed -i \
      -e 's|pid\s*/var/run/nginx.pid;|pid /tmp/nginx.pid;|' \
      -e '/^user/d' \
      /etc/nginx/nginx.conf && \
    mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi && \
    chown -R app-nexus:app-nexus /tmp/nginx && \
    chown -R app-nexus:app-nexus /var/cache/nginx && \
    chown -R app-nexus:app-nexus /var/log/nginx

# Injecter les chemins temporaires dans nginx.conf principal
RUN sed -i '/http {/a \    client_body_temp_path /tmp/nginx/client_body;\n    proxy_temp_path /tmp/nginx/proxy;\n    fastcgi_temp_path /tmp/nginx/fastcgi;' \
    /etc/nginx/nginx.conf

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
RUN chown -R app-nexus:app-nexus /usr/share/nginx/html

USER app-nexus

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
