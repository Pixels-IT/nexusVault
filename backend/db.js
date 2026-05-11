const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || '/data/nexusvault.db';

// Clé maître : chiffrement SQLite (niveau fichier) ET chiffrement AES-256 des colonnes sensibles
const ENC_KEY = process.env.ENCRYPTION_KEY || 'default-insecure-key-change-me!!';

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  try { db.exec("ALTER TABLE sites ADD COLUMN country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL"); } catch {}
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
      password_hash TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 1,
      role TEXT DEFAULT 'viewer',
      permissions TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value_enc TEXT NOT NULL,
      label_enc TEXT,
      type TEXT DEFAULT 'ip',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      detail TEXT,
      ip TEXT,
      success INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

        CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_enc TEXT NOT NULL,
      location_enc TEXT,
      contact_enc TEXT,
      description_enc TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS device_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_enc TEXT NOT NULL,
      model_enc TEXT NOT NULL,
      device_type_enc TEXT,
      backup_method_enc TEXT DEFAULT 'SSH',
      backup_command_enc TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_enc TEXT NOT NULL,
      site_id INTEGER NOT NULL,
      model_id INTEGER NOT NULL,
      ip_enc TEXT NOT NULL,
      ssh_port_enc TEXT DEFAULT '22',
      ssh_user_enc TEXT,
      ssh_password_enc TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(model_id) REFERENCES device_models(id)
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      content_enc TEXT NOT NULL,
      size_bytes INTEGER,
      status TEXT DEFAULT 'ok',
      note_enc TEXT,
      triggered_by TEXT DEFAULT 'manual',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(device_id) REFERENCES devices(id)
    );




    CREATE TABLE IF NOT EXISTS activity_entry_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,  -- created | updated | tag_changed | preview_changed
      detail TEXT,
      changed_by INTEGER,
      changed_at TEXT NOT NULL
    );

    -- Configuration des notifications (une ligne par type d'événement)
    CREATE TABLE IF NOT EXISTS notification_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key    TEXT NOT NULL UNIQUE,  -- identifiant technique
      enabled      INTEGER NOT NULL DEFAULT 0,
      channels     TEXT NOT NULL DEFAULT '[]', -- JSON: ["email","log"]
      options      TEXT NOT NULL DEFAULT '{}', -- JSON: paramètres spécifiques (fréquence, seuil…)
      updated_at   TEXT
    );

    -- Historique des notifications envoyées
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key  TEXT NOT NULL,
      channel    TEXT NOT NULL,
      subject    TEXT,
      body       TEXT,
      sent_at    TEXT NOT NULL,
      success    INTEGER NOT NULL DEFAULT 1,
      error      TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      entry_count INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      archived_at TEXT NOT NULL,
      archived_by TEXT DEFAULT 'cron',
      UNIQUE(year, month)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES activity_entries(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mimetype TEXT DEFAULT 'application/octet-stream',
      size_bytes INTEGER DEFAULT 0,
      data TEXT NOT NULL,
      locked INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT (datetime('now','localtime')),
      uploaded_by INTEGER REFERENCES users(id)
    );

        CREATE TABLE IF NOT EXISTS activity_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#066fd1',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS activity_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      tag_code TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

  `);


  // Tags d'activité par défaut
  const tagsExist = db.prepare("SELECT COUNT(*) as c FROM activity_tags").get().c;
  if (!tagsExist) {
    const defaultTags = [
      { code: 'SECU',    label: 'Sécurité',        color: '#d63939' },
      { code: 'INFRA',   label: 'Infrastructure',   color: '#066fd1' },
      { code: 'NETWORK', label: 'Réseau',            color: '#2fb344' },
      { code: 'FW',      label: 'Pare-Feu',          color: '#f76707' },
      { code: 'MAIL',    label: 'Messagerie',        color: '#7c3aed' },
      { code: 'BACKUP',  label: 'Sauvegarde',        color: '#0f9e73' },
      { code: 'TEL',     label: 'Téléphonie',        color: '#e91e8c' },
      { code: 'AV',      label: 'Antivirus',         color: '#c2410c' },
      { code: 'ADM',     label: 'Administratif',     color: '#677489' },
    ];
    const stmt = db.prepare("INSERT INTO activity_tags (code, label, color) VALUES (?, ?, ?)");
    defaultTags.forEach(t => stmt.run(t.code, t.label, t.color));
    console.log('[DB] Tags activite par defaut inseres');
  }
  // Migrations: ajouter colonnes si absentes
  try { db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN locked_until TEXT"); } catch {}
  try { db.exec("ALTER TABLE activity_entries ADD COLUMN is_preview INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE activity_entries ADD COLUMN display_date TEXT"); } catch {}

  // ── Catégories Automatisation ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      type        TEXT NOT NULL DEFAULT 'generic',
      color       TEXT NOT NULL DEFAULT '#066fd1',
      parent_id   INTEGER REFERENCES automation_categories(id) ON DELETE SET NULL,
      valid_until TEXT,
      created_at  TEXT DEFAULT (datetime('now','localtime')),
      updated_at  TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  // ── Documents Automatisation ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES automation_categories(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      note        TEXT,
      valid_until TEXT,
      doc_password TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TEXT DEFAULT (datetime('now','localtime')),
      updated_at  TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_document_files (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES automation_documents(id) ON DELETE CASCADE,
      filename    TEXT NOT NULL,
      mimetype    TEXT,
      size_bytes  INTEGER,
      data        BLOB NOT NULL,
      uploaded_by INTEGER REFERENCES users(id),
      uploaded_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  // Garder automation_files pour compatibilité ascendante (table ancienne)
  try { db.exec("ALTER TABLE automation_files ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE automation_files ADD COLUMN description TEXT"); } catch {}
  try { db.exec("ALTER TABLE automation_files ADD COLUMN valid_until TEXT"); } catch {}
  // ref_id pour lier un événement audit à un document spécifique
  try { db.exec("ALTER TABLE audit_log ADD COLUMN ref_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE automation_documents ADD COLUMN doc_password TEXT"); } catch {}

  // ── Options catégories ────────────────────────────────────────────────────
  // Stockées dans settings: automation_cat_color_inherit
  try { db.exec("ALTER TABLE backups ADD COLUMN pinned INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0"); } catch {}

  // Admin par défaut
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('changeme', 12);
    db.prepare(`INSERT INTO users (username, display_name, password_hash, must_change_password, role)
                VALUES (?, ?, ?, 1, 'admin')`).run('admin', 'Administrateur', hash);
    console.log('[DB] Compte admin créé (mot de passe: changeme)');
  }

  const initialized = db.prepare("SELECT key FROM settings WHERE key = 'initialized'").get();
  if (!initialized) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('initialized', '1')").run();
    seedDemoData();
  }
}


function deriveKey(key) {
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text) {
  if (text === null || text === undefined) return null;
  const key = deriveKey(ENC_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(enc) {
  if (!enc) return null;
  try {
    const [ivHex, dataHex] = enc.split(':');
    const key = deriveKey(ENC_KEY);
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch { return '[erreur déchiffrement]'; }
}

function audit(db, { userId, username, action, category, severity = 'info', detail = '', ip = '', success = 1, ref_id = null }) {
  try {
    const now = (() => {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    })();
    db.prepare(`INSERT INTO audit_log (user_id, username, action, category, severity, detail, ip, success, ref_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId || null, username || 'system', action, category, severity, detail, ip, success ? 1 : 0, ref_id || null, now);
  } catch (e) { console.error('[AUDIT]', e.message); }
}

