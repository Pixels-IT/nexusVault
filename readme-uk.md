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
- **Manual and automatic backup import (SSH)**
- **Visual diff between two versions (additions in green, deletions in red)**
- **Country, site, equipment and device model management**
- **Optional site grouping by country (enable in Devices → Options)**
- **CSV.gz backup export**

### Automation
- **Hierarchical categories** by type: Generic, Temporary, Procedure, Script, Secured
- **Documents**: creation, editing, full change history
- **File attachments** per document: multiple upload, download, deletion
- **Integrated file preview**: native PDF (iframe), Word/ODT (LibreOffice → PDF), scripts (syntax highlighting via highlight.js — yaml, json, python, bash, sql…)
- **Secured documents**: password protection globally (Admin → Automation → Options) or per document
- **Temporary documents**: expiry date with expiration alerts on the dashboard
- **One-click copy** of script content to clipboard with audit trail
- **Full audit** of every access, modification, preview, copy and failed attempt

### Activity Tracking
- **IT team activity tracking per user via TAGs with filtering**
- **Custom TAGs with colors: SECU, ADM, NET, BACKUP, INCIDENT…**
- **File attachments per note**: upload, lock, delete, download
- **`[secret]...[/secret]` tag** to mask sensitive data — displayed as `●●●●●` in the list, visible only when editing
- **Cosmetic display date** (Admin → Activity → Options)
- **CSV import** of historical notes (format `YEAR;MONTH;DAY;TAG;NOTE`)
- **PDF export** with custom logo — 4 modes: by month, by year, all periods, by TAG
- **Note protection**: TAG deletion blocked if used in notes

### Dashboard
- **Backups section**: total backups, equipment, sites, models
- **Automation section**: total documents, 3 latest added, top 3 categories with color codes, upcoming expirations
- **Activity section**: total notes, current month activity, top 3 tags by year (N and N-1)

### Audit Log
- **Full audit**: Login OK/NOK, Add/Delete/View/Edit
- **Brute-force detection and logging**
- **Automatic monthly archiving** (configurable cron)
- **Archive browsing** by year/month, CSV.gz download
- **Action translations** according to the interface language

### Security
- **Role-based access control** (Admin, Operator, Reader)
- **Configurable brute-force protection**: number of attempts and lockout duration
- **Configurable session timeout** with visual countdown and automatic audit
- **TOTP authentication** (Google Authenticator, Authy…) mandatory or optional
- **Manual account unlock** from Admin interface
- **Dark / light mode**
- **i18n multilingual support (11 languages)**: `fr`, `en`, `de`, `es`, `it`, `ja`, `nl`, `pl`, `pt`, `ru`, `zh`
- **LDAP/LDAPS, OIDC authentication** *(not tested yet)*
- **Notifications via SMTP, Telegram and Slack** *(not tested yet)*
- **AES-256 encryption** of all sensitive data in SQLite database

### Administration
- **User management** with lock/unlock, TOTP reset
- **Configurable application URL**
- **Archiving scheduler** (1st of the month, configurable time)
- **Custom PDF logo** (max height 120px)
- **Automation administration**: categories, types, colors, global password for secured documents

---

## Coming Soon

- **GDPR: Element anonymization**
- **Dashboard customization**: displayed elements, colors, TOP3, etc.
- **Shared multi-user activity tracking** with user-identification TAGs

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

Edit `.env` and set **required** values:

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

> ⚠️ **Never change `ENCRYPTION_KEY` after the first startup** — already encrypted data would become unreadable.

### 3. Start

```bash
docker compose up -d --build
```

Access: **http://localhost:8080** (or the port set in `APP_PORT`)

Default credentials:
- Login: `admin`
- Password: `changeme`

> Password change is **mandatory** on first login (minimum 14 characters).

### 4. Stop and data

```bash
# Stop
docker compose down

# Stop AND delete data (⚠️ irreversible)
docker compose down -v
```

### 5. Screenshots

![Dashboard](screenshots/dashboard.png)
![Backup](screenshots/backup.png)
![Activity Tracking](screenshots/activity_tracking.png)
![Admin](screenshots/admin.png)

---

## Architecture

