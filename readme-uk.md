![Logo](screenshots/logo-login.png)

# nexusVault — New EXperience for USer Vault — IT Secure Vault Environment

IT critical element vault interface: network equipment configuration, activity tracking, automation and secure document management.

---

> 🇫🇷 [Version française ici](README.md)

## Why nexusVault?

Configuration files, equipment backup files, and IT activity logs are critical assets that should never be stored on a simple file server or NAS.
If compromised, attackers have everything at their fingertips!

---

## Key Features

### Configuration Backups
- **Network equipment configuration backup: Switches, NAS, Firewalls, Others**
- **Manual import** (paste content) and **automatic via SSH** (commands customisable per model)
- **Automatic backup scheduler**: hourly/daily/weekly/monthly frequency, time and equipment configurable per schedule
- **Smart deduplication**: if the configuration hasn't changed, no new version is created. Dynamic lines are ignored (timestamps, uptime, last login, NTP, etc.)
- **Visual diff** between two versions (additions in green, deletions in red)
- **Parent/child site hierarchy**: a site can contain sub-sites, displayed as a tree on the Backup page
- **Optional site grouping by country** (enable in Devices → Options)
- **CSV.gz backup export**

### Documents
- **Hierarchical categories** with nested levels, types: Generic, Temporary, Procedure, Script, Secured
- **Coloured categories** with expiry date (Temporary type) and expiration alerts
- **Documents**: creation, editing, full change history
- **File attachments** per document: multiple upload, download, deletion, **file replacement** (logged in audit trail)
- **Integrated preview**: native PDF (iframe), Word/ODT (LibreOffice → PDF), scripts (syntax highlighting via highlight.js — yaml, json, python, bash, sql…)
- **Secured documents**: global or per-document password protection
- **Temporary documents**: expiry date with expiration alerts on the dashboard
- **One-click copy** of script content to clipboard with audit trail
- **Full audit** of every access, modification, preview, copy, replacement and failed attempt

### Activity Tracking
- **IT team activity tracking per user via TAGs with filtering**
- **Custom TAGs with colours: SECU, ADM, NET, BACKUP, INCIDENT…**
- **File attachments per note**: upload, lock, delete, download
- **`[secret]...[/secret]` tag** to mask sensitive data — displayed as `●●●●●` in the list, visible only when editing
- **Cosmetic display date** (Admin → Activity → Options)
- **CSV import** of historical notes (format `YEAR;MONTH;DAY;TAG;NOTE`)
- **PDF export** with custom logo — 4 modes: by month, by year, all periods, by TAG
- **Note protection**: TAG deletion blocked if used in notes

### Notifications
- **SMTP, Telegram and Slack** configurable from the Admin interface (Security → Notifications)
- **6-digit code validation**: after channel configuration, a code is sent via the channel to confirm it works before activation
- **Notifiable events**:
  - Failed login attempts (configurable threshold)
  - Account locked by brute-force
  - Configuration download
  - Automatic backup result (success/failure report per device)
  - Temporary document expiration
  - Deletion of a document / document file / activity entry / activity file / backup
  - Preview notes recap (00:05, daily/weekly/monthly frequency)
  - Retention files recap (00:05, daily/weekly/monthly frequency)
- **Notification log**: send history with success/error status

### Deleted Item Retention
- **Configurable recycle bin** for backups, documents, document files and activity entries
- **Independent retention duration** per type: 0 (none), 7, 15, 30 or 60 days
- **Complete restore**: a restored document also recovers its attached files; a restored entry recovers its linked files
- **Management modal** with 3 tabs (Backup / Automation / Activity), columns deleted by / deleted on / expires on (orange if < 3 days)
- **Permanent deletion** from the bin with confirmation
- **Dedicated access right** `retention_access` configurable per user
- **Full audit**: viewing, restoring and permanent deletion are all logged

### Dashboard
- **Backups section**: total backups, equipment, sites, models
- **Documents section**: total documents, 3 latest added, top 3 categories with colour codes, upcoming expirations
- **Activity section**: total notes, current month activity, top 3 tags by year (N and N-1)

### Audit Log
- **Full audit**: Login OK/NOK, Add/Delete/View/Modify
- **Brute-force detection and logging**
- **Automatic monthly archiving** (configurable cron)
- **Archive browsing** by year/month, CSV.gz download
- **Action translation** according to the interface language

