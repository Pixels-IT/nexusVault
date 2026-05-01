FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
ARG CACHEBUST=1
COPY . .
RUN npm run build

FROM nginx:alpine

# Mot de passe root aléatoire
RUN passwd -d root 2>/dev/null || true

# Utilisateur non-root
RUN addgroup -S app-nexus && adduser -S -G app-nexus -H app-nexus

# 1. PID dans /tmp au lieu de /run (accessible sans root)
# 2. Supprimer la directive "user nginx" (inutile en non-root)
# 3. Répertoires temporaires dans /tmp
RUN sed -i \
      -e 's|pid\s*/var/run/nginx.pid\s*;|pid /tmp/nginx.pid;|' \
      -e 's|pid\s*/run/nginx.pid\s*;|pid /tmp/nginx.pid;|' \
      -e '/^\s*user\s/d' \
      /etc/nginx/nginx.conf && \
    grep -q 'pid /tmp/nginx.pid' /etc/nginx/nginx.conf || \
      sed -i '1s|^|pid /tmp/nginx.pid;\n|' /etc/nginx/nginx.conf && \
    mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi \
             /tmp/nginx/uwsgi /tmp/nginx/scgi && \
    sed -i '/http\s*{/a \    client_body_temp_path /tmp/nginx/client_body;\n    proxy_temp_path /tmp/nginx/proxy;\n    fastcgi_temp_path /tmp/nginx/fastcgi;' \
      /etc/nginx/nginx.conf

# Droits sur les dossiers nécessaires
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
