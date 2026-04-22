require('dotenv').config();
const express = require('express');
const { sshExec } = require('./ssh');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, encrypt, decrypt, audit } = require('./db');
const { authMiddleware, requireRole, requirePerm, JWT_SECRET, getClientIp, checkWhitelist } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());


// Helper : heure locale formatée pour SQLite (respecte TZ du conteneur)
function nowLocal() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── WHITELIST MIDDLEWARE (sauf health + login) ────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/auth/login') return next();
  if (!checkWhitelist(req)) {
    const ip = getClientIp(req);
    const db = getDb();
    audit(db, { action: 'ACCÈS_REFUSÉ', category: 'sécurité', severity: 'warn', detail: `IP non autorisée: ${ip}`, ip, success: 0 });
    return res.status(403).json({ error: 'Accès refusé : IP/URL non autorisée' });
  }
  next();
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.enabled || !bcrypt.compareSync(password, user.password_hash)) {
    audit(db, { username, action: 'CONNEXION_ÉCHEC', category: 'auth', severity: 'warn', detail: `Identifiant tenté: "${username}" depuis ${ip}`, ip, success: 0 });
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  let perms = {};
  try { perms = JSON.parse(user.permissions || '{}'); } catch {}
  const token = jwt.sign(
    { id: user.id, username: user.username, displayName: user.display_name, email: user.email, role: user.role, permissions: user.permissions || '{}', mustChangePassword: user.must_change_password === 1 },
    JWT_SECRET, { expiresIn: '8h' }
  );
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowLocal(), user.id);
  audit(db, { userId: user.id, username: user.username, action: 'CONNEXION_RÉUSSIE', category: 'auth', severity: 'info', detail: `Depuis ${ip}`, ip, success: 1 });
  res.json({ token, mustChangePassword: user.must_change_password === 1 });
});

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (!newPassword || newPassword.length < 14)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 14 caractères' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    audit(db, { userId: req.user.id, username: req.user.username, action: 'CHANGEMENT_MDP_ÉCHEC', category: 'auth', severity: 'warn', detail: 'Mot de passe actuel incorrect', ip, success: 0 });
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }
  // Interdire de remettre l'ancien mot de passe
  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Le nouveau mot de passe ne peut pas etre identique au precedent' });
  }
  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`).run(hash, nowLocal(), req.user.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'CHANGEMENT_MDP', category: 'auth', severity: 'info', detail: 'Mot de passe modifié avec succès', ip, success: 1 });
  res.json({ success: true });
});

// ── ADMINISTRATION : MON COMPTE ────────────────────────────────────────────────
app.get('/api/account', authMiddleware, (req, res) => {
  const user = getDb().prepare('SELECT id, username, display_name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.put('/api/account', authMiddleware, (req, res) => {
  const { display_name, username, email } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (!username) return res.status(400).json({ error: 'Identifiant requis' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
  if (existing) return res.status(400).json({ error: 'Cet identifiant est déjà utilisé' });
  db.prepare(`UPDATE users SET username = ?, display_name = ?, email = ?, updated_at = ? WHERE id = ?`).run(username, display_name, email || null, nowLocal(), req.user.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'PROFIL_MODIFIÉ', category: 'admin', severity: 'info', detail: `Nouveau username: ${username}`, ip, success: 1 });
  res.json({ success: true });
});

// ── ADMINISTRATION : UTILISATEURS ─────────────────────────────────────────────
app.get('/api/users/admin-count', authMiddleware, requireRole('admin'), (req, res) => {
  const count = getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND enabled=1").get().c;
  res.json({ count });
});

app.get('/api/users', authMiddleware, requireRole('admin'), (req, res) => {
  const rows = getDb().prepare('SELECT id, username, display_name, email, role, permissions, enabled, last_login_at, created_at, updated_at FROM users ORDER BY id').all();
  res.json(rows);
});

app.post('/api/users', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, display_name, email, password, role, permissions } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  if (password.length < 14) return res.status(400).json({ error: 'Mot de passe: 14 caractères minimum' });
  const hash = bcrypt.hashSync(password, 12);
  const r = db.prepare(`INSERT INTO users (username, display_name, email, password_hash, must_change_password, role, permissions) VALUES (?,?,?,?,1,?,?)`).run(username, display_name || username, email || null, hash, role || 'viewer', JSON.stringify(permissions || {}));
  audit(db, { userId: req.user.id, username: req.user.username, action: 'UTILISATEUR_CRÉÉ', category: 'admin', severity: 'info', detail: `Nouvel utilisateur: ${username} (${role})`, ip, success: 1 });
  res.json({ id: r.lastInsertRowid, username, role });
});

app.put('/api/users/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, display_name, email, role, permissions, enabled, password } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (password) {
    if (password.length < 14) return res.status(400).json({ error: 'Mot de passe: 14 caractères minimum' });
    const hash = bcrypt.hashSync(password, 12);
    db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?`).run(hash, nowLocal(), req.params.id);
  }
  // Vérifier qu'on ne désactive pas/ne rétrograde pas le dernier admin actif
  const targetUser = db.prepare('SELECT role, enabled FROM users WHERE id = ?').get(req.params.id);
  if (targetUser?.role === 'admin') {
    const willBeAdminAndActive = (role === 'admin') && enabled;
    if (!willBeAdminAndActive) {
      const otherAdminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND enabled=1 AND id != ?").get(req.params.id).c;
      if (otherAdminCount < 1) return res.status(400).json({ error: 'Impossible de désactiver ou rétrograder le seul administrateur actif' });
    }
  }
  db.prepare(`UPDATE users SET username = ?, display_name = ?, email = ?, role = ?, permissions = ?, enabled = ?, updated_at = ? WHERE id = ?`).run(username, display_name, email || null, role, JSON.stringify(permissions || {}), enabled ? 1 : 0, nowLocal(), req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'UTILISATEUR_MODIFIÉ', category: 'admin', severity: 'info', detail: `User ID ${req.params.id}: ${username}`, ip, success: 1 });
  res.json({ success: true });
});

app.delete('/api/users/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const ip = getClientIp(req);
  const db = getDb();
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  // Vérifier si c'est le dernier admin actif
  const target = db.prepare('SELECT username, role, enabled FROM users WHERE id = ?').get(targetId);
  if (target?.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND enabled=1").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Impossible de supprimer le seul administrateur actif' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'UTILISATEUR_SUPPRIMÉ', category: 'admin', severity: 'warn', detail: `Suppression: ${target?.username}`, ip, success: 1 });
  res.json({ success: true });
});

// ── ADMINISTRATION : WHITELIST ─────────────────────────────────────────────────
app.get('/api/whitelist', authMiddleware, requireRole('admin'), (req, res) => {
  const rows = getDb().prepare('SELECT * FROM whitelist ORDER BY id DESC').all();
  res.json(rows.map(r => ({ id: r.id, value: decrypt(r.value_enc), label: decrypt(r.label_enc), type: r.type, enabled: r.enabled, created_at: r.created_at })));
});

