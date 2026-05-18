![Logo](screenshots/logo-login.png)

# nexusVault — New EXperience for USer Vault — Environnement de Coffre-Fort IT

Interface de coffre-fort des éléments critiques IT : configuration des équipements réseaux, suivi d'activité, automatisation et gestion documentaire sécurisée.

---

> 🇬🇧 [English version here](readme-uk.md)

## Pourquoi nexusVault ?

Certains documents, fichiers de backups des équipements voire le suivi d'activités IT sont des éléments critiques qui ne doivent pas être stockés sur un simple serveur de fichiers ou un NAS.
En cas de compromission, les attaquants ont tout sous la main !

---

## Fonctionnalités principales

### Backups de configuration
- **Sauvegarde de la configuration des équipements réseaux : Switch, NAS, Pare-Feu, Autres**
- **Import manuel** (coller le contenu) et **automatique via SSH** (commandes personnalisables par modèle)
- **Planificateur de sauvegardes automatiques** : fréquence horaire/quotidienne/hebdomadaire/mensuelle, heure et équipements configurables par planification
- **Déduplication intelligente** : si la configuration n'a pas changé, aucune nouvelle version n'est créée. Les lignes dynamiques sont ignorées (timestamps, uptime, last login, NTP, etc.)
- **Comparaison visuelle** entre deux versions (ajouts en vert, suppressions en rouge)
- **Hiérarchie sites parents/enfants** : un site peut contenir des sous-sites, affichage arborescent sur la page Backup
- **Groupement optionnel** des sites par pays (option activable dans Appareils → Options)
- **Export CSV.gz** des backups

### Automatisation
- **Catégories hiérarchiques** avec niveaux imbriqués, types : Générique, Temporaire, Procédure, Script, Sécurisé
- **Catégories colorées** avec date de validité (type Temporaire) et alertes d'expiration
- **Documents** : création, édition, historique complet des modifications
- **Fichiers joints** par document : upload multiple, téléchargement, suppression, **remplacement** d'un fichier (historisé en audit)
- **Aperçu intégré** : PDF natif (iframe), Word/ODT (LibreOffice → PDF), scripts (coloration syntaxique via highlight.js — yaml, json, python, bash, sql…)
- **Documents sécurisés** : protection par mot de passe global ou par document
- **Documents temporaires** : date de validité avec alertes d'expiration sur le tableau de bord
- **Copie en un clic** du contenu des scripts dans le presse-papier avec audit
- **Audit complet** de chaque accès, modification, visualisation, copie, remplacement et tentative échouée

### Suivi d'activités
- **Suivi d'activité par utilisateurs des équipes IT par TAG avec filtrage**
- **TAGs personnalisés avec couleurs : SECU, ADM, NET, BACKUP, INCIDENT…**
- **Fichiers joints par note** : upload, verrouillage, suppression, téléchargement
- **Balise `[secret]...[/secret]`** pour masquer les données sensibles — affichage en `●●●●●` sur la liste, visible uniquement en édition
- **Date d'affichage cosmétique** (Admin → Suivi → Options)
- **Import CSV** de notes historiques (format `ANNEE;MOIS;JOUR;TAG;NOTE`)
- **Export PDF** avec logo personnalisable — 4 modes : par mois, par année, toutes périodes, par TAG
- **Protection des notes** : suppression d'un TAG bloquée s'il est utilisé dans des notes

### Notifications
- **SMTP, Telegram et Slack** configurables depuis l'interface Admin (Sécurité → Notifications)
- **Validation par code à 6 chiffres** : après configuration, un code est envoyé via le canal pour confirmer son bon fonctionnement avant activation
- **Événements notifiables** :
  - Tentatives de connexion échouées (seuil configurable)
  - Compte verrouillé par brute-force
  - Téléchargement de configuration
  - Résultat des sauvegardes automatiques (rapport succès/échec par équipement)
  - Expiration de documents temporaires
  - Suppression d'un document / fichier de document / suivi / fichier de suivi / sauvegarde
  - Récapitulatif des notes en preview (00h05, fréquence quotidienne/hebdo/mensuelle)
  - Récapitulatif des fichiers en rétention (00h05, fréquence quotidienne/hebdo/mensuelle)