### Security
- **Role-based access control** (Admin, Operator, Reader) with fine-grained per-user permissions
- **IP / CIDR whitelist**: restrict access to specific IPs or network ranges (`192.168.1.0/24`). Without rules, access is open to everyone
- **Configurable brute-force protection**: number of attempts and lockout duration
- **Configurable session timeout** with visual countdown and automatic audit
- **Authentication type** displayed in the user list (Local / OIDC / LDAP)
- **TOTP authentication** (Google Authenticator, Authy…) mandatory or optional
- **Manual account unlock** from the Admin interface
- **OIDC / SSO authentication** configurable from the Admin interface
- **Mandatory password change** on first login (minimum 14 characters)
- **System tab**: real-time monitoring — uptime, Node.js memory, SQLite DB size table by table, 24h activity, scheduler status, whitelist status
- **Dark / light mode**
- **i18n multilingual (11 languages)**: `fr`, `en`, `de`, `es`, `it`, `ja`, `nl`, `pl`, `pt`, `ru`, `zh`
- **AES-256 encryption** of all sensitive data in SQLite

### Administration
- **User management** with lock/unlock, TOTP reset, individual permissions
- **Configurable application URL**
- **Archiving scheduler** (1st of the month, configurable time)
- **Custom PDF logo** (max height 120px)
- **Automation administration**: categories, types, colours, global secured document password

---

## Upcoming Features

- **GDPR: Anonymisation of certain elements**
- **Dashboard customisation**: displayed elements, colours, TOP3, etc.
- **Shared multi-user activity tracking** with identification TAG

---

## Quick Start

### 1. Prerequisites

- Docker ≥ 20.x
- Docker Compose ≥ 2.x

### 2. Configuration

```bash
# Clone or copy the project
git clone <repo> nexusvault && cd nexusvault

# Create the configuration file
cp .env.example .env
```

Edit `.env` and set **mandatory** values:

| Variable | Description |
|---|---|
| `APP_PORT` | Web access port (default: `8080`) |
| `ENCRYPTION_KEY` | AES-256 key for data encryption |
| `JWT_SECRET` | JWT token signing secret |

Generate secure keys:
```bash
openssl rand -hex 32   # for ENCRYPTION_KEY
openssl rand -hex 32   # for JWT_SECRET
```

> ⚠️ **Never change `ENCRYPTION_KEY` after first startup** — already encrypted data would become unreadable.

### 3. Launch

```bash
docker compose up -d --build
```

Access: **http://localhost:8080** (or the port configured in `APP_PORT`)

Default credentials:
- Login: `admin`
- Password: `changeme`

> Password change is **mandatory** on first login (minimum 14 characters). A dedicated modal appears directly on the login page.

### 4. Stop and Data

```bash
# Stop
docker compose down

# Stop AND delete data (⚠️ irreversible)
docker compose down -v
```

---

## Architecture

```
nexusvault/
├── docker-compose.yml          # TZ, APP_PORT, ENCRYPTION_KEY, JWT_SECRET, LOG_LEVEL
├── docker-compose.git.yml      # Build from sources (dev/CI)
├── .env.example                # Configuration template
├── .gitignore
├── README.md                   # French documentation
├── readme-uk.md                # English documentation (this file)
├── deploy.sh                   # Git + Docker Hub deployment script
├── backend/
│   ├── server.js               # Express REST API — all routes
│   ├── db.js                   # SQLite init + AES-256 encryption + migrations
│   ├── auth.js                 # JWT middleware, requirePerm, brute-force, CIDR whitelist
│   ├── notifications.js        # SMTP / Telegram / Slack — EVENT_CATALOG, dispatch
│   ├── entrypoint.sh           # Chown /data then su-exec app-nexus
│   ├── package.json
│   └── Dockerfile              # Node 22 Alpine, non-root user app-nexus
└── frontend/
    ├── nginx.conf              # listen 8080, proxy /api/ → backend:3001
    ├── Dockerfile              # nginx:alpine non-root, curl healthcheck
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Routing, SessionWarning (countdown + audit)
        ├── api.js              # All API methods (fetch)
        ├── index.css           # CSS variables, light/dark themes
        ├── contexts/
        │   ├── AuthContext.jsx  # JWT, logout(source) with audit
        │   ├── ThemeContext.jsx
        │   └── I18nContext.jsx  # i18n provider, language selector
        ├── hooks/
        │   ├── useSessionTimeout.js
        │   └── usePerms.js
        ├── components/
        │   ├── Navbar.jsx
        │   ├── LangSwitcher.jsx # Language selector (11 languages)
        │   └── UI.jsx
        ├── i18n/
        │   ├── index.js         # i18n engine, static EN import, fallback
        │   └── locales/         # fr, en, de, es, it, ja, nl, pl, pt, ru, zh
        └── pages/
            ├── Login.jsx        # Login, password reset, mandatory change modal
            ├── Dashboard.jsx    # Dashboard (3 sections)
            ├── Backups.jsx      # Network backups, site tree, diff
            ├── Activity.jsx     # Activity tracking, tags, PDF export
            ├── Config.jsx       # Devices: Countries, Sites (hierarchy), Models, Equipment
            ├── Scripts.jsx      # Automation: categories, documents, files
            └── Admin.jsx        # Full administration
```

