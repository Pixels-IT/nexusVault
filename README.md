# VaultNexus — Backup de configurations réseau

Interface web de versionning et backup des fichiers de configuration de switchs réseau. Inspiré de Nginx Proxy Manager, basé sur le thème Tabler.

## Fonctionnalités

- **Backup & versionning** des configurations réseau (Cisco, HP Aruba, Juniper…)
- **Diff visuel** entre deux versions (ajouts en vert, suppressions en rouge)
- **Chiffrement AES-256** de toutes les données sensibles en base SQLite
- **Gestion des sites**, équipements et modèles d'équipements
- **Mode sombre / clair** avec persistance
- **Compte admin** avec changement de mot de passe obligatoire à la première connexion

## Démarrage rapide

### 1. Prérequis

- Docker ≥ 20.x
- Docker Compose ≥ 2.x

### 2. Configuration

```bash
# Cloner ou copier le projet
git clone <repo> vaultnexus && cd vaultnexus

# Créer le fichier de configuration
cp .env.example .env
```

Éditez `.env` et renseignez **obligatoirement** :

| Variable | Description |
|---|---|
| `APP_PORT` | Port d'accès web (défaut : `8080`) |
| `ENCRYPTION_KEY` | Clé AES-256 pour le chiffrement des données |
| `JWT_SECRET` | Secret de signature des tokens JWT |

Générer des clés sécurisées :
```bash
openssl rand -hex 32   # pour ENCRYPTION_KEY
openssl rand -hex 32   # pour JWT_SECRET
```

> ⚠️ **Ne modifiez jamais `ENCRYPTION_KEY` après le premier démarrage** — les données déjà chiffrées deviendraient illisibles.

### 3. Lancement

```bash
docker compose up -d --build
```

Accès : **http://localhost:8080** (ou le port configuré)

Identifiants par défaut :
- Login : `admin`
- Mot de passe : `changeme`

> Le changement de mot de passe est **obligatoire** à la première connexion (minimum 14 caractères).

### 4. Arrêt et données

```bash
# Arrêter
docker compose down

# Arrêter ET supprimer les données (⚠️ irréversible)
docker compose down -v
```

## Architecture

```
vaultnexus/
├── docker-compose.yml
├── .env.example
├── backend/                  # Node.js + Express + SQLite
│   ├── server.js             # API REST
│   ├── db.js                 # Base SQLite + chiffrement AES-256
│   ├── auth.js               # Middleware JWT
│   └── Dockerfile
└── frontend/                 # React 18 + Nginx
    ├── src/
    │   ├── pages/            # Dashboard, Backups, Config, Login
    │   ├── components/       # Navbar, UI components
    │   ├── contexts/         # Auth, Theme
    │   └── api.js            # Client HTTP
    ├── nginx.conf            # Proxy /api/ → backend
    └── Dockerfile
```

**2 conteneurs Docker :**
| Conteneur | Rôle | Port exposé |
|---|---|---|
| `vaultnexus-frontend` | React + Nginx (reverse proxy) | `APP_PORT` → 80 |
| `vaultnexus-backend` | Node.js API + SQLite | interne (3001) |

Le backend n'est **jamais exposé directement** — tout le trafic passe par Nginx.

## Chiffrement des données

VaultNexus utilise un **double chiffrement** à partir d'une seule clé (`ENCRYPTION_KEY`) :

### Niveau 1 — Fichier SQLite (SQLCipher)
Le fichier `vaultnexus.db` est entièrement chiffré par **SQLCipher** (AES-256 + PBKDF2-HMAC-SHA512, 256 000 itérations). Ouvert avec un éditeur hex ou SQLite Browser sans la clé, le fichier est illisible — il n'affiche que des octets aléatoires.

### Niveau 2 — Colonnes sensibles (AES-256-CBC)
En plus du chiffrement du fichier, chaque valeur sensible est individuellement chiffrée avant d'être écrite :
- Noms d'équipements, adresses IP, identifiants et mots de passe SSH
- Contenu des fichiers de configuration backupés
- Noms de sites, contacts

Ainsi, même si quelqu'un obtenait la clé SQLCipher, les données de configuration resteraient chiffrées en AES-256 avec un IV aléatoire par valeur.

## Modifier le port

Éditez `.env` :
```env
APP_PORT=9090
```
Puis relancez :
```bash
docker compose up -d
```

## Sauvegarde des données

Les données SQLite sont stockées dans le volume Docker `vaultnexus-data`. Pour sauvegarder :

```bash
docker run --rm -v vaultnexus_vaultnexus-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/vaultnexus-backup-$(date +%Y%m%d).tar.gz /data
```