- **Journal des notifications** : historique des envois avec statut succès/erreur

### Rétention des éléments supprimés
- **Corbeille configurable** pour les backups, documents, fichiers de documents et suivis d'activité
- **Durée de rétention indépendante** par type : 0 (aucune), 7, 15, 30 ou 60 jours
- **Restauration complète** : un document restauré récupère aussi ses fichiers joints ; un suivi restaure aussi ses fichiers liés
- **Modal de gestion** avec 3 onglets (Backup / Automatisation / Suivi), colonnes supprimé par / supprimé le / expire le (orange si < 3 jours)
- **Suppression définitive** depuis la corbeille avec confirmation
- **Droit d'accès dédié** `retention_access` configurable par utilisateur
- **Audit complet** : consultation, restauration et suppression définitive journalisées

### Tableau de bord
- **Section Backups** : total backups, équipements, sites, modèles
- **Section Automatisation** : total documents, 3 derniers ajoutés, top 3 catégories avec code couleur, prochaines expirations
- **Section Suivi** : notes totales, activité du mois courant, top 3 tags par année (N et N-1)

### Journal d'audit
- **Audit complet** : Connexion OK/NOK, Ajout/Suppression/Consultation/Modification
- **Détection et journalisation du brute-force**
- **Archivage automatique mensuel** (cron configurable)
- **Consultation des archives** par année/mois, téléchargement CSV.gz
- **Traduction des actions** selon la langue de l'interface

### Sécurité
- **Gestion des droits d'accès par rôle** (Admin, Opérateur, Lecteur) avec permissions fines par utilisateur
- **Liste blanche IP / CIDR** : restreindre l'accès à des IP ou plages réseau spécifiques (`192.168.1.0/24`). Sans règle, l'accès est ouvert à tous
- **Protection brute-force configurable** : nombre de tentatives et durée de verrouillage
- **Timeout de session configurable** avec décompte visuel et audit automatique
- **Authentification TOTP** (Google Authenticator, Authy…) obligatoire ou optionnelle
- **Déverrouillage manuel des comptes** depuis l'interface Admin
- **Authentification OIDC / SSO** configurable depuis l'interface Admin
- **Changement de mot de passe obligatoire** à la première connexion (minimum 14 caractères)
- **Onglet Système** : surveillance en temps réel — uptime, mémoire Node.js, taille DB SQLite table par table, activité 24h, état du planificateur, statut whitelist
- **Mode sombre / clair**
- **Multilangues i18n (11 langues)** : `fr`, `en`, `de`, `es`, `it`, `ja`, `nl`, `pl`, `pt`, `ru`, `zh`
- **Chiffrement AES-256** de toutes les données sensibles en base SQLite

### Administration
- **Gestion des utilisateurs** avec verrouillage/déverrouillage, reset TOTP, permissions individuelles
- **URL de l'application configurable**
- **Planificateur d'archivage** (1er du mois, heure configurable)
- **Logo PDF personnalisable** (hauteur max 120px)
- **Administration de l'automatisation** : catégories, types, couleurs, mot de passe global documents sécurisés

---

## Fonctionnalités à venir

- **RGPD : Anonymisation de certains éléments**
- **Personnalisation du tableau de bord** : éléments affichés, couleurs, TOP3, etc.
- **Suivi d'activité commun multi-utilisateurs** avec TAG d'identification

---

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

Accès : **http://localhost:8080** (ou le port configuré dans `APP_PORT`)

Identifiants par défaut :
- Login : `admin`
- Mot de passe : `changeme`

> Le changement de mot de passe est **obligatoire** à la première connexion (minimum 14 caractères). Un modal dédié s'affiche directement sur la page de login.