app.post('/api/whitelist', authMiddleware, requireRole('admin'), (req, res) => {
  const { value, label, type } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (!value) return res.status(400).json({ error: 'Valeur requise' });
  const r = db.prepare('INSERT INTO whitelist (value_enc, label_enc, type) VALUES (?,?,?)').run(encrypt(value), encrypt(label || value), type || 'ip');
  audit(db, { userId: req.user.id, username: req.user.username, action: 'WHITELIST_AJOUT', category: 'admin', severity: 'info', detail: `${type}: ${value}`, ip, success: 1 });
  res.json({ id: r.lastInsertRowid, value, label, type });
});

app.put('/api/whitelist/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { value, label, type, enabled } = req.body;
  getDb().prepare(`UPDATE whitelist SET value_enc=?, label_enc=?, type=?, enabled=? WHERE id=?`).run(encrypt(value), encrypt(label), type, enabled ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/whitelist/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const ip = getClientIp(req);
  const db = getDb();
  const row = db.prepare('SELECT value_enc FROM whitelist WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM whitelist WHERE id = ?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'WHITELIST_SUPPRESSION', category: 'admin', severity: 'warn', detail: decrypt(row?.value_enc), ip, success: 1 });
  res.json({ success: true });
});



// ── LOGGER ─────────────────────────────────────────────────────────────────────
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL_NUM = LEVELS[LOG_LEVEL] ?? 1;

function log(level, ...args) {
  if ((LEVELS[level] ?? 1) < LOG_LEVEL_NUM) return;
  const ts = nowLocal(); // heure locale (respecte TZ du conteneur)
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}]`;
  if (level === 'error') console.error(prefix, ...args);
  else console.log(prefix, ...args);
}

const logger = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
};


// ── SMTP CONFIGURATION ────────────────────────────────────────────────────────
app.get('/api/smtp/config', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='smtp_config'").get();
  if (!row) return res.json({ host: '', port: 587, secure: false, user: '', from: '', app_url: '' });
  try { res.json(JSON.parse(row.value)); } catch { res.json({}); }
});

app.put('/api/smtp/config', authMiddleware, requireRole('admin'), (req, res) => {
  const { host, port, secure, user, pass, from, app_url } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  const cfg = { host: host || '', port: parseInt(port) || 587, secure: !!secure, user: user || '', pass: pass || '', from: from || '', app_url: app_url || '' };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('smtp_config', ?)").run(JSON.stringify(cfg));
  // Mettre à jour les variables d'environnement en mémoire
  if (host) { process.env.SMTP_HOST = host; process.env.SMTP_PORT = String(cfg.port); process.env.SMTP_SECURE = String(cfg.secure); process.env.SMTP_USER = user || ''; process.env.SMTP_PASS = pass || ''; process.env.SMTP_FROM = cfg.from || 'NexusVault <no-reply@nexusvault.local>'; }
  if (app_url) process.env.APP_URL = app_url;
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SMTP_CONFIG_MODIFIÉ', category: 'admin', severity: 'info', detail: `SMTP host: ${host || '(vide)'}`, ip, success: 1 });
  res.json({ success: true });
});

app.post('/api/smtp/test', authMiddleware, requireRole('admin'), (req, res) => {
  const transport = getMailTransport();
  if (!transport) return res.status(400).json({ error: 'SMTP non configuré' });
  const db = getDb();
  const user = db.prepare('SELECT email FROM users WHERE id=?').get(req.user.id);
  if (!user?.email) return res.status(400).json({ error: 'Aucun email sur votre compte pour le test' });
  const from = process.env.SMTP_FROM || 'NexusVault <no-reply@nexusvault.local>';
  transport.sendMail({
    from, to: user.email,
    subject: 'NexusVault — Test SMTP',
    html: '<p>Test de configuration SMTP réussi !</p>',
  }).then(() => res.json({ success: true, to: user.email }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// ── RESET MOT DE PASSE PAR EMAIL ──────────────────────────────────────────────
const nodemailer = require('nodemailer');
const crypto     = require('crypto');

function getMailTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT   || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || '',
    } : undefined,
  });
}

// POST /api/auth/forgot-password — demande de reset
app.post('/api/auth/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Identifiant requis' });
  const db   = getDb();
  const user = db.prepare("SELECT id, username, email FROM users WHERE username = ? AND enabled = 1").get(username);

  // Toujours répondre OK (sécurité — ne pas révéler si le compte existe)
  if (!user) return res.json({ success: true });

  // Générer le token même si pas d'email (log dans les conteneur)

  const token   = crypto.randomBytes(32).toString('hex');
  // Calculer l'expiration en heure locale (nowLocal + 1h)
  const nowStr  = nowLocal(); // "YYYY-MM-DD HH:MM:SS" en heure locale
  const nowMs   = new Date(nowStr.replace(' ', 'T') + 'Z').getTime() || Date.now();
  // Utiliser directement une date locale : prendre nowLocal et ajouter 3600s
  const localNow = new Date();
  const localExp = new Date(localNow.getTime() + 10 * 60 * 1000); // 10 minutes
  // Formater en heure locale via la même méthode que nowLocal()
  const pad = n => String(n).padStart(2, '0');
  const expStr = `${localExp.getFullYear()}-${pad(localExp.getMonth()+1)}-${pad(localExp.getDate())} ${pad(localExp.getHours())}:${pad(localExp.getMinutes())}:${pad(localExp.getSeconds())}`;
  db.prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at, used, created_at) VALUES (?,?,?,0,?)")
    .run(user.id, token, expStr, nowLocal());

  const appUrl  = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const transport = getMailTransport();
  // Toujours logger le lien (utile pour debug et pour comptes sans email)
  logger.info(`[RESET] Lien de réinitialisation pour "${username}": ${resetUrl}`);

  if (!transport || !user.email) {
    if (!transport) logger.warn('[RESET] SMTP non configuré — lien disponible dans les logs ci-dessus');
    if (!user.email) logger.warn(`[RESET] Aucun email configuré pour "${username}" — lien disponible dans les logs ci-dessus`);
    audit(db, {
      username: user.username, action: 'RESET_DEMANDÉ', category: 'auth', severity: 'info',
      detail: `Demande de réinitialisation — identifiant: ${user.username} — email: ${user.email || 'non renseigné'} — lien dans les logs`,
      ip: getClientIp(req), success: 1
    });
    return res.json({ success: true });
  }

  const from = process.env.SMTP_FROM || 'NexusVault <no-reply@nexusvault.local>';
  transport.sendMail({
    from, to: user.email,
    subject: 'NexusVault — Réinitialisation de votre mot de passe',
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:32px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#0d47a1,#26c6da);padding:28px 32px">
    <div style="color:white;font-size:22px;font-weight:800;letter-spacing:1px">NEXUS<span style="opacity:.7">VAULT</span></div>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#1e293b;margin:0 0 12px;font-size:18px">Réinitialisation du mot de passe</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">Bonjour <strong>${user.username}</strong>,<br><br>
    Vous avez demandé la réinitialisation de votre mot de passe NexusVault. Cliquez sur le bouton ci-dessous.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#1976d2;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px">Réinitialiser mon mot de passe</a>
    <p style="color:#94a3b8;font-size:11px;margin:20px 0 0">Ce lien est valable <strong>10 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    <p style="color:#cbd5e1;font-size:10px;margin:8px 0 0;word-break:break-all">${resetUrl}</p>
  </div>
  <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8">
    NexusVault — Ne pas répondre à cet email
  </div>
</div></body></html>`,
  }).catch(err => logger.error('[RESET] Email error:', err.message));

  const ip = getClientIp(req);
  audit(db, { username: user.username, action: 'RESET_DEMANDÉ', category: 'auth', severity: 'info', detail: `Demande de reset — email: ${user.email}`, ip, success: 1 });
  res.json({ success: true });
});