function seedDemoData() {
  const site1 = db.prepare('INSERT INTO sites (name_enc, location_enc, contact_enc) VALUES (?,?,?)').run(
    encrypt('Paris HQ'), encrypt('Paris, France'), encrypt('it@company.fr'));
  const site2 = db.prepare('INSERT INTO sites (name_enc, location_enc, contact_enc) VALUES (?,?,?)').run(
    encrypt('Lyon DC'), encrypt('Lyon, France'), encrypt('dc@company.fr'));
  const m1 = db.prepare('INSERT INTO device_models (vendor_enc, model_enc, device_type_enc, backup_method_enc, backup_command_enc) VALUES (?,?,?,?,?)').run(
    encrypt('Cisco'), encrypt('Catalyst 9300'), encrypt('Switch'), encrypt('SSH'), encrypt('show running-config'));
  const m2 = db.prepare('INSERT INTO device_models (vendor_enc, model_enc, device_type_enc, backup_method_enc, backup_command_enc) VALUES (?,?,?,?,?)').run(
    encrypt('HP'), encrypt('Aruba 2930F'), encrypt('Switch'), encrypt('SSH'), encrypt('show running-config'));
  const m3 = db.prepare('INSERT INTO device_models (vendor_enc, model_enc, device_type_enc, backup_method_enc, backup_command_enc) VALUES (?,?,?,?,?)').run(
    encrypt('Fortinet'), encrypt('FortiGate 90G'), encrypt('Pare-Feu'), encrypt('SSH'), encrypt('show full-configuration'));
  const d1 = db.prepare('INSERT INTO devices (name_enc, site_id, model_id, ip_enc, ssh_user_enc) VALUES (?,?,?,?,?)').run(
    encrypt('sw-paris-core-01'), site1.lastInsertRowid, m1.lastInsertRowid, encrypt('10.0.1.1'), encrypt('admin'));
  const d2 = db.prepare('INSERT INTO devices (name_enc, site_id, model_id, ip_enc, ssh_user_enc) VALUES (?,?,?,?,?)').run(
    encrypt('sw-lyon-access-02'), site2.lastInsertRowid, m2.lastInsertRowid, encrypt('10.1.1.2'), encrypt('admin'));
  const d3 = db.prepare('INSERT INTO devices (name_enc, site_id, model_id, ip_enc, ssh_user_enc) VALUES (?,?,?,?,?)').run(
    encrypt('FW-XH'), site1.lastInsertRowid, m3.lastInsertRowid, encrypt('10.10.10.1'), encrypt('admin'));
  const cfg1 = `hostname sw-paris-core-01\nvlan 10 name SERVERS\nvlan 20 name USERS\nvlan 30 name GUEST\nvlan 99 name MGMT\ninterface GigabitEthernet1/0/1\n  switchport mode access\n  switchport access vlan 20\nspanning-tree mode rapid-pvst`;
  const cfg2 = `hostname sw-paris-core-01\nvlan 10 name SERVERS\nvlan 20 name USERS\nvlan 30 name WIFI_GUEST\nvlan 40 name IOT_DEVICES\nvlan 99 name MGMT\ninterface GigabitEthernet1/0/1\n  switchport mode access\n  switchport access vlan 20\nspanning-tree mode rapid-pvst\nspanning-tree vlan 1-4094 priority 4096`;
  db.prepare('INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc) VALUES (?,?,?,?,?,?)').run(d1.lastInsertRowid, 1, encrypt(cfg1), cfg1.length, 'ok', encrypt('Configuration initiale'));
  db.prepare('INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc) VALUES (?,?,?,?,?,?)').run(d1.lastInsertRowid, 2, encrypt(cfg2), cfg2.length, 'ok', encrypt('Ajout VLAN 40 IOT + spanning-tree'));

  // Entrées de suivi d'activité pour N-1 et N-2 — évite la boucle dashboard sur années vides
  const now = new Date();
  const yearN1 = now.getFullYear() - 1;
  const yearN2 = now.getFullYear() - 2;
  const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const userId = adminUser ? adminUser.id : 1;
  // Créer un tag NET par défaut si nécessaire
  let netTagId = db.prepare("SELECT id FROM activity_tags WHERE id = 1").get();
  if (!netTagId) {
    db.prepare('INSERT INTO activity_tags (code_enc, label_enc, color) VALUES (?,?,?)').run(encrypt('NET'), encrypt('Réseau'), '#066fd1');
  }
  const entryStmt = db.prepare('INSERT INTO activity_entries (user_id, tag_code_enc, note_enc, display_date, created_at, updated_at) VALUES (?,?,?,?,?,?)');
  [`${yearN2}-06-15`, `${yearN1}-03-20`, `${yearN1}-09-10`].forEach(date => {
    entryStmt.run(userId, encrypt('NET'), encrypt('Entrée de démonstration'), date, `${date}T10:00:00.000Z`, `${date}T10:00:00.000Z`);
  });
  console.log('[DB] Données de démonstration insérées');
}

module.exports = { getDb, encrypt, decrypt, audit };