```
nexusvault/
├── docker-compose.yml          # TZ, APP_PORT, ENCRYPTION_KEY, JWT_SECRET, LOG_LEVEL
├── docker-compose.git.yml      # Build from source (dev/CI)
├── .env.example                # Configuration template
├── .gitignore
├── README.md                   # French documentation
├── readme-uk.md                # English documentation (this file)
├── deploy.sh                   # Git + Docker Hub deployment script
├── backend/
│   ├── server.js               # Express REST API — all routes
│   ├── db.js                   # SQLite init + AES-256 encryption + migrations
│   ├── auth.js                 # JWT middleware, requirePerm, brute-force
│   ├── notifications.js        # SMTP / Telegram / Slack
│   ├── entrypoint.sh           # Chown /data then su-exec app-nexus
│   ├── package.json
│   └── Dockerfile              # Node 22 Alpine, non-root app-nexus user
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
        │   └── I18nContext.jsx  # i18n provider, language switcher
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
            ├── Login.jsx        # Login page, password reset
            ├── Dashboard.jsx    # Dashboard (3 sections)
            ├── Backups.jsx      # Network backups, diff, country grouping
            ├── Activity.jsx     # Activity tracking, tags, PDF export
            ├── Config.jsx       # Devices: Countries, Sites, Models, Equipment
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

- **Backend**: `entrypoint.sh` runs as root, performs `chown -R app-nexus /data`, then starts `su-exec app-nexus node server.js`.
- **Frontend**: `nginx:alpine` with `pid /tmp/nginx.pid`. The `root` password is randomly generated at each build.

---

## Data Encryption

NexusVault uses **double encryption** from a single key (`ENCRYPTION_KEY`):

### Level 1 — SQLite file (SQLCipher)
The `nexusvault.db` file is fully encrypted by **SQLCipher** (AES-256 + PBKDF2-HMAC-SHA512, 256,000 iterations).

### Level 2 — Sensitive columns (AES-256-CBC)
Each sensitive value is individually encrypted with a random IV before being written:
- Equipment names, IP addresses, SSH credentials and passwords
- Backed-up configuration file contents
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
| Activity tracking (write) | ✓ | ✓ | ✓ |
| Activity tracking (read) | ✓ | ✓ | ✗ |
| Automation (read) | ✓ | ✓ | ✓ |
| Automation (write) | ✓ | ✓ | ✗ |

---

## Change the Port

Edit `.env`:
```env
APP_PORT=9090
```
Then restart:
```bash
docker compose up -d
```

---

## Data Backup

> **Identify the exact volume name**:
> ```bash
> docker volume ls | grep nexusvault
> ```

> ⚠️ **Stop containers before backing up** — SQLite locks the `.db` file during execution.

```bash
# 1. Stop
docker compose down

# 2. Backup
docker run --rm \
  -v VOLUME_NAME:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/nexusvault-backup-$(date +%Y%m%d).tar.gz -C / data

# 3. Verify (must show data/nexusvault.db)
docker run --rm \
  -v $(pwd):/backup \
  alpine \
  tar tzf /backup/nexusvault-backup-$(date +%Y%m%d).tar.gz

# 4. Restart
docker compose up -d
```

---

## Restore a Backup

> The `ENCRYPTION_KEY` in `.env` must be **identical** to the source instance.

**1. Prepare**
```bash
cp .env.example .env
# Set the same ENCRYPTION_KEY as the original instance
```

**2. Create the Docker volume**
```bash
docker compose up -d --build && docker compose down
```

**3. Identify the volume**
```bash
docker volume ls | grep nexusvault
```

**4. Restore** (from the directory containing the .tar.gz)
```bash
docker run --rm \
  -v VOLUME_NAME:/data \
  -v $(pwd):/backup \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/nexusvault-backup-YYYYMMDD.tar.gz -C /"
```

**5. Restart**
```bash
docker compose up -d
```

---

## Password Reset

```bash
docker exec -it nexusvault-backend node server.js reset-password <username>
```

Password reset to `changeme`, mandatory change enforced on next login. Account also unlocked if necessary.

---

## LOG_LEVEL Variable

| Value | What is shown |
|---|---|
| `debug` | Everything: cron ticks, API calls, detailed activity |
| `info` | **(default)** Startup, accounts, emails, archiving |
| `warn` | Brute-force, missing SMTP, non-critical anomalies |
| `error` | Critical errors only |

> 💡 SMTP configuration generates detailed `info` logs (`docker logs nexusvault-backend`) to help diagnose delivery issues.

---

## Automatic Audit Log Archiving

The audit log is **automatically archived on the 1st of each month** at the time configured in **Administration → Security → Scheduler**:

1. Copies all entries from the previous month into `audit_archives`
2. Deletes those entries from the active log
3. Creates an `AUDIT_ARCHIVED` entry in the current log
4. Persists the last run date/time in DB (survives restarts)

Archives can be viewed and downloaded as **CSV.gz** (UTF-8 BOM, Excel-compatible) from **Administration → Audit Log → Archives**.

---

## Country Option

Country-based organization is **optional**, enabled from **Devices → Options → Enable Country option**:

- Country manager in the Options tab (add, edit, delete, drag-and-drop reorder)
- Each site can be assigned to a country in the **Sites** tab
- Sites are grouped by country in **Backups** (alphabetical order), expandable on click

---

## Internationalisation (i18n)

| Code | Language | Status |
|---|---|---|
| `en` | English | ✅ Complete (reference) |
| `fr` | Français | ✅ Complete |
| `de` `es` `it` `pt` `nl` `pl` `ru` `ja` `zh` | Others | 🔧 Partial — contributions welcome |

To contribute, edit the corresponding file in `frontend/src/i18n/locales/XX.js`.
Missing keys automatically fall back to English.

---

## `[secret]` Tag — Masking Sensitive Data

```
Server password: [secret]MyPassword123![/secret]
API key: [secret]sk-xxxxxxxxxxxxxxxxxxxx[/secret]
```

**Behavior:**
- **Activity page**: displayed as `●●●●●` (orange background)
- **Edit modal**: real text visible and editable
- **PDF export**: masked data shown as `●●●●●`

> ⚠️ Data is stored **in plain text** in the encrypted database. Masking is visual only.

---

*Current version: see `frontend/src/version.js` or the interface footer.*