// POST /api/auth/reset-password — validation du token et changement
app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Paramètres manquants' });
  if (password.length < 14) return res.status(400).json({ error: '14 caractères minimum' });
  const db   = getDb();
  const now  = nowLocal();
  const row  = db.prepare("SELECT * FROM password_reset_tokens WHERE token=? AND used=0 AND expires_at > ?").get(token, now);
  if (!row) return res.status(400).json({ error: 'Lien invalide ou expiré' });

  const bcrypt = require('bcryptjs');
  const hash   = bcrypt.hashSync(password, 12);
  db.prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?").run(hash, row.user_id);
  db.prepare("UPDATE password_reset_tokens SET used=1 WHERE id=?").run(row.id);

  const user = db.prepare("SELECT username FROM users WHERE id=?").get(row.user_id);
  const ip   = getClientIp(req);
  audit(db, { username: user?.username, action: 'RESET_EFFECTUÉ', category: 'auth', severity: 'info', detail: 'Mot de passe réinitialisé via lien email', ip, success: 1 });
  res.json({ success: true });
});

// GET /api/auth/reset-token-valid — vérifier la validité d'un token
app.get('/api/auth/reset-token-valid', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false });
  const db  = getDb();
  const now = nowLocal();
  const row = db.prepare("SELECT id FROM password_reset_tokens WHERE token=? AND used=0 AND expires_at > ?").get(token, now);
  res.json({ valid: !!row });
});

// ── ADMINISTRATION : AUDIT ────────────────────────────────────────────────────
app.get('/api/audit', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    try { const perms = JSON.parse(req.user.permissions || '{}'); if (!perms.audit_access) return res.status(403).json({ error: 'Accès refusé' }); } catch { return res.status(403).json({ error: 'Accès refusé' }); }
  }
  const { limit = 200, category, severity, success } = req.query;
  let q = 'SELECT * FROM audit_log WHERE 1=1';
  const p = [];
  if (category) { q += ' AND category = ?'; p.push(category); }
  if (severity) { q += ' AND severity = ?'; p.push(severity); }
  if (success !== undefined && success !== '') { q += ' AND success = ?'; p.push(parseInt(success)); }
  q += ' ORDER BY id DESC LIMIT ?';
  p.push(parseInt(limit));
  res.json(getDb().prepare(q).all(...p));
});



// ── CRON SMTP CHECK (toutes les 2h) ───────────────────────────────────────────
setInterval(() => {
  if (!process.env.SMTP_HOST) {
    logger.warn('[API] SMTP non configuré — les emails de réinitialisation ne seront pas envoyés');
  }
}, 2 * 60 * 60 * 1000); // 2 heures

// ── AUDIT : ARCHIVAGE AUTOMATIQUE (fonction partagée) ─────────────────────────
function archiveMonth(db, year, month, archivedBy) {
  const yr = String(year), mo = String(month).padStart(2, '0');
  const rows = db.prepare(
    "SELECT * FROM audit_log WHERE strftime('%Y', created_at)=? AND strftime('%m', created_at)=? ORDER BY id ASC"
  ).all(yr, mo);
  if (rows.length === 0) return { skipped: true };
  const now = (() => { const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; })();
  db.prepare("INSERT OR REPLACE INTO audit_archives (year, month, entry_count, data_json, archived_at, archived_by) VALUES (?,?,?,?,?,?)")
    .run(parseInt(yr), parseInt(mo), rows.length, JSON.stringify(rows), now, archivedBy);
  db.prepare("DELETE FROM audit_log WHERE strftime('%Y', created_at)=? AND strftime('%m', created_at)=?").run(yr, mo);
  audit(db, { username: archivedBy, action: 'AUDIT_ARCHIVE_AUTO', category: 'admin', severity: 'info', detail: `Archive ${yr}/${mo} — ${rows.length} entree(s)`, ip: '127.0.0.1', success: 1 });
  return { year: yr, month: mo, count: rows.length };
}

// ── AUDIT : CRON MENSUEL CONFIGURABLE ─────────────────────────────────────────
const cronState = { lastRun: null, lastResult: null, nextRun: null };

function getCronConfig(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key='cron_archive_time'").get();
  if (row) {
    try {
      const val = JSON.parse(row.value);
      return { hour: parseInt(val.hour ?? 0), minute: parseInt(val.minute ?? 5) };
    } catch {}
  }
  return { hour: 0, minute: 5 }; // défaut : 00h05
}