**2 Docker containers:**

| Container | Role | Exposed port | User |
|---|---|---|---|
| `nexusvault-frontend` | React + Nginx (reverse proxy) | `APP_PORT` → 8080 | `app-nexus` (non-root) |
| `nexusvault-backend` | Node.js API + SQLite | internal (3001) | `app-nexus` (non-root via su-exec) |

The backend is **never directly exposed** — all traffic goes through Nginx.

---

## Docker Security

Both containers run as **non-root user** `app-nexus`:

- **Backend**: `entrypoint.sh` runs as root, performs `chown -R app-nexus /data`, then launches `su-exec app-nexus node server.js`.
- **Frontend**: `nginx:alpine` with `pid /tmp/nginx.pid`. Root password randomly generated at each build.

---

## Data Encryption

NexusVault uses **double encryption** from a single key (`ENCRYPTION_KEY`):

### Level 1 — SQLite File (SQLCipher)
The `nexusvault.db` file is fully encrypted by **SQLCipher** (AES-256 + PBKDF2-HMAC-SHA512, 256,000 iterations).

### Level 2 — Sensitive Columns (AES-256-CBC)
Each sensitive value is individually encrypted with a random IV before being written to the database:
- Device names, IP addresses, SSH credentials and passwords
- Content of backed-up configuration files
- Site names, contacts, notes

---

## Role Permissions

| Permission | Admin | Operator | Reader |
|---|:---:|:---:|:---:|
| Read backups | ✓ | ✓ | ✓ |
| Write/import backups | ✓ | ✗ | ✗ |
| Compare backups | ✓ | ✓ | ✗ |
| Configuration (read) | ✓ | ✓ | ✓ |
| Configuration (write) | ✓ | ✓ | ✗ |
| Audit log | ✓ | ✗ | ✗ |
| Security access | ✓ | ✗ | ✗ |
| Retention access | ✓ | ✗ | ✗ |
| SQLite backup (backup/restore) | ✓ | ✗ | ✗ |
| Manage minimum password length | ✓ | ✗ | ✗ |
| Activity tracking (write) | ✓ | ✓ | ✓ |
| Activity tracking (read) | ✓ | ✓ | ✗ |
| Automation (read) | ✓ | ✓ | ✓ |
| Automation (write) | ✓ | ✓ | ✗ |

> Permissions are fully configurable per user from Administration → Access Rights.

---

## SSH Backup Scheduler

### Available Frequencies
| Frequency | Description |
|---|---|
| Hourly | At hour H of every hour |
| Daily | Once a day at the configured time |
| Weekly | A day of the week at a time |
| Monthly | A day of the month at a time |

### Smart Deduplication
Lines ignored during comparison: timestamps, SSH last login dates, uptime, NTP timestamps, `! Last configuration change`, `! NVRAM config last updated`, ISO date lines (YYYY-MM-DD), etc.

---

## Data Backup

```bash
# Identify the volume
docker volume ls | grep nexusvault

# Backup
docker compose down
docker run --rm \
  -v VOLUME_NAME:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/nexusvault-backup-$(date +%Y%m%d).tar.gz -C / data
docker compose up -d
```

---

## Restore

```bash
docker run --rm \
  -v VOLUME_NAME:/data \
  -v $(pwd):/backup \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/nexusvault-backup-YYYYMMDD.tar.gz -C /"
```

> `ENCRYPTION_KEY` must be **identical** to the source instance.

---

## Password Reset

```bash
docker exec -it nexusvault-backend node server.js reset-password <username>
```

---

## LOG_LEVEL Variable

| Value | What is displayed |
|---|---|
| `debug` | Everything: cron ticks, API calls, detailed activity |
| `info` | **(default)** Startup, accounts, emails, archiving |
| `warn` | Brute-force, missing SMTP, non-critical anomalies |
| `error` | Critical errors only |

---

## Internationalisation (i18n)

| Code | Language | Status |
|---|---|---|
| `en` | English | ✅ Complete (reference) |
| `fr` | French | ✅ Complete |
| `de` `es` `it` `pt` `nl` `pl` `ru` `ja` `zh` | Others | 🔧 Partial — contributions welcome |

---

## `[secret]` Tag

```
Server password: [secret]MyPassword123![/secret]
```

Display: `●●●●●` (orange background) in the list, actual text visible only when editing.

---

*Current version: `2026-05-21-b388` — see `frontend/src/version.js` or the interface footer.*
