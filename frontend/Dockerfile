FROM node:24-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
ARG CACHEBUST=1
COPY . .
RUN npm run build

FROM nginx:alpine

# Installer curl pour le healthcheck (wget ne supporte pas les options nécessaires dans certains contextes)
RUN apk add --no-cache curl

# Mot de passe root aléatoire
RUN passwd -d root 2>/dev/null || true

# Utilisateur non-root
RUN addgroup -S app-nexus && adduser -S -G app-nexus -H app-nexus

# Config nginx non-root : pid dans /tmp, supprimer directive user, dossiers tmp
RUN sed -i \
      -e 's|pid\s*/var/run/nginx.pid\s*;|pid /tmp/nginx.pid;|' \
      -e 's|pid\s*/run/nginx.pid\s*;|pid /tmp/nginx.pid;|' \
      -e '/^\s*user\s/d' \
      /etc/nginx/nginx.conf && \
    grep -q 'pid /tmp/nginx.pid' /etc/nginx/nginx.conf || \
      sed -i '1s|^|pid /tmp/nginx.pid;\n|' /etc/nginx/nginx.conf && \
    mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi && \
    sed -i '/http\s*{/a \    client_body_temp_path /tmp/nginx/client_body;\n    proxy_temp_path /tmp/nginx/proxy;\n    fastcgi_temp_path /tmp/nginx/fastcgi;' \
      /etc/nginx/nginx.conf

RUN chown -R app-nexus:app-nexus \
      /var/cache/nginx \
      /var/log/nginx \
      /tmp/nginx

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
RUN chown -R app-nexus:app-nexus /usr/share/nginx/html

USER app-nexus

EXPOSE 8080

# Healthcheck via curl (plus fiable que wget en contexte non-root)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f -s http://localhost:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