### 4. Arrêt et données

```bash
# Arrêter
docker compose down

# Arrêter ET supprimer les données (⚠️ irréversible)
docker compose down -v
```

---

## Architecture

```
nexusvault/
├── docker-compose.yml          # TZ, APP_PORT, ENCRYPTION_KEY, JWT_SECRET, LOG_LEVEL
├── docker-compose.git.yml      # Build depuis les sources (dev/CI)
├── .env.example                # Template de configuration
├── .gitignore
├── README.md                   # Documentation française (ce fichier)
├── readme-uk.md                # Documentation anglaise
├── deploy.sh                   # Script de déploiement Git + Docker Hub
├── backend/
│   ├── server.js               # API REST Express — toutes les routes
│   ├── db.js                   # Init SQLite + chiffrement AES-256 + migrations
│   ├── auth.js                 # Middleware JWT, requirePerm, brute-force, whitelist CIDR
│   ├── notifications.js        # SMTP / Telegram / Slack — EVENT_CATALOG, dispatch
│   ├── entrypoint.sh           # Chown /data puis su-exec app-nexus
│   ├── package.json
│   └── Dockerfile              # Node 22 Alpine, user app-nexus non-root
└── frontend/
    ├── nginx.conf              # listen 8080, proxy /api/ → backend:3001
    ├── Dockerfile              # nginx:alpine non-root, curl healthcheck
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Routing, SessionWarning (décompte + audit)
        ├── api.js              # Toutes les méthodes API (fetch)
        ├── index.css           # Variables CSS, thèmes clair/sombre
        ├── contexts/
        │   ├── AuthContext.jsx  # JWT, logout(source) avec audit
        │   ├── ThemeContext.jsx
        │   └── I18nContext.jsx  # Provider i18n, sélecteur de langue
        ├── hooks/
        │   ├── useSessionTimeout.js
        │   └── usePerms.js
        ├── components/
        │   ├── Navbar.jsx
        │   ├── LangSwitcher.jsx # Sélecteur de langue (11 langues)
        │   └── UI.jsx
        ├── i18n/
        │   ├── index.js         # Moteur i18n, import statique EN, fallback
        │   └── locales/         # fr, en, de, es, it, ja, nl, pl, pt, ru, zh
        └── pages/
            ├── Login.jsx        # Connexion, reset MDP, modal changement obligatoire
            ├── Dashboard.jsx    # Tableau de bord (3 sections)
            ├── Backups.jsx      # Backups réseau, arborescence sites, comparaison
            ├── Activity.jsx     # Suivi d'activité, tags, export PDF
            ├── Config.jsx       # Appareils : Pays, Sites (hiérarchie), Modèles, Équipements
            ├── Scripts.jsx      # Automatisation : catégories, documents, fichiers
            └── Admin.jsx        # Administration complète
```

**2 conteneurs Docker :**

| Conteneur | Rôle | Port exposé | Utilisateur |
|---|---|---|---|
| `nexusvault-frontend` | React + Nginx (reverse proxy) | `APP_PORT` → 8080 | `app-nexus` (non-root) |
| `nexusvault-backend` | Node.js API + SQLite | interne (3001) | `app-nexus` (non-root via su-exec) |

Le backend n'est **jamais exposé directement** — tout le trafic passe par Nginx.

---

## Sécurité Docker

Les deux conteneurs tournent en **utilisateur non-root** `app-nexus` :

- **Backend** : `entrypoint.sh` s'exécute en root, effectue `chown -R app-nexus /data`, puis lance `su-exec app-nexus node server.js`.
- **Frontend** : `nginx:alpine` avec `pid /tmp/nginx.pid`. Mot de passe `root` généré aléatoirement à chaque build.

---

## Chiffrement des données

NexusVault utilise un **double chiffrement** à partir d'une seule clé (`ENCRYPTION_KEY`) :

