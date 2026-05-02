# nexusVault — New EXperience for USer Vault — Environnement de Coffre-Fort IT

Interface de coffre-fort des éléments critiques IT : configuration des équipements réseaux, suivi d'activité, scripts & automatisation.

---

## Pourquoi nexusVault ?

Certains documents, fichiers de backups des équipements voire le suivi d'activités IT sont des éléments critiques qui ne doivent pas être stockés sur un simple serveur de fichiers ou un NAS.
En cas de compromission, les attaquants ont tout sous la main !

---

## Fonctionnalités principales

### Backups
- **Sauvegarde de la configuration des équipements réseaux : Switch, NAS, Pare-Feu, Autres**
- **Importation de backup manuel et automatique**
- **Comparaison visuelle entre deux versions (ajouts en vert, suppressions en rouge)**
- **Gestion des pays, sites, équipements et modèles d'équipements**
- **Regroupement optionnel des sites par pays (option activable dans Appareils → Options)**
- **Export CSV.gz des backups**

### Suivi d'activités
- **Suivi d'activité par utilisateurs des équipes IT par TAG avec filtrage**
- **Création de TAG personnalisés avec couleurs : SECU, ADM, NETWORK, etc.**
- **Export PDF du suivi d'activité avec filtrage**

### Journal d'audit
- **Audit complet : Connexion OK/NOK, Ajout/Suppression/Consultation/Modification**
- **Détection et journalisation du brute-force**
- **Archivage automatique mensuel (cron configurable : heure d'exécution)**
- **Consultation des archives par année/mois, téléchargement CSV.gz**
- **Actions auditées : CONNEXION_RÉUSSIE/ÉCHEC/BLOQUÉE, DÉCONNEXION/TIMEOUT, BACKUP_*, AUDIT_ARCHIVÉ, BRUTE_CONFIG_MODIFIÉ, PAYS_AJOUTÉ/SUPPRIMÉ, DROITS_MODIFIÉS, etc.**

### Sécurité
- **Gestion des droits d'accès par rôle (Admin, Opérateur, Lecteur)**
- **Protection brute-force configurable : nombre de tentatives et durée de verrouillage**
- **Timeout de session configurable avec décompte visuel et audit automatique**
- **Déverrouillage manuel des comptes depuis l'interface Admin**
- **Mode sombre / clair**
- **Multilangues basé sur i18n (11 langues : fr, en, de, es, it, ja, nl, pl, pt, ru, zh)**
- **Connexion LDAP/LDAPS, OIDC *(non testé à ce jour)***
- **Notifications par SMTP, Telegram et Slack *(non testé à ce jour)***
- **Chiffrement AES-256** de toutes les données sensibles en base SQLite

### Administration
- **Gestion des utilisateurs avec verrouillage/déverrouillage, validation email**
- **URL de l'application configurable**
- **Planificateur d'archivage (1er du mois, heure configurable)**
- **Personnalisation de l'interface *(à venir)***

---

## Fonctionnalités à venir

- **RGPD : Anonymisation de certains éléments**
- **2FA**
- **Personnalisation du Tableau de Bord : éléments affichés, couleurs, TOP3, export PDF, etc.**
- **Fix toutes les pages en i18n**
- **Suivi d'activité : permettre d'ajouter des fichiers dans un suivi d'activité**
- **Suivi d'activité commun multi-utilisateurs avec TAG d'identification**
- **Rubrique Automatisation : stockage des scripts, par type, environnement, tag, fichiers YAML**

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

> Le changement de mot de passe est **obligatoire** à la première connexion (minimum 14 caractères).

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
├── .env.example                # Template de configuration
├── .gitignore
├── README.md
├── deploy-dev.sh               # Script de déploiement Git (ignoré par .gitignore)
├── backend/
│   ├── server.js               # API REST Express — toutes les routes
│   ├── db.js                   # Init SQLite + chiffrement AES-256 + migrations
│   ├── auth.js                 # Middleware JWT, requirePerm, brute-force
│   ├── ssh.js                  # Connexions SSH
│   ├── notifications.js        # SMTP / Telegram / Slack
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
        │   ├── AuthContext.jsx  # JWT, logout(source) avec audit DÉCONNEXION/TIMEOUT
        │   ├── ThemeContext.jsx
        │   └── I18nContext.jsx
        ├── hooks/
        │   ├── useSessionTimeout.js  # Déclenchement timeout + logout('timeout')
        │   └── usePerms.js           # Vérification permissions par rôle
        ├── components/
        │   ├── Navbar.jsx       # Navigation principale
        │   ├── LangSwitcher.jsx # Sélecteur de langue (11 langues)
        │   └── UI.jsx           # Modal, Alert, ConfirmModal, etc.
        ├── i18n/
        │   ├── index.js
        │   └── locales/         # fr, en, de, es, it, ja, nl, pl, pt, ru, zh
        └── pages/
            ├── Login.jsx        # Page de connexion, reset MDP, i18n complet
            ├── Dashboard.jsx    # Tableau de bord
            ├── Backups.jsx      # Backups réseau, groupement pays, comparaison
            ├── Activity.jsx     # Suivi d'activité avec tags
            ├── Config.jsx       # Appareils : Pays, Sites, Modèles, Équipements, Options
            ├── Admin.jsx        # Admin : Compte, Perso, Utilisateurs, Droits, Sécurité, Audit
            ├── Scripts.jsx      # Automatisation (page placeholder)
            └── Personnalisation.jsx  # Personnalisation (à venir)
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

- **Backend** : `entrypoint.sh` s'exécute en root, effectue `chown -R app-nexus /data` (pour les volumes montés), puis lance `su-exec app-nexus node server.js`.
- **Frontend** : `nginx:alpine` configuré avec `pid /tmp/nginx.pid` et chemins temporaires dans `/tmp/nginx/`. Le mot de passe `root` est généré aléatoirement à chaque build (32 octets depuis `/dev/urandom`).

---

## Chiffrement des données

NexusVault utilise un **double chiffrement** à partir d'une seule clé (`ENCRYPTION_KEY`) :

### Niveau 1 — Fichier SQLite (SQLCipher)
Le fichier `nexusvault.db` est entièrement chiffré par **SQLCipher** (AES-256 + PBKDF2-HMAC-SHA512, 256 000 itérations). Ouvert avec un éditeur hex ou SQLite Browser sans la clé, le fichier est illisible — il n'affiche que des octets aléatoires.

### Niveau 2 — Colonnes sensibles (AES-256-CBC)
En plus du chiffrement du fichier, chaque valeur sensible est individuellement chiffrée avant d'être écrite :
- Noms d'équipements, adresses IP, identifiants et mots de passe SSH
- Contenu des fichiers de configuration backupés
- Noms de sites, contacts, notes

Ainsi, même si quelqu'un obtenait la clé SQLCipher, les données de configuration resteraient chiffrées en AES-256 avec un IV aléatoire par valeur.

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
| Archivage audit | ✓ | ✗ | ✗ |
| Accès sécurité | ✓ | ✗ | ✗ |
| Suivi d'activité (écriture) | ✓ | ✓ | ✓ |
| Suivi d'activité (lecture) | ✓ | ✓ | ✗ |
| Automatisation (lecture) | ✓ | ✓ | ✓ |

---

## Modifier le port

Éditez `.env` :
```env
APP_PORT=9090
```
Puis relancez :
```bash
docker compose up -d
```

---

## Sauvegarde des donnees

Les donnees SQLite sont stockees dans un volume Docker dont le nom inclut le nom du repertoire projet.





---

## Restauration

Remplacer VOLUME_NAME par le nom trouve avec docker volume ls.
La ENCRYPTION_KEY doit etre identique a celle de l instance source.



## Réinitialisation d'un mot de passe

En cas de perte d'accès, réinitialisez le mot de passe d'un compte depuis l'hôte Docker :

```bash
docker exec -it nexusvault-backend node server.js reset-password <nomducompte>
```

**Exemple :**
```bash
docker exec -it nexusvault-backend node server.js reset-password admin
```

Le mot de passe est réinitialisé à `changeme` et un changement obligatoire est imposé à la prochaine connexion. Le compte est également déverrouillé si nécessaire.

---

## Variable LOG_LEVEL

Configure la verbosité des logs du conteneur backend (`docker logs nexusvault-backend`) :

| Valeur | Ce qui est affiché |
|---|---|
| `debug` | Tout : ticks cron, appels API, activité détaillée. Utile pour déboguer. |
| `info` | **(défaut)** Informations importantes : démarrage, comptes, emails, archivages. |
| `warn` | Avertissements : brute-force, SMTP absent, anomalies non critiques. |
| `error` | Erreurs critiques uniquement : exceptions, échecs base de données, crashs. |

Exemple dans `.env` :
```env
LOG_LEVEL=warn
```

---

## Archivage automatique du journal d'audit

Le journal est archivé **automatiquement le 1er de chaque mois** à l'heure configurée dans **Administration → Sécurité → Planificateur**. L'archivage :

1. Copie toutes les entrées du mois précédent dans `audit_archives`
2. Supprime ces entrées du journal actif
3. Crée une entrée `AUDIT_ARCHIVÉ` dans le journal courant
4. Persiste la date/heure du dernier run en DB (survit aux redémarrages)

Les archives sont consultables et téléchargeables en **CSV.gz** (BOM UTF-8, compatible Excel) depuis **Administration → Journal d'audit → Archives**.

---

## Option Pays

L'organisation par pays est **optionnelle** et s'active depuis **Appareils → Options → Activer l'option Pays**.

Une fois activée :
- Un gestionnaire de pays apparaît dans l'onglet Options (ajout, modification, suppression, réorganisation par drag-and-drop)
- Dans l'onglet **Sites**, chaque site peut être associé à un pays
- Dans **Backups**, les sites sont regroupés par pays (ordre alphabétique), dépliables au clic

---

*Version courante : consultez `.build_meta` pour le numéro de build exact.*