function getNextRunInfo(hour, minute) {
  // Calculer le prochain 1er du mois en heure locale (via nowLocal)
  const localStr = nowLocal();
  const year  = parseInt(localStr.slice(0, 4));
  const month = parseInt(localStr.slice(5, 7));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${nextYear}-${String(nextMonth).padStart(2,'0')}-01 ${hh}:${mm}`;
}

function scheduleMonthlyCron() {
  function runIfNeeded() {
    // Utiliser nowLocal() pour que l'heure respecte le TZ du conteneur
    const localStr = nowLocal(); // format: "YYYY-MM-DD HH:MM:SS"
    const localDay     = parseInt(localStr.slice(8, 10));
    const localHour    = parseInt(localStr.slice(11, 13));
    const localMinute  = parseInt(localStr.slice(14, 16));
    const db = getDb();
    const cfg = getCronConfig(db);
    cronState.nextRun = getNextRunInfo(cfg.hour, cfg.minute);

    if (localDay === 1 && localHour === cfg.hour && localMinute >= cfg.minute) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year  = prevMonth.getFullYear();
      const month = prevMonth.getMonth() + 1;
      const alreadyDone = db.prepare('SELECT id FROM audit_archives WHERE year=? AND month=?').get(year, month);
      if (!alreadyDone) {
        const result = archiveMonth(db, year, month, 'cron');
        if (!result.skipped) {
          cronState.lastRun    = nowLocal();
          cronState.lastResult = `Archive ${year}/${String(month).padStart(2,'0')} — ${result.count} entrées`;
          logger.info(`[CRON] ${cronState.lastResult}`);
        }
      }
    }
  }
  setInterval(runIfNeeded, 60 * 1000);
  runIfNeeded(); // calcul initial du nextRun
  logger.info('[CRON] Archivage mensuel audit planifié');
}
scheduleMonthlyCron();

// Status du cron + config
app.get('/api/cron/status', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const cfg = getCronConfig(db);
  res.json({
    hour:       cfg.hour,
    minute:     cfg.minute,
    next_run:   cronState.nextRun,
    last_run:   cronState.lastRun,
    last_result: cronState.lastResult,
    running:    true,
  });
});

app.put('/api/cron/config', authMiddleware, requireRole('admin'), (req, res) => {
  const { hour, minute } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('cron_archive_time', ?)")
    .run(JSON.stringify({ hour: parseInt(hour ?? 0), minute: parseInt(minute ?? 5) }));
  cronState.nextRun = getNextRunInfo(parseInt(hour ?? 0), parseInt(minute ?? 5));
  audit(db, { userId: req.user.id, username: req.user.username, action: 'CRON_CONFIG_MODIFIÉ', category: 'admin', severity: 'info', detail: `Cron archivage: ${String(hour).padStart(2,'0')}h${String(minute).padStart(2,'0')}`, ip, success: 1 });
  res.json({ success: true, next_run: cronState.nextRun });
});

// ── AUDIT : ENDPOINTS ─────────────────────────────────────────────────────────
// Lister les archives disponibles
app.get('/api/audit/archives', authMiddleware, (req, res) => {
  const { can } = require('./auth');
  const db = getDb();
  const rows = db.prepare('SELECT id, year, month, entry_count, archived_at, archived_by FROM audit_archives ORDER BY year DESC, month DESC').all();
  res.json(rows);
});

// Lire le contenu d'une archive
app.get('/api/audit/archives/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM audit_archives WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Archive introuvable' });
  let entries = [];
  try { entries = JSON.parse(row.data_json); } catch {}
  res.json({ ...row, entries });
});

// ── SITES ─────────────────────────────────────────────────────────────────────
app.get('/api/sites', authMiddleware, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM sites ORDER BY rowid DESC').all();
  const db = getDb();
  res.json(rows.map(r => ({
    id: r.id, name: decrypt(r.name_enc), location: decrypt(r.location_enc),
    contact: decrypt(r.contact_enc), description: decrypt(r.description_enc),
    created_at: r.created_at,
    device_count: db.prepare('SELECT COUNT(*) as c FROM devices WHERE site_id = ?').get(r.id).c
  })));
});

app.post('/api/sites', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, location, contact, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const r = getDb().prepare('INSERT INTO sites (name_enc, location_enc, contact_enc, description_enc) VALUES (?,?,?,?)').run(encrypt(name), encrypt(location), encrypt(contact), encrypt(description));
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'SITE_CRÉÉ', category: 'config', severity: 'info', detail: name, ip: getClientIp(req), success: 1 });
  res.json({ id: r.lastInsertRowid, name, location, contact, description });
});

app.put('/api/sites/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, location, contact, description } = req.body;
  getDb().prepare(`UPDATE sites SET name_enc=?, location_enc=?, contact_enc=?, description_enc=?, updated_at=? WHERE id=?`).run(encrypt(name), encrypt(location), encrypt(contact), encrypt(description), nowLocal(), req.params.id);
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'SITE_MODIFIÉ', category: 'config', severity: 'info', detail: name, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

app.delete('/api/sites/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  getDb().prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'SITE_SUPPRIMÉ', category: 'config', severity: 'warn', detail: `ID ${req.params.id}`, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

// ── MODELS ────────────────────────────────────────────────────────────────────
app.get('/api/models', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM device_models ORDER BY rowid DESC').all();
  res.json(rows.map(r => ({
    id: r.id, vendor: decrypt(r.vendor_enc), model: decrypt(r.model_enc),
    device_type: decrypt(r.device_type_enc), backup_method: decrypt(r.backup_method_enc),
    backup_command: decrypt(r.backup_command_enc), created_at: r.created_at,
    device_count: db.prepare('SELECT COUNT(*) as c FROM devices WHERE model_id = ?').get(r.id).c
  })));
});

app.post('/api/models', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { vendor, model, device_type, backup_method, backup_command } = req.body;
  if (!vendor || !model) return res.status(400).json({ error: 'Constructeur et modèle requis' });
  const r = getDb().prepare('INSERT INTO device_models (vendor_enc, model_enc, device_type_enc, backup_method_enc, backup_command_enc) VALUES (?,?,?,?,?)').run(encrypt(vendor), encrypt(model), encrypt(device_type), encrypt(backup_method || 'SSH'), encrypt(backup_command));
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'MODÈLE_CRÉÉ', category: 'config', severity: 'info', detail: `${vendor} ${model}`, ip: getClientIp(req), success: 1 });
  res.json({ id: r.lastInsertRowid, vendor, model, device_type, backup_method, backup_command });
});

app.put('/api/models/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { vendor, model, device_type, backup_method, backup_command } = req.body;
  getDb().prepare(`UPDATE device_models SET vendor_enc=?, model_enc=?, device_type_enc=?, backup_method_enc=?, backup_command_enc=?, updated_at=? WHERE id=?`).run(encrypt(vendor), encrypt(model), encrypt(device_type), encrypt(backup_method), encrypt(backup_command), nowLocal(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/models/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  getDb().prepare('DELETE FROM device_models WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── DEVICES ───────────────────────────────────────────────────────────────────
app.get('/api/devices', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT d.*, s.name_enc as site_name_enc, m.model_enc as model_name_enc, m.vendor_enc, m.backup_method_enc, m.backup_command_enc, m.device_type_enc FROM devices d LEFT JOIN sites s ON d.site_id=s.id LEFT JOIN device_models m ON d.model_id=m.id ORDER BY d.rowid DESC`).all();
  res.json(rows.map(r => {
    const lb = db.prepare('SELECT version, created_at, status FROM backups WHERE device_id = ? ORDER BY version DESC LIMIT 1').get(r.id);
    return { id: r.id, site_id: r.site_id, model_id: r.model_id, name: decrypt(r.name_enc), ip: decrypt(r.ip_enc), ssh_port: decrypt(r.ssh_port_enc), ssh_user: decrypt(r.ssh_user_enc), enabled: r.enabled, site_name: decrypt(r.site_name_enc), model_name: decrypt(r.model_name_enc), vendor: decrypt(r.vendor_enc), device_type: decrypt(r.device_type_enc), backup_method: decrypt(r.backup_method_enc), backup_command: decrypt(r.backup_command_enc), last_backup: lb || null, created_at: r.created_at };
  }));
});