### Niveau 1 — Fichier SQLite (SQLCipher)
Le fichier `nexusvault.db` est entièrement chiffré par **SQLCipher** (AES-256 + PBKDF2-HMAC-SHA512, 256 000 itérations).

### Niveau 2 — Colonnes sensibles (AES-256-CBC)
Chaque valeur sensible est individuellement chiffrée avec un IV aléatoire avant d'être écrite en base :
- Noms d'équipements, adresses IP, identifiants et mots de passe SSH
- Contenu des fichiers de configuration backupés
- Noms de sites, contacts, notes

---

## Permissions par rôle

| Permission | Admin | Opérateur | Lecteur |
|---|:---:|:---:|:---:|
| Lecture backups | ✓ | ✓ | ✓ |
| Écriture/import backups | ✓ | ✗ | ✗ |
| Comparaison backups | ✓ | ✓ | ✗ |
| Configuration (lecture) | ✓ | ✓ | ✓ |
| Configuration (écriture) | ✓ | ✓ | ✗ |
| Journal d'audit | ✓ | ✗ | ✗ |
| Accès sécurité | ✓ | ✗ | ✗ |
| Accès à la rétention | ✓ | ✗ | ✗ |
| Suivi d'activité (écriture) | ✓ | ✓ | ✓ |
| Suivi d'activité (lecture) | ✓ | ✓ | ✗ |
| Automatisation (lecture) | ✓ | ✓ | ✓ |
| Automatisation (écriture) | ✓ | ✓ | ✗ |

> Les permissions sont entièrement configurables par utilisateur depuis Administration → Droits d'accès.

---

## Planificateur de sauvegardes SSH

### Fréquences disponibles
| Fréquence | Description |
|---|---|
| Toutes les heures | À l'heure H de chaque heure |
| Quotidienne | Une fois par jour à l'heure configurée |
| Hebdomadaire | Un jour de la semaine à une heure |
| Mensuelle | Un jour du mois à une heure |

### Déduplication intelligente
Les lignes ignorées lors de la comparaison : timestamps, dates de dernier login SSH, uptime, horodatages NTP, `! Last configuration change`, `! NVRAM config last updated`, lignes de dates ISO (YYYY-MM-DD), etc.

---

## Sauvegarde des données

```bash
# Identifier le volume
docker volume ls | grep nexusvault

# Sauvegarder
docker compose down
docker run --rm \
  -v VOLUME_NAME:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/nexusvault-backup-$(date +%Y%m%d).tar.gz -C / data
docker compose up -d
```

---

## Restauration

```bash
docker run --rm \
  -v VOLUME_NAME:/data \
  -v $(pwd):/backup \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/nexusvault-backup-YYYYMMDD.tar.gz -C /"
```

> La `ENCRYPTION_KEY` doit être **identique** à l'instance source.

---

## Réinitialisation d'un mot de passe

```bash
docker exec -it nexusvault-backend node server.js reset-password <nomducompte>
```

---

## Variable LOG_LEVEL

| Valeur | Ce qui est affiché |
|---|---|
| `debug` | Tout : ticks cron, appels API, activité détaillée |
| `info` | **(défaut)** Démarrage, comptes, emails, archivages |
| `warn` | Brute-force, SMTP absent, anomalies non critiques |
| `error` | Erreurs critiques uniquement |

---

## Internationalisation (i18n)

| Code | Langue | Statut |
|---|---|---|
| `en` | English | ✅ Complet (référence) |
| `fr` | Français | ✅ Complet |
| `de` `es` `it` `pt` `nl` `pl` `ru` `ja` `zh` | Autres | 🔧 Partiel — contributions bienvenues |

---

## Balise `[secret]`

```
MDP serveur : [secret]MonMotDePasse123![/secret]
```

Affichage : `●●●●●` (fond orange) sur la liste, texte réel visible en édition uniquement.

---

*Version courante : consultez `frontend/src/version.js` ou le pied de page de l'interface.*
