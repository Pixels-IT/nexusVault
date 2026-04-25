# nexusVault — New EXperience for USer Vault — Environnement de Coffre-Fort ITNexusVault

Interface de versionning des configurations des équipements réseaux et de suivi d'activité IT

## Pourquoi nexusVault ?

Certains documents, fichier de backups des équipements voire le suivi d'activités IT sont des éléments critiques qui ne doivent pas être stockée sur un simple serveur de fichiers ou un NAS.
En cas de compromission, les attaquants ont tout sous la main ! 

## Fonctionnalités

- **Backup & versionning** des configurations réseau (Switch, Pare-Feu, NAS, etc…) avec filtrage
- **Importation de backup manuel et automatique
- **Diff visuel** entre deux versions (ajouts en vert, suppressions en rouge)
- **Gestion des sites**, équipements et modèles d'équipements
- **Suivi d'activité des équipes IT par TAG avec filtrage
- **Chiffrement AES-256** de toutes les données sensibles en base SQLite
- **Gestion des droits d'accès par rôle
- **Audit complet des activités : Connexion OK/NOK, Ajout/Suppresion/Consultation/Modification
- **Mode sombre / clair** avec persistance

## Démarrage rapide

### 1. Prérequis

- Docker ≥ 20.x
- Docker Compose ≥ 2.x

### 2. Configuration

```bash
# Cloner ou copier le projet
git clone <repo> nexusvault && cd nexusvault

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
nexusvault/
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
| `nexusvault-frontend` | React + Nginx (reverse proxy) | `APP_PORT` → 80 |
| `nexusvault-backend` | Node.js API + SQLite | interne (3001) |

Le backend n'est **jamais exposé directement** — tout le trafic passe par Nginx.

## Chiffrement des données

NexusVault utilise un **double chiffrement** à partir d'une seule clé (`ENCRYPTION_KEY`) :

### Niveau 1 — Fichier SQLite (SQLCipher)
Le fichier `nexusvault.db` est entièrement chiffré par **SQLCipher** (AES-256 + PBKDF2-HMAC-SHA512, 256 000 itérations). Ouvert avec un éditeur hex ou SQLite Browser sans la clé, le fichier est illisible — il n'affiche que des octets aléatoires.

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

Les données SQLite sont stockées dans le volume Docker `nexusvault-data`. Pour sauvegarder :

```bash
docker run --rm -v nexusvault-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/nexusvault-backup-$(date +%Y%m%d).tar.gz /data
```

## Réinitialisation d'un mot de passe

En cas de perte d'accès, réinitialisez le mot de passe d'un compte depuis l'hôte Docker :

```bash
docker exec -it nexusvault-backend node server.js reset-password <nomducompte>
```

**Exemple :**
```bash
docker exec -it nexusvault-backend node server.js reset-password admin
```

Le mot de passe est réinitialisé à `changeme` et un changement obligatoire est imposé à la prochaine connexion. Le compte est aussi déverrouillé si nécessaire.