app.post('/api/devices', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, site_id, model_id, ip, ssh_port, ssh_user, ssh_password } = req.body;
  if (!name || !site_id || !model_id || !ip) return res.status(400).json({ error: 'Champs requis manquants' });
  const allDevices = getDb().prepare('SELECT name_enc, ip_enc FROM devices').all();
  if (allDevices.some(d => (decrypt(d.name_enc) || '').toLowerCase() === name.toLowerCase()))
    return res.status(400).json({ error: `Le nom "${name}" est déjà utilisé (insensible à la casse)` });
  if (allDevices.some(d => decrypt(d.ip_enc) === ip))
    return res.status(400).json({ error: `L'adresse IP ${ip} est déjà utilisée par un autre équipement` });
  const r = getDb().prepare('INSERT INTO devices (name_enc, site_id, model_id, ip_enc, ssh_port_enc, ssh_user_enc, ssh_password_enc) VALUES (?,?,?,?,?,?,?)').run(encrypt(name), site_id, model_id, encrypt(ip), encrypt(ssh_port || '22'), encrypt(ssh_user), encrypt(ssh_password));
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'ÉQUIPEMENT_CRÉÉ', category: 'config', severity: 'info', detail: `${name} (${ip})`, ip: getClientIp(req), success: 1 });
  res.json({ id: r.lastInsertRowid, name, site_id, model_id, ip });
});

app.put('/api/devices/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, site_id, model_id, ip, ssh_port, ssh_user, ssh_password, enabled } = req.body;
  // Vérifier unicité IP en excluant l'équipement courant
  const otherDevices = getDb().prepare('SELECT id, name_enc, ip_enc FROM devices WHERE id != ?').all(req.params.id);
  if (otherDevices.some(d => (decrypt(d.name_enc) || '').toLowerCase() === name.toLowerCase()))
    return res.status(400).json({ error: `Le nom "${name}" est déjà utilisé (insensible à la casse)` });
  if (otherDevices.some(d => decrypt(d.ip_enc) === ip))
    return res.status(400).json({ error: `L'adresse IP ${ip} est déjà utilisée par un autre équipement` });
  getDb().prepare(`UPDATE devices SET name_enc=?, site_id=?, model_id=?, ip_enc=?, ssh_port_enc=?, ssh_user_enc=?, ssh_password_enc=?, enabled=?, updated_at=? WHERE id=?`).run(encrypt(name), site_id, model_id, encrypt(ip), encrypt(ssh_port || '22'), encrypt(ssh_user), encrypt(ssh_password), enabled ? 1 : 0, nowLocal(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/devices/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  getDb().prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── BACKUPS ───────────────────────────────────────────────────────────────────
app.get('/api/backups', authMiddleware, (req, res) => {
  const db = getDb();
  const { device_id, site_id } = req.query;
  let q = `SELECT b.*, d.name_enc as device_name_enc, s.name_enc as site_name_enc, m.model_enc FROM backups b LEFT JOIN devices d ON b.device_id=d.id LEFT JOIN sites s ON d.site_id=s.id LEFT JOIN device_models m ON d.model_id=m.id`;
  const p = [];
  if (device_id) { q += ' WHERE b.device_id = ?'; p.push(device_id); }
  else if (site_id) { q += ' WHERE d.site_id = ?'; p.push(site_id); }
  q += ' ORDER BY b.created_at DESC LIMIT 100';
  res.json(db.prepare(q).all(...p).map(r => ({ id: r.id, device_id: r.device_id, version: r.version, size_bytes: r.size_bytes, status: r.status, pinned: r.pinned || 0, note: decrypt(r.note_enc), device_name: decrypt(r.device_name_enc), site_name: decrypt(r.site_name_enc), model: decrypt(r.model_enc), triggered_by: r.triggered_by, created_at: r.created_at })));
});

app.get('/api/backups/:id/content', authMiddleware, (req, res) => {
  const row = getDb().prepare('SELECT content_enc FROM backups WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Non trouvé' });
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'BACKUP_LU', category: 'backup', severity: 'info', detail: `Backup ID ${req.params.id}`, ip: getClientIp(req), success: 1 });
  res.json({ content: decrypt(row.content_enc) });
});


// ── BACKUP : UPLOAD FICHIER TEXTE ─────────────────────────────────────────────
app.post('/api/backups/upload', authMiddleware, requirePerm('backup_write'), (req, res) => {
  const { device_id, content, note } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id requis' });
  if (!content || typeof content !== 'string' || content.trim().length < 5)
    return res.status(400).json({ error: 'Contenu vide ou trop court' });
  const db = getDb();
  const ip = getClientIp(req);
  const deviceRow = db.prepare('SELECT name_enc FROM devices WHERE id = ?').get(device_id);
  if (!deviceRow) return res.status(404).json({ error: 'Equipement introuvable' });
  const deviceName = decrypt(deviceRow.name_enc);
  const last    = db.prepare('SELECT MAX(version) as v FROM backups WHERE device_id = ?').get(device_id);
  const version = (last.v || 0) + 1;
  const r = db.prepare(
    'INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc, triggered_by) VALUES (?,?,?,?,?,?,?)'
  ).run(device_id, version, encrypt(content), content.length, 'ok', encrypt(note || 'Upload manuel'), 'upload');
  audit(db, { userId: req.user.id, username: req.user.username, action: 'BACKUP_UPLOADE', category: 'backup', severity: 'info', detail: `${deviceName} v${version}`, ip, success: 1 });
  res.json({ id: r.lastInsertRowid, version, status: 'ok' });
});

app.post('/api/backups/trigger', authMiddleware, requirePerm('backup_write'), async (req, res) => {
  const { device_id, note } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id requis' });
  const db = getDb();
  const ip = getClientIp(req);

  // Récupérer l'équipement et son modèle
  const deviceRow = db.prepare(`
    SELECT d.*, m.backup_method_enc, m.backup_command_enc
    FROM devices d
    LEFT JOIN device_models m ON d.model_id = m.id
    WHERE d.id = ?
  `).get(device_id);

  if (!deviceRow) return res.status(404).json({ error: 'Équipement introuvable' });

  const deviceName = decrypt(deviceRow.name_enc);
  const deviceIp   = decrypt(deviceRow.ip_enc);
  const sshPort    = decrypt(deviceRow.ssh_port_enc) || '22';
  const sshUser    = decrypt(deviceRow.ssh_user_enc);
  const sshPass    = decrypt(deviceRow.ssh_password_enc);
  const method     = decrypt(deviceRow.backup_method_enc) || 'SSH';
  const command    = decrypt(deviceRow.backup_command_enc) || 'show running-config';

  const last    = db.prepare('SELECT MAX(version) as v FROM backups WHERE device_id = ?').get(device_id);
  const version = (last.v || 0) + 1;

  let content = '';
  let status  = 'ok';
  let errorMsg = '';

  if (method === 'SSH') {
    try {
      content = await sshExec({
        host: deviceIp,
        port: parseInt(sshPort, 10) || 22,
        username: sshUser,
        password: sshPass,
        command,
        timeout: 45000,
      });

      if (!content || content.trim().length < 10) {
        throw new Error('Sortie SSH vide ou trop courte');
      }
    } catch (err) {
      status   = 'error';
      errorMsg = err.message;
      content  = `! ERREUR BACKUP SSH — ${new Date().toISOString()}\n! Équipement : ${deviceName} (${deviceIp}:${sshPort})\n! Commande   : ${command}\n! Erreur     : ${err.message}\n`;
      audit(db, { userId: req.user.id, username: req.user.username, action: 'BACKUP_ÉCHEC', category: 'backup', severity: 'warn', detail: `${deviceName}: ${err.message}`, ip, success: 0 });
    }
  } else {
    // Méthode non SSH (TFTP, SCP, API) — stub pour future implémentation
    content  = `! Méthode ${method} non encore implémentée\n! Équipement : ${deviceName} (${deviceIp})\n! Date       : ${new Date().toISOString()}\n`;
    status   = 'warn';
    errorMsg = `Méthode ${method} non supportée`;
  }

  const r = db.prepare(
    'INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc, triggered_by) VALUES (?,?,?,?,?,?,?)'
  ).run(device_id, version, encrypt(content), content.length, status, encrypt(note || ''), req.user.username);

  audit(db, { userId: req.user.id, username: req.user.username, action: 'BACKUP_DÉCLENCHÉ', category: 'backup', severity: status === 'ok' ? 'info' : 'warn', detail: `${deviceName} v${version} [${status}]${errorMsg ? ': ' + errorMsg : ''}`, ip, success: status === 'ok' ? 1 : 0 });

  if (status === 'error') {
    return res.status(502).json({ error: errorMsg, version, id: r.lastInsertRowid });
  }
  res.json({ id: r.lastInsertRowid, version, status });
});


// ── BACKUP : PIN / UNPIN ──────────────────────────────────────────────────────
app.patch('/api/backups/:id/pin', authMiddleware, requirePerm('backup_write'), (req, res) => {
  const db = getDb();
  const backup = db.prepare('SELECT id, pinned, device_id FROM backups WHERE id = ?').get(req.params.id);
  if (!backup) return res.status(404).json({ error: 'Backup introuvable' });
  const newPinned = backup.pinned ? 0 : 1;
  db.prepare('UPDATE backups SET pinned = ? WHERE id = ?').run(newPinned, req.params.id);
  audit(db, {
    userId: req.user.id, username: req.user.username,
    action: newPinned ? 'BACKUP_ÉPINGLÉ' : 'BACKUP_DÉSÉPINGLÉ',
    category: 'backup', severity: 'info',
    detail: `Backup ID ${req.params.id}`, ip: getClientIp(req), success: 1
  });
  res.json({ id: parseInt(req.params.id), pinned: newPinned });
});


// ── BACKUP : SUPPRESSION (protégée si épinglée) ──────────────────────────────
app.delete('/api/backups/:id', authMiddleware, requirePerm('backup_write'), (req, res) => {
  const db = getDb();
  const backup = db.prepare('SELECT id, pinned, version FROM backups WHERE id = ?').get(req.params.id);
  if (!backup) return res.status(404).json({ error: 'Backup introuvable' });
  if (backup.pinned) return res.status(403).json({ error: 'Ce backup est épinglé. Désépinglez-le avant de le supprimer.' });
  db.prepare('DELETE FROM backups WHERE id = ?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'BACKUP_SUPPRIMÉ', category: 'backup', severity: 'warn', detail: `Backup ID ${req.params.id} v${backup.version}`, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

app.get('/api/backups/diff', authMiddleware, (req, res) => {
  const { id_a, id_b } = req.query;
  if (!id_a || !id_b) return res.status(400).json({ error: 'id_a et id_b requis' });
  const db = getDb();
  const a = db.prepare('SELECT b.*, d.name_enc FROM backups b LEFT JOIN devices d ON b.device_id=d.id WHERE b.id=?').get(id_a);
  const b = db.prepare('SELECT b.*, d.name_enc FROM backups b LEFT JOIN devices d ON b.device_id=d.id WHERE b.id=?').get(id_b);
  if (!a || !b) return res.status(404).json({ error: 'Version introuvable' });
  const linesA = decrypt(a.content_enc).split('\n');
  const linesB = decrypt(b.content_enc).split('\n');

  // Algorithme diff LCS basique
  const diff = [];
  let i = 0, j = 0;
  let added = 0, removed = 0;
  while (i < linesA.length || j < linesB.length) {
    if (i >= linesA.length) { diff.push({ type: 'add', line: linesB[j], lineB: j + 1 }); added++; j++; }
    else if (j >= linesB.length) { diff.push({ type: 'rem', line: linesA[i], lineA: i + 1 }); removed++; i++; }
    else if (linesA[i] === linesB[j]) { diff.push({ type: 'ctx', line: linesA[i], lineA: i + 1, lineB: j + 1 }); i++; j++; }
    else {
      // Cherche si la ligne A existe plus loin dans B (deletion) ou vice versa
      const lookAhead = 5;
      let foundInB = -1, foundInA = -1;
      for (let k = 1; k <= lookAhead; k++) {
        if (j + k < linesB.length && linesA[i] === linesB[j + k]) { foundInB = k; break; }
      }
      for (let k = 1; k <= lookAhead; k++) {
        if (i + k < linesA.length && linesA[i + k] === linesB[j]) { foundInA = k; break; }
      }
      if (foundInB !== -1 && (foundInA === -1 || foundInB <= foundInA)) {
        diff.push({ type: 'add', line: linesB[j], lineB: j + 1 }); added++; j++;
      } else if (foundInA !== -1) {
        diff.push({ type: 'rem', line: linesA[i], lineA: i + 1 }); removed++; i++;
      } else {
        diff.push({ type: 'rem', line: linesA[i], lineA: i + 1 }); removed++; i++;
        diff.push({ type: 'add', line: linesB[j], lineB: j + 1 }); added++; j++;
      }
    }
  }
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DIFF_CONSULTÉ', category: 'backup', severity: 'info', detail: `Backup ${id_a} vs ${id_b}`, ip: getClientIp(req), success: 1 });
  res.json({
    version_a: { id: a.id, version: a.version, created_at: a.created_at, device_name: decrypt(a.name_enc) },
    version_b: { id: b.id, version: b.version, created_at: b.created_at, device_name: decrypt(b.name_enc) },
    diff, added, removed
  });
});




// ── DROITS PAR RÔLE ────────────────────────────────────────────────────────────
// Droits par défaut intégrés (fallback si rien en base)
const DEFAULT_ROLE_PERMS = {
  admin:    { backup_read: true,  backup_import: true,  backup_write: true,  config_read: true,  config_write: true,  audit_access: true,  security_access: true,  activity_read: true,  activity_write: true,  activity_tags: true,  audit_archive: true  },
  operator: { backup_read: true,  backup_import: false, backup_write: true,  config_read: true,  config_write: false, audit_access: false, security_access: false, activity_read: true,  activity_write: true,  activity_tags: false, audit_archive: false },
  viewer:   { backup_read: true,  backup_import: false, backup_write: false, config_read: true,  config_write: false, audit_access: false, security_access: false, activity_read: true,  activity_write: false, activity_tags: false, audit_archive: false },
};

app.get('/api/role-permissions', authMiddleware, (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'role_permissions'").get();
  if (row) {
    try { return res.json(JSON.parse(row.value)); } catch {}
  }
  res.json(DEFAULT_ROLE_PERMS);
});

app.put('/api/role-permissions', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('role_permissions', ?)").run(JSON.stringify(req.body));
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DROITS_MODIFIÉS', category: 'admin', severity: 'warn', detail: 'Droits par rôle mis à jour', ip, success: 1 });
  res.json({ success: true });
});

// Endpoint public (sans auth) pour que le frontend lise les droits au login
app.get('/api/role-permissions/public', (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'role_permissions'").get();
  if (row) {
    try { return res.json(JSON.parse(row.value)); } catch {}
  }
  res.json(DEFAULT_ROLE_PERMS);
});

// ── PRÉFÉRENCES UTILISATEUR ────────────────────────────────────────────────────
app.get('/api/me/prefs', authMiddleware, (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(`user_prefs_${req.user.id}`);
  res.json(row ? JSON.parse(row.value) : {});
});

app.put('/api/me/prefs', authMiddleware, (req, res) => {
  const db = getDb();
  const key = `user_prefs_${req.user.id}`;
  const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  const current = existing ? JSON.parse(existing.value) : {};
  const merged = { ...current, ...req.body };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, JSON.stringify(merged));
  res.json({ success: true });
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
app.get('/api/settings', authMiddleware, requireRole('admin'), (req, res) => {
  const rows = getDb().prepare("SELECT key, value FROM settings WHERE key != 'initialized'").all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  // Valeur par défaut : 30 minutes
  if (!obj.session_timeout_minutes) obj.session_timeout_minutes = '30';
  res.json(obj);
});

app.put('/api/settings', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const allowed = ['session_timeout_minutes'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(req.body[key]));
    }
  }
  audit(db, { userId: req.user.id, username: req.user.username, action: 'PARAMÈTRES_MODIFIÉS', category: 'admin', severity: 'info', detail: JSON.stringify(req.body), ip, success: 1 });
  res.json({ success: true });
});

// Route publique : timeout de session (le frontend en a besoin sans être admin)
app.get('/api/settings/public', (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'session_timeout_minutes'").get();
  res.json({ session_timeout_minutes: row ? parseInt(row.value) : 30 });
});


// ── SUIVI D'ACTIVITÉ — TAGS ───────────────────────────────────────────────────
app.get('/api/activity/tags', authMiddleware, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM activity_tags ORDER BY code').all());
});

app.post('/api/activity/tags', authMiddleware, requireRole('admin'), (req, res) => {
  const { code, label, color } = req.body;
  if (!code || !label) return res.status(400).json({ error: 'Code et libellé requis' });
  const clean = code.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  try {
    const r = getDb().prepare('INSERT INTO activity_tags (code, label, color) VALUES (?, ?, ?)').run(clean, label, color || '#066fd1');
    res.json({ id: r.lastInsertRowid, code: clean, label, color });
  } catch { res.status(400).json({ error: 'Ce code existe déjà' }); }
});

app.put('/api/activity/tags/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { label, color } = req.body;
  getDb().prepare('UPDATE activity_tags SET label=?, color=? WHERE id=?').run(label, color, req.params.id);
  res.json({ success: true });
});

app.delete('/api/activity/tags/:id', authMiddleware, requireRole('admin'), (req, res) => {
  getDb().prepare('DELETE FROM activity_tags WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── SUIVI D'ACTIVITÉ — ENTRÉES ────────────────────────────────────────────────
app.get('/api/activity/entries', authMiddleware, (req, res) => {
  const db = getDb();
  const { user_id, year, month } = req.query;
  const targetUserId = (req.user.role === 'admin' && user_id) ? parseInt(user_id) : req.user.id;
  let q = 'SELECT e.*, u.username, u.display_name FROM activity_entries e JOIN users u ON e.user_id=u.id WHERE e.user_id=?';
  const p = [targetUserId];
  if (year)  { q += ' AND e.year=?';  p.push(parseInt(year));  }
  if (month) { q += ' AND e.month=?'; p.push(parseInt(month)); }
  q += ' ORDER BY e.year DESC, e.month ASC, e.created_at ASC';
  res.json(db.prepare(q).all(...p));
});

// Historique d'une note
app.get('/api/activity/entries/:id/history', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT user_id FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Introuvable' });
  if (entry.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès refusé' });
  const rows = db.prepare(
    'SELECT h.*, u.username FROM activity_entry_history h LEFT JOIN users u ON h.changed_by=u.id WHERE h.entry_id=? ORDER BY h.changed_at ASC'
  ).all(req.params.id);
  res.json(rows);
});

// Années disponibles pour un utilisateur
app.get('/api/activity/years', authMiddleware, (req, res) => {
  const db = getDb();
  const { user_id } = req.query;
  const targetUserId = (req.user.role === 'admin' && user_id) ? parseInt(user_id) : req.user.id;
  const rows = db.prepare('SELECT DISTINCT year FROM activity_entries WHERE user_id=? ORDER BY year DESC').all(targetUserId);
  res.json(rows.map(r => r.year));
});

app.post('/api/activity/entries', authMiddleware, (req, res) => {
  const { year, month, tag_code, content, is_preview } = req.body;
  if (!year || !month || !tag_code || !content?.trim())
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  const db = getDb();
  // Déterminer si la note est une preview (mois/année futur)
  const nowL = nowLocal();
  const curYear = parseInt(nowL.slice(0,4)), curMonth = parseInt(nowL.slice(5,7));
  const noteYear = parseInt(year), noteMonth = parseInt(month);
  const autoPreview = noteYear > curYear || (noteYear === curYear && noteMonth > curMonth);
  const previewFlag = autoPreview ? 1 : (is_preview ? 1 : 0);
  const r = db.prepare(
    'INSERT INTO activity_entries (user_id, year, month, tag_code, content, is_preview) VALUES (?,?,?,?,?,?)'
  ).run(req.user.id, noteYear, noteMonth, tag_code.toUpperCase(), content.trim(), previewFlag);
  const newId = r.lastInsertRowid;
  // Historique : création
  db.prepare('INSERT INTO activity_entry_history (entry_id, event_type, detail, changed_by, changed_at) VALUES (?,?,?,?,?)').run(newId, 'created', `[${tag_code.toUpperCase()}] ${content.trim().slice(0,80)}${content.length>80?'…':''}`, req.user.id, nowLocal());
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_AJOUTÉ', category: 'suivi', severity: 'info', detail: `${year}/${String(month).padStart(2,'0')} [${tag_code}]${previewFlag?' (preview)':''}`, ip: getClientIp(req), success: 1 });
  res.json({ id: newId, is_preview: previewFlag });
});

app.put('/api/activity/entries/:id', authMiddleware, (req, res) => {
  const { tag_code, content, is_preview } = req.body;
  const db = getDb();
  const entry = db.prepare('SELECT * FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Introuvable' });
  if (entry.user_id !== req.user.id)
    return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres notes' });
  const newPreview = is_preview === undefined ? entry.is_preview : (is_preview ? 1 : 0);
  db.prepare('UPDATE activity_entries SET tag_code=?, content=?, is_preview=?, updated_at=? WHERE id=?').run(tag_code.toUpperCase(), content.trim(), newPreview, nowLocal(), req.params.id);
  // Historique : modification
  const changes = [];
  if (entry.tag_code !== tag_code.toUpperCase()) changes.push(`Tag: ${entry.tag_code} → ${tag_code.toUpperCase()}`);
  if (entry.content !== content.trim()) changes.push('Contenu modifié');
  if (entry.is_preview !== newPreview) changes.push(newPreview ? 'Marqué preview' : 'Preview retirée (validée)');
  db.prepare('INSERT INTO activity_entry_history (entry_id, event_type, detail, changed_by, changed_at) VALUES (?,?,?,?,?)').run(parseInt(req.params.id), 'updated', changes.length ? changes.join(' | ') : 'Modification sans changement détecté', req.user.id, nowLocal());
  res.json({ success: true });
});

app.delete('/api/activity/entries/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT user_id FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Introuvable' });
  if (entry.user_id !== req.user.id)
    return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres notes' });
  db.prepare('DELETE FROM activity_entries WHERE id=?').run(req.params.id);
  res.json({ success: true });
});


// ── SUIVI D'ACTIVITÉ — AUDIT EXPORT ──────────────────────────────────────────
app.post('/api/activity/export-audit', authMiddleware, (req, res) => {
  const { mode, year, month, filterTag, count, target_user } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  let scope = '';
  if (mode === 'month') scope = `${MONTHS_FR[(month||1)-1]} ${year}`;
  else if (mode === 'year') scope = `Année ${year}`;
  else if (mode === 'tag') scope = `Tag ${filterTag || 'tous'}`;
  const targetId = parseInt(target_user) || req.user.id;
  const targetUser = targetId !== req.user.id ? db.prepare('SELECT username FROM users WHERE id=?').get(targetId) : null;
  const who = targetUser ? ` (suivi de ${targetUser.username})` : '';
  audit(db, {
    userId: req.user.id, username: req.user.username,
    action: 'SUIVI_EXPORTÉ',
    category: 'suivi', severity: 'info',
    detail: `Export PDF — ${scope} — ${count} note${count > 1 ? 's' : ''}${who}`,
    ip, success: 1
  });
  res.json({ success: true });
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const now = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const userId   = req.user.id;

  // Activité totale — exclure les notes preview (is_preview=0 ou null)
  const totalActivity = db.prepare('SELECT COUNT(*) as c FROM activity_entries WHERE user_id=? AND (is_preview=0 OR is_preview IS NULL)').get(userId).c;
  const yearActivity  = db.prepare('SELECT COUNT(*) as c FROM activity_entries WHERE user_id=? AND year=? AND (is_preview=0 OR is_preview IS NULL)').get(userId, curYear).c;
  const monthActivity = db.prepare('SELECT COUNT(*) as c FROM activity_entries WHERE user_id=? AND year=? AND month=? AND (is_preview=0 OR is_preview IS NULL)').get(userId, curYear, curMonth).c;
  const prevYear = curYear - 1;
  const yearActivityPrev = db.prepare('SELECT COUNT(*) as c FROM activity_entries WHERE user_id=? AND year=? AND (is_preview=0 OR is_preview IS NULL)').get(userId, prevYear).c;

  // TOP3 tags année courante (hors preview)
  const top3Cur = db.prepare(
    'SELECT tag_code, COUNT(*) as cnt FROM activity_entries WHERE user_id=? AND year=? AND (is_preview=0 OR is_preview IS NULL) GROUP BY tag_code ORDER BY cnt DESC LIMIT 3'
  ).all(userId, curYear);
  // TOP3 tags année précédente (hors preview)
  const top3Prev = db.prepare(
    'SELECT tag_code, COUNT(*) as cnt FROM activity_entries WHERE user_id=? AND year=? AND (is_preview=0 OR is_preview IS NULL) GROUP BY tag_code ORDER BY cnt DESC LIMIT 3'
  ).all(userId, prevYear);

  res.json({
    devices:       db.prepare('SELECT COUNT(*) as c FROM devices').get().c,
    sites:         db.prepare('SELECT COUNT(*) as c FROM sites').get().c,
    backups:       db.prepare('SELECT COUNT(*) as c FROM backups').get().c,
    models:        db.prepare('SELECT COUNT(*) as c FROM device_models').get().c,
    activity: {
      total:      totalActivity,
      year:       yearActivity,
      month:      monthActivity,
      prev_year:  prevYear,
      prev_year_count: yearActivityPrev,
      top3_cur:   top3Cur,
      top3_prev:  top3Prev,
      cur_year:   curYear,
      cur_month:  curMonth,
    }
  });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`[API] NexusVault backend démarré sur le port ${PORT}`);
  const db = getDb();
  // Charger la config SMTP depuis la base au démarrage
  const smtpRow = db.prepare("SELECT value FROM settings WHERE key='smtp_config'").get();
  if (smtpRow) {
    try {
      const cfg = JSON.parse(smtpRow.value);
      if (cfg.host) {
        process.env.SMTP_HOST    = cfg.host;
        process.env.SMTP_PORT    = String(cfg.port || 587);
        process.env.SMTP_SECURE  = String(cfg.secure || false);
        process.env.SMTP_USER    = cfg.user || '';
        process.env.SMTP_PASS    = cfg.pass || '';
        process.env.SMTP_FROM    = cfg.from || 'NexusVault <no-reply@nexusvault.local>';
        logger.info('[SMTP] Configuration chargée depuis la base de données');
      }
      if (cfg.app_url) process.env.APP_URL = cfg.app_url;
    } catch {}
  }
});
