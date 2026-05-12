require('dotenv').config();
const express = require('express');
const { sshExec } = require('./ssh');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
// Fenêtre de tolérance : ±2 intervalles de 30s = ±60s — compense les légères dérives d'horloge
authenticator.options = { window: 2 };
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { getDb, encrypt, decrypt, audit } = require('./db');
const { authMiddleware, requireRole, requirePerm, JWT_SECRET, getClientIp, checkWhitelist } = require('./auth');

// ── CLI : reset-password ────────────────────────────────────────────────────
// Usage : node server.js reset-password <username>
if (process.argv[2] === 'reset-password') {
  const username = process.argv[3];
  if (!username) {
    console.error('Usage: node server.js reset-password <username>');
    process.exit(1);
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
  if (!user) {
    console.error(`Utilisateur "${username}" introuvable.`);
    process.exit(1);
  }
  const hash = bcrypt.hashSync('changeme', 12);
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, locked_until = NULL, failed_attempts = 0 WHERE id = ?")
    .run(hash, user.id);
  // Supprimer les tokens de réinitialisation en attente
  try { db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id); } catch {}
  // Log console (visible dans docker logs nexusvault-backend)
  const _ts = new Date().toISOString();
  console.log(`[${_ts}] [RESET-PASSWORD] Mot de passe de "${username}" (id=${user.id}) réinitialisé via CLI. Changement obligatoire à la prochaine connexion.`);
  // Audit dans la base de données
  try {
    audit(db, {
      userId: user.id,
      username: user.username,
      action: 'MOT_DE_PASSE_RÉINITIALISÉ',
      category: 'admin',
      severity: 'warn',
      detail: `Réinitialisation CLI docker exec — mot de passe remis à "changeme"`,
      ip: 'LOCAL-CLI',
      success: 1,
    });
  } catch (auditErr) {
    console.warn('[RESET-PASSWORD] Impossible d\'écrire dans l\'audit:', auditErr.message);
  }
  console.log(`[${_ts}] [RESET-PASSWORD] Entrée ajoutée au journal d'audit.`);
  process.exit(0);
}


const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


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
// Brute force : 5 tentatives en 10 minutes → compte verrouillé
function getBruteConfig(db) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='brute_config'").get();
    if (row) {
      const v = JSON.parse(row.value);
      return { max: parseInt(v.max || 5), window: parseInt(v.window || 600) };
    }
  } catch {}
  return { max: 5, window: 600 };
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user) {
    // Vérifier si le compte est verrouillé
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until.replace(' ', 'T'));
      const nowMs = Date.now();
      if (lockedUntil.getTime() > nowMs) {
        const remaining = Math.ceil((lockedUntil.getTime() - nowMs) / 1000 / 60);
        audit(db, { userId: user.id, username, action: 'CONNEXION_BLOQUÉE', category: 'auth', severity: 'error', detail: `Compte verrouillé jusqu'à ${user.locked_until} (brute force depuis ${ip})`, ip, success: 0 });
        return res.status(423).json({ error: `Compte temporairement verrouillé. Réessayez dans ${remaining} minute${remaining > 1 ? 's' : ''}.` });
      } else {
        // Verrou expiré : réinitialiser
        db.prepare('UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=?').run(user.id);
      }
    }
  }

  const bruteConf = getBruteConfig(db);
  const BRUTE_MAX = bruteConf.max;
  const BRUTE_WINDOW = bruteConf.window;
  const pwOk = user && user.enabled && bcrypt.compareSync(password, user.password_hash);

  if (!pwOk) {
    if (user && user.enabled) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      if (newAttempts >= BRUTE_MAX) {
        // Calculer la date de déblocage en heure locale
        const lockExp = new Date(Date.now() + BRUTE_WINDOW * 1000);
        const pad = n => String(n).padStart(2,'0');
        const lockStr = `${lockExp.getFullYear()}-${pad(lockExp.getMonth()+1)}-${pad(lockExp.getDate())} ${pad(lockExp.getHours())}:${pad(lockExp.getMinutes())}:${pad(lockExp.getSeconds())}`;
        db.prepare('UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?').run(newAttempts, lockStr, user.id);
        // Notification compte verrouillé
        dispatch('account_locked', {
          datetime: nowLocal(), username, ip, attempts: newAttempts, locked_until: lockStr,
        }, getDb).catch(() => {});
        audit(db, { userId: user.id, username, action: 'COMPTE_VERROUILLÉ', category: 'auth', severity: 'error', detail: `${BRUTE_MAX} tentatives échouées depuis ${ip} — verrouillé jusqu'à ${lockStr}`, ip, success: 0 });
        logger.warn(`[AUTH] Compte "${username}" verrouillé jusqu'à ${lockStr} (${BRUTE_MAX} tentatives depuis ${ip})`);
        return res.status(423).json({ error: `Compte verrouillé pendant ${BRUTE_WINDOW / 60} minutes après ${BRUTE_MAX} tentatives échouées.` });
      } else {
        db.prepare('UPDATE users SET failed_attempts=? WHERE id=?').run(newAttempts, user.id);
        const remaining = BRUTE_MAX - newAttempts;
        // Notification seuil d'alerte (à 3 tentatives)
        if (newAttempts >= 3) {
          dispatch('login_failed_threshold', {
            datetime: nowLocal(), username, ip, attempts: newAttempts, threshold: 3,
          }, getDb).catch(() => {});
        }
        audit(db, { userId: user.id, username, action: 'CONNEXION_ÉCHEC', category: 'auth', severity: 'warn', detail: `Tentative ${newAttempts}/${BRUTE_MAX} depuis ${ip} (encore ${remaining} avant verrouillage)`, ip, success: 0 });
        return res.status(401).json({ error: `Identifiants incorrects. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage.` });
      }
    }
    audit(db, { username, action: 'CONNEXION_ÉCHEC', category: 'auth', severity: 'warn', detail: `Identifiant tenté: "${username}" depuis ${ip}`, ip, success: 0 });
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // Verifier TOTP si requis
  { const _ffRow=db.prepare("SELECT value FROM settings WHERE key='feature_flags'").get();
    const _ff=_ffRow?JSON.parse(_ffRow.value):{};
    if (_ff.totp_required) {
      if (user.totp_enabled) {
        const {totp_token}=req.body;
        if (!totp_token) return res.json({totp_required:true,totp_setup:false});
        if (!authenticator.verify({token:totp_token,secret:user.totp_secret})) {
          audit(db,{userId:user.id,username:user.username,action:'TOTP_ECHEC',category:'auth',severity:'warn',detail:'Code TOTP invalide depuis '+ip,ip,success:0});
          return res.status(401).json({error:'Code TOTP invalide'});
        }
      } else {
        const sToken=jwt.sign({id:user.id,username:user.username,totp_setup_required:true},JWT_SECRET,{expiresIn:'15m'});
        return res.json({totp_required:true,totp_setup:true,setup_token:sToken});
      }
    }
  }
  // Connexion réussie : réinitialiser les compteurs
  db.prepare('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=? WHERE id=?').run(nowLocal(), user.id);
  const token = jwt.sign(
    { id: user.id, username: user.username, displayName: user.display_name, email: user.email, role: user.role, permissions: user.permissions || '{}', mustChangePassword: user.must_change_password === 1 },
    JWT_SECRET, { expiresIn: '8h' }
  );
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


// Liste des utilisateurs pour le sélecteur du suivi d'activité
// Accessible à tout utilisateur ayant activity_read ou admin
app.get('/api/users/for-activity', authMiddleware, (req, res) => {
  if (!checkActivityReadPerm(req)) return res.status(403).json({ error: 'Permission insuffisante' });
  const db = getDb();
  const rows = db.prepare("SELECT id, username, display_name FROM users WHERE enabled=1 ORDER BY username").all();
  res.json(rows);
});

app.get('/api/users', authMiddleware, requireRole('admin'), (req, res) => {
  const rows = getDb().prepare('SELECT id, username, display_name, email, role, permissions, enabled, last_login_at, created_at, updated_at, locked_until, failed_attempts, totp_enabled FROM users ORDER BY id').all();
  res.json(rows);
});

app.post('/api/users', authMiddleware, requireRole('admin'), async (req, res) => {
  const { username, display_name, email, role } = req.body;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  const ip = getClientIp(req);
  const db = getDb();
  if (!username?.trim()) return res.status(400).json({ error: 'Identifiant requis' });
  if (!email?.trim())    return res.status(400).json({ error: 'Adresse e-mail obligatoire' });

  // Mot de passe temporaire aléatoire (sera changé via le lien)
  const tmpPwd  = require('crypto').randomBytes(24).toString('hex');
  const hash    = bcrypt.hashSync(tmpPwd, 12);
  let newId;
  try {
    const r = db.prepare('INSERT INTO users (username, display_name, email, password_hash, must_change_password, role, permissions) VALUES (?,?,?,?,1,?,?)').run(
      username.trim(), display_name?.trim() || username.trim(), email.trim(), hash, role || 'viewer', '{}'
    );
    newId = r.lastInsertRowid;
  } catch {
    return res.status(400).json({ error: 'Identifiant ou e-mail déjà utilisé' });
  }

  // Générer un token d'initialisation (valide 24h)
  const token   = require('crypto').randomBytes(32).toString('hex');
  const pad     = n => String(n).padStart(2,'0');
  const exp     = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expStr  = `${exp.getFullYear()}-${pad(exp.getMonth()+1)}-${pad(exp.getDate())} ${pad(exp.getHours())}:${pad(exp.getMinutes())}:${pad(exp.getSeconds())}`;
  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at, used, created_at) VALUES (?,?,?,0,?)').run(newId, token, expStr, nowLocal());

  const appUrl   = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
  const initUrl  = `${appUrl}/reset-password?token=${token}`;

  // Envoi de l'email d'initialisation
  const transport = getMailTransport();
  logger.info(`[USER] Compte créé: ${username.trim()} — lien d'initialisation: ${initUrl}`);

  if (transport) {
    const from = process.env.SMTP_FROM || 'NexusVault <no-reply@nexusvault.local>';
    transport.sendMail({
      from, to: email.trim(),
      subject: 'NexusVault — Initialisation de votre compte',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:32px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#0d47a1,#26c6da);padding:28px 32px">
    <div style="color:white;font-size:22px;font-weight:800;letter-spacing:1px">NEXUS<span style="opacity:.7">VAULT</span></div>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#1e293b;margin:0 0 12px;font-size:18px">Bienvenue sur NexusVault !</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">Bonjour <strong>${username.trim()}</strong>,<br><br>
    Un compte a été créé pour vous. Cliquez sur le bouton ci-dessous pour initialiser votre mot de passe.</p>
    <a href="${initUrl}" style="display:inline-block;background:#1976d2;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px">Initialiser mon mot de passe</a>
    <p style="color:#94a3b8;font-size:11px;margin:20px 0 0">Ce lien est valable <strong>24 heures</strong>.</p>
    <p style="color:#cbd5e1;font-size:10px;margin:8px 0 0;word-break:break-all">${initUrl}</p>
  </div>
  <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8">
    NexusVault — Ne pas répondre à cet email
  </div>
</div></body></html>`,
    }).catch(err => logger.error('[USER] Email init error:', err.message));
  } else {
    logger.warn("[USER] SMTP non configure — lien d'initialisation disponible dans les logs ci-dessus");
  }

  audit(db, { userId: req.user.id, username: req.user.username, action: 'UTILISATEUR_CRÉÉ', category: 'admin', severity: 'info', detail: `Compte: ${username.trim()} (${role || 'viewer'}) — email init envoyé à ${email.trim()}`, ip, success: 1 });
  res.json({ id: newId, username: username.trim(), role: role || 'viewer' });
});

app.put('/api/users/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, display_name, email, role, permissions, enabled, password, reset_totp } = req.body;
  const ip = getClientIp(req);
  const db = getDb();
  if (password) {
    if (password.length < 14) return res.status(400).json({ error: 'Mot de passe: 14 caractères minimum' });
    const hash = bcrypt.hashSync(password, 12);
    db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?`).run(hash, nowLocal(), req.params.id);
  }
  if (reset_totp) {
    db.prepare('UPDATE users SET totp_secret=NULL, totp_enabled=0 WHERE id=?').run(req.params.id);
    audit(db, { userId: req.user.id, username: req.user.username, action: 'TOTP_REINITIALISE', category: 'auth', severity: 'warn', detail: `TOTP réinitialisé pour user ID ${req.params.id}`, ip, success: 1 });
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




// ── NOTIFICATIONS — CONFIGURATION ─────────────────────────────────────────────
app.get('/api/notifications/catalog', authMiddleware, requirePerm('security_access'), (req, res) => {
  // Sérialiser available() comme booléen (les fonctions ne passent pas en JSON)
  const channels = Object.fromEntries(
    Object.entries(CHANNEL_CATALOG).map(([k, v]) => [k, { ...v, available: v.available() }])
  );
  res.json({ events: EVENT_CATALOG, channels });
});

app.get('/api/notifications/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM notification_config").all();
  // Compléter avec les événements pas encore en base
  const result = Object.values(EVENT_CATALOG).map(evt => {
    const row = rows.find(r => r.event_key === evt.key);
    return {
      event_key: evt.key,
      label: evt.label,
      description: evt.description,
      enabled: row ? !!row.enabled : false,
      channels: row ? JSON.parse(row.channels || '[]') : [],
      options: row ? { ...evt.options, ...JSON.parse(row.options || '{}') } : evt.options,
    };
  });
  res.json(result);
});

app.put('/api/notifications/config/:eventKey', authMiddleware, requirePerm('security_access'), (req, res) => {
  const { enabled, channels, options } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  db.prepare(`INSERT INTO notification_config (event_key, enabled, channels, options, updated_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(event_key) DO UPDATE SET enabled=excluded.enabled, channels=excluded.channels, options=excluded.options, updated_at=excluded.updated_at`)
    .run(req.params.eventKey, enabled ? 1 : 0, JSON.stringify(channels || []), JSON.stringify(options || {}), nowLocal());
  audit(db, { userId: req.user.id, username: req.user.username, action: 'NOTIF_CONFIG', category: 'admin', severity: 'info', detail: `${req.params.eventKey}: ${enabled ? 'activé' : 'désactivé'} — canaux: ${(channels||[]).join(',')}`, ip, success: 1 });
  res.json({ success: true });
});

app.get('/api/notifications/log', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.prepare("SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT ?").all(limit));
});

// Test d'envoi manuel d'une notification
app.post('/api/notifications/test/:eventKey', authMiddleware, requirePerm('security_access'), (req, res) => {
  const testPayloads = {
    backup_download:        { datetime: nowLocal(), username: req.user.username, ip: getClientIp(req), device: 'TEST-SW-01', version: 'v12 (test)' },
    login_failed_threshold: { datetime: nowLocal(), username: 'testuser', ip: getClientIp(req), attempts: 3, threshold: 3 },
    account_locked:         { datetime: nowLocal(), username: 'testuser', ip: getClientIp(req), attempts: 5, locked_until: nowLocal() },
    preview_recap:          { html: '<p><em>Ceci est un test de notification.</em></p>', text: 'Test de notification preview_recap' },
    preview_overdue:        { html: '<p><em>Test : 2 notes en preview sur des périodes passées.</em></p>', text: 'Test preview_overdue' },
  };
  dispatch(req.params.eventKey, testPayloads[req.params.eventKey] || {}, getDb)
    .then(() => res.json({ success: true }))
    .catch(e => res.status(500).json({ error: e.message }));
});

// ── OIDC CONFIGURATION ────────────────────────────────────────────────────────
app.get('/api/oidc/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='oidc_config'").get();
  if (!row) return res.json({ enabled: false });
  try {
    const cfg = JSON.parse(row.value);
    // Ne pas renvoyer le secret en clair
    res.json({ ...cfg, client_secret: cfg.client_secret ? '••••••••' : '' });
  } catch { res.json({ enabled: false }); }
});

app.put('/api/oidc/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const {
    enabled, provider_name, issuer_url, client_id, client_secret,
    redirect_uri, scopes, auto_create_users, default_role,
    allow_local_login,
    authorization_endpoint, token_endpoint, userinfo_endpoint,
  } = req.body;
  // Récupérer l'ancien secret si le nouveau est masqué
  let finalSecret = client_secret;
  if (client_secret === '••••••••') {
    const existing = db.prepare("SELECT value FROM settings WHERE key='oidc_config'").get();
    if (existing) { try { finalSecret = JSON.parse(existing.value).client_secret || ''; } catch {} }
  }
  const cfg = {
    enabled: !!enabled,
    provider_name: provider_name || '',
    issuer_url: issuer_url || '',
    client_id: client_id || '',
    client_secret: finalSecret || '',
    redirect_uri: redirect_uri || '',
    scopes: scopes || 'openid email profile',
    auto_create_users: !!auto_create_users,
    default_role: default_role || 'viewer',
    allow_local_login: allow_local_login !== false, // true by default
    authorization_endpoint: authorization_endpoint || '',
    token_endpoint: token_endpoint || '',
    userinfo_endpoint: userinfo_endpoint || '',
  };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('oidc_config', ?)").run(JSON.stringify(cfg));
  audit(db, { userId: req.user.id, username: req.user.username, action: 'OIDC_CONFIG_MODIFIÉ', category: 'security', ip });
  res.json({ success: true });
});

// Config OIDC publique (pour la page de login)
app.get('/api/oidc/public', (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='oidc_config'").get();
  if (!row) return res.json({ enabled: false, allow_local_login: true });
  try {
    const cfg = JSON.parse(row.value);
    res.json({
      enabled: !!cfg.enabled,
      provider_name: cfg.provider_name || '',
      issuer_url: cfg.issuer_url || '',
      client_id: cfg.client_id || '',
      redirect_uri: cfg.redirect_uri || '',
      scopes: cfg.scopes || 'openid email profile',
      allow_local_login: cfg.allow_local_login !== false,
      authorization_endpoint: cfg.authorization_endpoint || '',
      token_endpoint: cfg.token_endpoint || '',
      userinfo_endpoint: cfg.userinfo_endpoint || '',
    });
  } catch { res.json({ enabled: false, allow_local_login: true }); }
});




// ── LDAP CONFIGURATION ───────────────────────────────────────────────────────
app.get('/api/ldap/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='ldap_config'").get();
  if (!row) return res.json({ enabled: false, url: '', base_dn: '', bind_dn: '', user_attr: 'sAMAccountName', group_filter: '', required_group: '', tls: false });
  try {
    const cfg = JSON.parse(row.value);
    res.json({ ...cfg, bind_password: cfg.bind_password ? '••••••••' : '' });
  } catch { res.json({ enabled: false }); }
});

app.put('/api/ldap/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const { enabled, url, base_dn, bind_dn, bind_password, user_attr, group_filter, required_group, tls } = req.body;
  const db = getDb(); const ip = getClientIp(req);
  let finalPwd = bind_password;
  if (bind_password === '••••••••') {
    const existing = db.prepare("SELECT value FROM settings WHERE key='ldap_config'").get();
    if (existing) { try { finalPwd = JSON.parse(existing.value).bind_password || ''; } catch {} }
  }
  const cfg = { enabled: !!enabled, url: url || '', base_dn: base_dn || '', bind_dn: bind_dn || '', bind_password: finalPwd || '', user_attr: user_attr || 'sAMAccountName', group_filter: group_filter || '', required_group: required_group || '', tls: !!tls };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ldap_config', ?)").run(JSON.stringify(cfg));
  if (url && enabled) process.env.LDAP_ENABLED = '1';
  audit(db, { userId: req.user.id, username: req.user.username, action: 'LDAP_CONFIG_MODIFIÉ', category: 'admin', severity: 'info', detail: `LDAP ${cfg.enabled ? 'activé' : 'désactivé'} — URL: ${url || '(vide)'}`, ip, success: 1 });
  res.json({ success: true });
});

// ── SLACK CONFIGURATION ───────────────────────────────────────────────────────
app.get('/api/slack/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='slack_config'").get();
  if (!row) return res.json({ webhook_url: '' });
  try {
    const cfg = JSON.parse(row.value);
    res.json({ webhook_url: cfg.webhook_url ? '••••' + cfg.webhook_url.slice(-8) : '' });
  } catch { res.json({ webhook_url: '' }); }
});

app.put('/api/slack/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const { webhook_url } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  let finalUrl = webhook_url;
  if (webhook_url && webhook_url.startsWith('••••')) {
    const existing = db.prepare("SELECT value FROM settings WHERE key='slack_config'").get();
    if (existing) { try { finalUrl = JSON.parse(existing.value).webhook_url || ''; } catch {} }
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('slack_config', ?)").run(JSON.stringify({ webhook_url: finalUrl || '' }));
  if (finalUrl) process.env.SLACK_WEBHOOK_URL = finalUrl;
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SLACK_CONFIG_MODIFIÉ', category: 'admin', severity: 'info', detail: 'Webhook Slack mis à jour', ip, success: 1 });
  res.json({ success: true });
});

app.post('/api/slack/test', authMiddleware, requirePerm('security_access'), (req, res) => {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return res.status(400).json({ error: 'SLACK_WEBHOOK_URL non configuré' });
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '🔔 *NexusVault* — Test de notification Slack réussi !' }) })
    .then(r => r.ok ? res.json({ success: true }) : res.status(500).json({ error: `HTTP ${r.status}` }))
    .catch(e => res.status(500).json({ error: e.message }));
});

// ── TELEGRAM CONFIGURATION ─────────────────────────────────────────────────────
app.get('/api/telegram/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='telegram_config'").get();
  if (!row) return res.json({ bot_token: '', chat_id: '' });
  try {
    const cfg = JSON.parse(row.value);
    res.json({ bot_token: cfg.bot_token ? '••••••••' : '', chat_id: cfg.chat_id || '' });
  } catch { res.json({ bot_token: '', chat_id: '' }); }
});

app.put('/api/telegram/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const { bot_token, chat_id } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  // Conserver l'ancien token si masqué
  let finalToken = bot_token;
  if (bot_token === '••••••••') {
    const existing = db.prepare("SELECT value FROM settings WHERE key='telegram_config'").get();
    if (existing) { try { finalToken = JSON.parse(existing.value).bot_token || ''; } catch {} }
  }
  const cfg = { bot_token: finalToken || '', chat_id: chat_id || '' };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('telegram_config', ?)").run(JSON.stringify(cfg));
  if (finalToken) { process.env.TELEGRAM_BOT_TOKEN = finalToken; process.env.TELEGRAM_CHAT_ID = chat_id || ''; }
  audit(db, { userId: req.user.id, username: req.user.username, action: 'TELEGRAM_CONFIG_MODIFIÉ', category: 'admin', severity: 'info', detail: `chat_id: ${chat_id || '(vide)'}`, ip, success: 1 });
  res.json({ success: true });
});

app.post('/api/telegram/test', authMiddleware, requirePerm('security_access'), (req, res) => {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)
    return res.status(400).json({ error: 'Telegram non configuré' });
  const { dispatch } = require('./notifications.js');
  dispatch('telegram_test_direct', null, getDb).catch(() => {});
  // Envoi direct du test
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: '🔔 *NexusVault* — Test de notification Telegram réussi !', parse_mode: 'Markdown' }),
  }).then(r => r.json()).then(d => {
    if (d.ok) res.json({ success: true });
    else res.status(500).json({ error: d.description });
  }).catch(e => res.status(500).json({ error: e.message }));
});

// ── SMTP CONFIGURATION ────────────────────────────────────────────────────────
app.get('/api/smtp/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='smtp_config'").get();
  if (!row) return res.json({ host: '', port: 587, secure: false, user: '', from: '', app_url: '' });
  try { res.json(JSON.parse(row.value)); } catch { res.json({}); }
});

app.put('/api/smtp/config', authMiddleware, requirePerm('security_access'), (req, res) => {
  const { host, port, secure, user, pass, from, app_url } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  
  logger.info(`[SMTP] ===== SAUVEGARDE SMTP =====`);
  logger.info(`[SMTP] Demandé par: ${req.user.username} depuis ${ip}`);
  logger.info(`[SMTP] Body reçu: host=${host||'(vide)'} port=${port||587} secure=${secure} user=${user||'(vide)'} pass=${pass !== undefined ? (pass ? `(${pass.length} chars)` : '(chaîne vide)') : '(non envoyé/undefined)'} from=${from||'(vide)'}`);

  // Charger config existante pour conserver le pass si non fourni
  const existing = db.prepare("SELECT value FROM settings WHERE key='smtp_config'").get();
  let existingCfg = {};
  try { existingCfg = existing ? JSON.parse(existing.value) : {}; } catch {}
  logger.info(`[SMTP] Config existante en base: host=${existingCfg.host||'(vide)'} pass=${existingCfg.pass ? `(${existingCfg.pass.length} chars)` : '(vide)'}`);
  
  const cfg = {
    host:    host    || '',
    port:    parseInt(port) || 587,
    secure:  !!secure,
    user:    user    || '',
    pass:    (pass !== undefined && pass !== '') ? pass : (existingCfg.pass || ''),
    from:    from    || '',
    app_url: app_url || existingCfg.app_url || '',
  };
  
  logger.info(`[SMTP] Config finale à sauvegarder: host=${cfg.host} port=${cfg.port} secure=${cfg.secure} user=${cfg.user} pass=${cfg.pass ? `(${cfg.pass.length} chars)` : '(vide)'} from=${cfg.from}`);
  
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('smtp_config', ?)").run(JSON.stringify(cfg));
  logger.info(`[SMTP] Sauvegarde en base OK`);
  
  // Mettre à jour les variables d'environnement en mémoire
  if (cfg.host) {
    process.env.SMTP_HOST   = cfg.host;
    process.env.SMTP_PORT   = String(cfg.port);
    process.env.SMTP_SECURE = String(cfg.secure);
    process.env.SMTP_USER   = cfg.user;
    process.env.SMTP_PASS   = cfg.pass;
    process.env.SMTP_FROM   = cfg.from;
    logger.info(`[SMTP] Variables d'env mises à jour — SMTP_HOST=${cfg.host} SMTP_USER=${cfg.user} SMTP_PASS=${cfg.pass ? '***' : '(vide)'}`);
  }

  if (cfg.app_url) process.env.APP_URL = cfg.app_url;
  
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SMTP_CONFIG_MODIFIÉ', category: 'admin', severity: 'info',
    detail: `host=${cfg.host} port=${cfg.port} user=${cfg.user} pass=${cfg.pass ? '(défini)' : '(vide)'}`, ip, success: 1 });
  
  res.json({ success: true });
});

app.post('/api/smtp/test', authMiddleware, requirePerm('security_access'), (req, res) => {
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
const { dispatch, EVENT_CATALOG, CHANNEL_CATALOG } = require('./notifications.js');
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

// ── DÉCONNEXION (audit log) ───────────────────────────────────────────────────
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const { source } = req.body;
  const db = getDb();
  audit(db, {
    userId: req.user.id, username: req.user.username,
    action: source === 'timeout' ? 'DECONNEXION_TIMEOUT' : 'DECONNEXION',
    category: 'auth', severity: 'info',
    detail: source === 'timeout' ? 'Session expiree apres inactivite' : 'Deconnexion volontaire',
    ip: getClientIp(req), success: 1,
  });
  res.json({ success: true });
});

// ── CONFIG BRUTE-FORCE ────────────────────────────────────────────────────────

// FEATURE FLAGS
app.get('/api/settings/feature-flags', authMiddleware, (req, res) => {
  const db = getDb(); const row = db.prepare("SELECT value FROM settings WHERE key='feature_flags'").get();
  res.json(row ? JSON.parse(row.value) : {});
});
app.put('/api/settings/feature-flags', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb(); const row = db.prepare("SELECT value FROM settings WHERE key='feature_flags'").get();
  const updated = Object.assign(row ? JSON.parse(row.value) : {}, req.body);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('feature_flags', ?)").run(JSON.stringify(updated));
  res.json({ success: true, flags: updated });
});

// Logo PDF — stocké en base64 dans settings
app.get('/api/settings/pdf-logo', authMiddleware, (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key='pdf_logo'").get();
  res.json({ logo: row ? row.value : null });
});
app.put('/api/settings/pdf-logo', authMiddleware, requireRole('admin'), (req, res) => {
  const { logo } = req.body; // base64 data URL ou null pour supprimer
  const db = getDb();
  if (logo === null || logo === '') {
    db.prepare("DELETE FROM settings WHERE key='pdf_logo'").run();
  } else {
    if (!logo.startsWith('data:image/')) return res.status(400).json({ error: 'Format image invalide' });
    if (logo.length > 500000) return res.status(400).json({ error: 'Image trop lourde (max ~375 Ko)' });
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('pdf_logo', ?)").run(logo);
  }
  audit(db, { userId: req.user.id, username: req.user.username, action: logo ? 'LOGO_PDF_MODIFIE' : 'LOGO_PDF_SUPPRIME', category: 'admin', severity: 'info', detail: logo ? 'Logo PDF mis à jour' : 'Logo PDF supprimé', ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

app.get('/api/security/brute-config', authMiddleware, requireRole('admin'), (req, res) => {
  res.json(getBruteConfig(getDb()));
});
app.put('/api/security/brute-config', authMiddleware, requireRole('admin'), (req, res) => {
  const { max, window: win } = req.body;
  const db = getDb();
  const safeMax = Math.max(1, parseInt(max) || 5);
  const safeWin = Math.max(60, parseInt(win) || 600);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brute_config', ?)").run(JSON.stringify({ max: safeMax, window: safeWin }));
  audit(db, { userId: req.user.id, username: req.user.username, action: 'BRUTE_CONFIG_MODIFIE', category: 'admin', severity: 'warn', detail: `Brute-force: ${safeMax} tentatives, verrouillage ${Math.round(safeWin/60)} min`, ip: getClientIp(req), success: 1 });
  res.json({ success: true, max: safeMax, window: safeWin });
});

// ── ADMINISTRATION : AUDIT ────────────────────────────────────────────────────
app.get('/api/audit', authMiddleware, requirePerm('audit_access'), (req, res) => {
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


// ── CRONS NOTIFICATIONS PREVIEW ───────────────────────────────────────────────
function checkPreviewCrons() {
  const db = getDb();
  const now = nowLocal();
  const nowDate = new Date();
  const curYear = nowDate.getFullYear(), curMonth = nowDate.getMonth() + 1;

  // preview_overdue : notes preview sur mois/années passés
  const overdueRow = db.prepare("SELECT * FROM notification_config WHERE event_key='preview_overdue' AND enabled=1").get();
  if (overdueRow) {
    const overdue = db.prepare(
      "SELECT e.*, u.username FROM activity_entries e JOIN users u ON e.user_id=u.id WHERE e.is_preview=1 AND (e.year < ? OR (e.year=? AND e.month < ?))"
    ).all(curYear, curYear, curMonth);
    if (overdue.length > 0) {
      const grouped = {};
      overdue.forEach(e => {
        const key = `${e.year}-${String(e.month).padStart(2,'0')}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
      });
      const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      let html = '<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#fef3c7"><th style="padding:8px;text-align:left">Période</th><th style="padding:8px;text-align:left">Utilisateur</th><th style="padding:8px;text-align:left">Tag</th><th style="padding:8px;text-align:left">Extrait</th></tr>';
      let text = `${overdue.length} note(s) preview sur des périodes passées :
`;
      Object.entries(grouped).sort().forEach(([period, entries]) => {
        const [y, m] = period.split('-');
        entries.forEach(e => {
          html += `<tr><td style="padding:6px 8px">${MONTHS_FR[parseInt(m)-1]} ${y}</td><td style="padding:6px 8px">${e.username}</td><td style="padding:6px 8px">${e.tag_code}</td><td style="padding:6px 8px;color:#64748b">${(e.content||'').slice(0,60)}…</td></tr>`;
          text += `  - ${MONTHS_FR[parseInt(m)-1]} ${y} / ${e.username} / [${e.tag_code}]: ${(e.content||'').slice(0,60)}
`;
        });
      });
      html += '</table>';
      dispatch('preview_overdue', { html, text }, getDb).catch(() => {});
    }
  }

  // preview_recap : récapitulatif périodique
  const recapRow = db.prepare("SELECT * FROM notification_config WHERE event_key='preview_recap' AND enabled=1").get();
  if (recapRow) {
    let opts = {};
    try { opts = JSON.parse(recapRow.options || '{}'); } catch {}
    const freq = opts.frequency || 'weekly';
    const shouldSend = (
      (freq === 'daily') ||
      (freq === 'weekly' && nowDate.getDay() === (parseInt(opts.day_of_week) || 1)) ||
      (freq === 'monthly' && nowDate.getDate() === (parseInt(opts.day_of_month) || 1))
    );
    if (shouldSend) {
      const previews = db.prepare(
        "SELECT e.*, u.username FROM activity_entries e JOIN users u ON e.user_id=u.id WHERE e.is_preview=1 ORDER BY e.year DESC, e.month DESC"
      ).all();
      const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      let html = previews.length === 0 ? '<p>✅ Aucune note en preview actuellement.</p>'
        : `<p>${previews.length} note(s) en preview :</p><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#f0f9ff"><th style="padding:8px;text-align:left">Période</th><th style="padding:8px;text-align:left">Utilisateur</th><th style="padding:8px;text-align:left">Tag</th><th style="padding:8px;text-align:left">Statut</th><th style="padding:8px;text-align:left">Extrait</th></tr>` +
          previews.map(e => {
            const isFuture = e.year > curYear || (e.year === curYear && e.month > curMonth);
            const status = isFuture ? '🔮 Futur' : '⚠️ Passé';
            return `<tr><td style="padding:6px 8px">${MONTHS_FR[e.month-1]} ${e.year}</td><td style="padding:6px 8px">${e.username}</td><td style="padding:6px 8px">${e.tag_code}</td><td style="padding:6px 8px">${status}</td><td style="padding:6px 8px;color:#64748b">${(e.content||'').slice(0,60)}…</td></tr>`;
          }).join('') + '</table>';
      const text = previews.length === 0 ? 'Aucune note en preview.' : `${previews.length} note(s) en preview.`;
      dispatch('preview_recap', { html, text }, getDb).catch(() => {});
    }
  }
}

// Vérification toutes les heures (preview_overdue et preview_recap)
setInterval(checkPreviewCrons, 60 * 60 * 1000);
// Aussi au démarrage après 1 min pour détecter immédiatement
setTimeout(checkPreviewCrons, 60 * 1000);

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
  // Trouver l'userId si archivedBy est un username
  let _uid = null;
  try { const _u = db.prepare('SELECT id FROM users WHERE username=?').get(archivedBy); _uid = _u ? _u.id : null; } catch {}
  audit(db, { userId: _uid, username: archivedBy, action: 'AUDIT_ARCHIVÉ', category: 'admin', severity: 'info', detail: `Archive ${yr}/${mo} créée — ${rows.length} entrée(s) archivées`, ip: '127.0.0.1', success: 1 });
  return { year: yr, month: mo, count: rows.length };
}

// ── AUDIT : CRON MENSUEL CONFIGURABLE ─────────────────────────────────────────
const cronState = { lastRun: null, lastResult: null, nextRun: null };

function getCronConfig(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key='cron_archive_time'").get();
  if (row) {
    try {
      const val = JSON.parse(row.value);
      return { hour: parseInt(val.hour ?? 0), minute: parseInt(val.minute ?? 5), day: parseInt(val.day ?? 1) };
    } catch {}
  }
  return { hour: 0, minute: 5, day: 1 }; // défaut : 00h05 le 1er du mois
}

function getNextRunInfo(hour, minute, day) {
  const targetDay = day ?? 1;
  const localStr = nowLocal();
  const year  = parseInt(localStr.slice(0, 4));
  const month = parseInt(localStr.slice(5, 7));
  const curDay  = parseInt(localStr.slice(8, 10));
  const curHour = parseInt(localStr.slice(11, 13));
  const curMin  = parseInt(localStr.slice(14, 16));
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  const stillThisMonth = curDay < targetDay || (curDay === targetDay && (curHour < hour || (curHour === hour && curMin < minute)));
  if (stillThisMonth) return `${year}-${String(month).padStart(2,'0')}-${dd} ${hh}:${mm}`;
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  return `${ny}-${String(nm).padStart(2,'0')}-${dd} ${hh}:${mm}`;
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
    cronState.nextRun = getNextRunInfo(cfg.hour, cfg.minute, cfg.day);

    const targetDay = cfg.day ?? 1;
    logger.debug(`[CRON] tick ${localStr} — cfg jour=${targetDay} heure=${cfg.hour}h${String(cfg.minute).padStart(2,'0')}`);
    if (localDay === targetDay && localHour === cfg.hour && localMinute >= cfg.minute) {
      const localYear  = parseInt(localStr.slice(0, 4));
      const localMonth = parseInt(localStr.slice(5, 7));
      const prevMonth = new Date(localYear, localMonth - 2, 1);
      const year  = prevMonth.getFullYear();
      const month = prevMonth.getMonth() + 1;
      logger.info(`[CRON] Condition remplie — archivage ${year}/${String(month).padStart(2,'0')}`);
      const alreadyDone = db.prepare('SELECT id FROM audit_archives WHERE year=? AND month=?').get(year, month);
      if (alreadyDone) {
        logger.info(`[CRON] Archive ${year}/${String(month).padStart(2,'0')} deja existante — skip`);
      } else {
        const result = archiveMonth(db, year, month, 'cron');
        if (result.skipped) {
          logger.warn(`[CRON] Aucune entree a archiver pour ${year}/${String(month).padStart(2,'0')}`);
        } else {
          cronState.lastRun    = nowLocal();
          cronState.lastResult = `Archive ${year}/${String(month).padStart(2,'0')} — ${result.count} entrees`;
          // Persister lastRun dans la DB pour survivre aux redémarrages
          try {
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('cron_last_run', ?)").run(
              JSON.stringify({ run: cronState.lastRun, result: cronState.lastResult })
            );
          } catch {}
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
    day: getCronConfig(getDb()).day,
  });
});

app.put('/api/cron/config', authMiddleware, requireRole('admin'), (req, res) => {
  const { hour, minute, day } = req.body;
  const db = getDb();
  const ip = getClientIp(req);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('cron_archive_time', ?)")
    .run(JSON.stringify({ hour: parseInt(hour ?? 0), minute: parseInt(minute ?? 5), day: parseInt(day ?? 1) }));
  cronState.nextRun = getNextRunInfo(parseInt(hour ?? 0), parseInt(minute ?? 5), parseInt(day ?? 1));
  // Propagation du jour dans le cronState
  audit(db, { userId: req.user.id, username: req.user.username, action: 'CRON_CONFIG_MODIFIÉ', category: 'admin', severity: 'info', detail: `Cron archivage: ${String(hour).padStart(2,'0')}h${String(minute).padStart(2,'0')}`, ip, success: 1 });
  res.json({ success: true, next_run: cronState.nextRun });
});


// ══════════════════════════════════════════════════════════════════════════════
// ── PLANIFICATION DES SAUVEGARDES AUTOMATIQUES ───────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/backup-schedules — liste
app.get('/api/backup-schedules', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const schedules = db.prepare('SELECT * FROM backup_schedules ORDER BY id ASC').all();
  const result = schedules.map(s => {
    const devices = db.prepare(`
      SELECT d.id, d.name_enc, s2.name_enc as site_name_enc
      FROM backup_schedule_devices bsd
      JOIN devices d ON d.id = bsd.device_id
      LEFT JOIN sites s2 ON s2.id = d.site_id
      WHERE bsd.schedule_id = ?
      ORDER BY d.name_enc ASC
    `).all(s.id).map(d => ({ id: d.id, name: decrypt(d.name_enc), site: decrypt(d.site_name_enc) }));
    return { ...s, devices };
  });
  res.json(result);
});

// POST /api/backup-schedules — créer
app.post('/api/backup-schedules', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const { label, frequency, hour, minute, day_of_week, day_of_month } = req.body;
  const r = db.prepare(`
    INSERT INTO backup_schedules (label, frequency, hour, minute, day_of_week, day_of_month, enabled, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(label || 'Planification', frequency || 'daily', parseInt(hour ?? 2), parseInt(minute ?? 0),
         day_of_week != null ? parseInt(day_of_week) : null,
         day_of_month != null ? parseInt(day_of_month) : null,
         req.user.id);
  audit(db, { userId: req.user.id, username: req.user.username,
    action: 'BACKUP_CRON_CRÉÉ', category: 'backup', severity: 'info',
    detail: `"${label || 'Planification'}" créée — ${frequency} à ${String(parseInt(hour??2)).padStart(2,'0')}:${String(parseInt(minute??0)).padStart(2,'0')}`,
    ip, success: 1 });
  res.json({ id: r.lastInsertRowid });
});

// PUT /api/backup-schedules/:id — modifier
app.put('/api/backup-schedules/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const { label, frequency, hour, minute, day_of_week, day_of_month, enabled } = req.body;
  db.prepare(`
    UPDATE backup_schedules SET label=?, frequency=?, hour=?, minute=?, day_of_week=?, day_of_month=?, enabled=?, updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(label, frequency || 'daily', parseInt(hour ?? 2), parseInt(minute ?? 0),
         day_of_week != null ? parseInt(day_of_week) : null,
         day_of_month != null ? parseInt(day_of_month) : null,
         enabled ? 1 : 0, req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username,
    action: 'BACKUP_CRON_MODIFIÉ', category: 'backup', severity: 'info',
    detail: `"${label}" modifiée — ${frequency} à ${String(parseInt(hour??2)).padStart(2,'0')}:${String(parseInt(minute??0)).padStart(2,'0')}`, ip, success: 1 });
  res.json({ success: true });
});

// DELETE /api/backup-schedules/:id — supprimer
app.delete('/api/backup-schedules/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const s = db.prepare('SELECT label FROM backup_schedules WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM backup_schedules WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username,
    action: 'BACKUP_CRON_SUPPRIMÉ', category: 'backup', severity: 'warn',
    detail: `Planification #${req.params.id} — ${s ? s.label : '?'} supprimée`, ip, success: 1 });
  res.json({ success: true });
});

// PUT /api/backup-schedules/:id/devices — set devices list
app.put('/api/backup-schedules/:id/devices', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const { device_ids } = req.body; // array of device ids
  db.prepare('DELETE FROM backup_schedule_devices WHERE schedule_id=?').run(req.params.id);
  const stmt = db.prepare('INSERT OR IGNORE INTO backup_schedule_devices (schedule_id, device_id) VALUES (?,?)');
  (device_ids || []).forEach(did => stmt.run(req.params.id, did));
  audit(db, { userId: req.user.id, username: req.user.username,
    action: 'BACKUP_CRON_ÉQUIPEMENTS_MAJ', category: 'backup', severity: 'info',
    detail: `Planification #${req.params.id} — ${(device_ids||[]).length} équipements`, ip, success: 1 });
  res.json({ success: true });
});

// POST /api/backup-schedules/:id/run-now — exécution manuelle
app.post('/api/backup-schedules/:id/run-now', authMiddleware, requireRole('admin'), async (req, res) => {
  const results = await runBackupSchedule(parseInt(req.params.id), { userId: req.user.id, username: req.user.username }, getClientIp(req));
  res.json({ results });
});

// ── Moteur d'exécution des planifications ────────────────────────────────────
const scheduleState = {}; // { [id]: { lastRun, lastResult } }

async function runBackupSchedule(scheduleId, triggerUser, ip = 'system') {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM backup_schedules WHERE id=?').get(scheduleId);
  if (!schedule || !schedule.enabled) return [];

  const deviceRows = db.prepare(`
    SELECT d.*, m.backup_method_enc, m.backup_command_enc
    FROM backup_schedule_devices bsd
    JOIN devices d ON d.id = bsd.device_id
    LEFT JOIN device_models m ON m.id = d.model_id
    WHERE bsd.schedule_id = ?
  `).all(scheduleId);

  const results = [];
  for (const deviceRow of deviceRows) {
    const deviceName = decrypt(deviceRow.name_enc);
    const deviceIp   = decrypt(deviceRow.ip_enc);
    const sshPort    = decrypt(deviceRow.ssh_port_enc) || '22';
    const sshUser    = decrypt(deviceRow.ssh_user_enc);
    const sshPass    = decrypt(deviceRow.ssh_password_enc);
    const method     = decrypt(deviceRow.backup_method_enc) || 'SSH';
    const command    = decrypt(deviceRow.backup_command_enc) || 'show running-config';
    const last       = db.prepare('SELECT MAX(version) as v FROM backups WHERE device_id=?').get(deviceRow.id);
    const version    = (last.v || 0) + 1;

    let content = '', status = 'ok', errorMsg = '';
    if (method === 'SSH') {
      try {
        content = await sshExec({ host: deviceIp, port: parseInt(sshPort)||22, username: sshUser, password: sshPass, command, timeout: 45000 });
        if (!content || content.trim().length < 10) throw new Error('Sortie SSH vide');
      } catch (err) {
        status = 'error'; errorMsg = err.message;
        content = `! ERREUR BACKUP SSH — ${new Date().toISOString()}\n! ${deviceName} (${deviceIp})\n! ${err.message}`;
      }
    } else {
      status = 'warn'; errorMsg = `Méthode ${method} non supportée`;
      content = `! Méthode ${method} non supportée — ${deviceName}`;
    }

    // ── Déduplication : ne pas créer si identique à la dernière version ────────
    let isDuplicate = false;
    if (status === 'ok') {
      const lastBackup = db.prepare(
        'SELECT content_enc FROM backups WHERE device_id=? ORDER BY version DESC LIMIT 1'
      ).get(deviceRow.id);
      if (lastBackup) {
        try {
          const lastContent = decrypt(lastBackup.content_enc);
          // Comparaison normalisée (ignore espaces en fin de ligne et lignes vides finales)
          const normalize = s => s.replace(/[ \t]+$/mg, '').trim();
          if (normalize(lastContent) === normalize(content)) {
            isDuplicate = true;
          }
        } catch {}
      }
    }

    if (isDuplicate) {
      logger.info(`[BACKUP_CRON] ${deviceName} — identique à la dernière version, pas de nouvelle backup`);
      audit(db, { userId: triggerUser.userId || null, username: triggerUser.username || 'cron',
        action: 'BACKUP_IDENTIQUE', category: 'backup', severity: 'info',
        detail: `[CRON] "${schedule.label}" (${schedule.frequency} ${String(schedule.hour).padStart(2,'0')}:${String(schedule.minute).padStart(2,'0')}) — ${deviceName} (${deviceIp}) — identique à v${version - 1}, ignoré`,
        ip, success: 1 });
      results.push({ deviceId: deviceRow.id, deviceName, status: 'identical', version: version - 1, errorMsg: '' });
    } else {
      const r = db.prepare(`INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc, triggered_by, created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .run(deviceRow.id, version, encrypt(content), content.length, status, encrypt(`Planification: ${schedule.label}`), String(triggerUser.userId || 'cron'), nowLocal());

      audit(db, { userId: triggerUser.userId || null, username: triggerUser.username || 'cron',
        action: status === 'ok' ? 'BACKUP_DÉCLENCHÉ' : 'BACKUP_ÉCHEC',
        category: 'backup', severity: status === 'ok' ? 'info' : 'error',
        detail: `[CRON] "${schedule.label}" (${schedule.frequency} ${String(schedule.hour).padStart(2,'0')}:${String(schedule.minute).padStart(2,'0')}) — ${deviceName} (${deviceIp}) — ${status === 'ok' ? `v${version} OK` : `ERREUR: ${errorMsg}`}`,
        ip, success: status === 'ok' ? 1 : 0 });

      results.push({ deviceId: deviceRow.id, deviceName, status, version, errorMsg });
    }
  }

  scheduleState[scheduleId] = { lastRun: nowLocal(), lastResult: results };

  // Envoyer notification si configurée
  try {
    const ok      = results.filter(r => r.status === 'ok').length;
    const fail    = results.filter(r => r.status !== 'ok' && r.status !== 'identical').length;
    const same    = results.filter(r => r.status === 'identical').length;
    const body    = results.map(r => {
      if (r.status === 'ok')        return `✓ ${r.deviceName} — v${r.version} sauvegardé`;
      if (r.status === 'identical') return `≡ ${r.deviceName} — identique à v${r.version}, ignorée`;
      return `✗ ${r.deviceName} — ERREUR: ${r.errorMsg}`;
    }).join('\n');
    const subject = `[NexusVault] ${schedule.label} — ${ok} OK${same ? ` / ${same} inchangé(s)` : ''}${fail ? ` / ${fail} erreur(s)` : ''}`;
    await dispatch('backup_schedule_result', {
      subject,
      html: `<h3>Planification : ${schedule.label}</h3><pre style="font-family:monospace">${body}</pre><p>Exécuté le ${nowLocal()}</p>`,
      text: `Planification: ${schedule.label}\n${body}\n\nExécuté le ${nowLocal()}`,
      ok, fail, same,
    }, getDb);
  } catch (e) { logger.warn('[BACKUP_CRON] Notification error: ' + e.message); }

  return results;
}

// ── Tick toutes les minutes — vérifie si un cron doit tourner ─────────────────
setInterval(() => {
  const db = getDb();
  const schedules = db.prepare('SELECT * FROM backup_schedules WHERE enabled=1').all();
  // Utiliser l'heure locale du serveur (configurable via TZ env var dans docker-compose)
  const nowStr = nowLocal(); // format: YYYY-MM-DD HH:MM:SS — heure locale (TZ Docker)
  const h = parseInt(nowStr.slice(11,13));
  const m = parseInt(nowStr.slice(14,16));
  // Pour le jour de la semaine et du mois, utiliser aussi l'heure locale
  const localDate = new Date();
  const dow = localDate.getDay();
  const dom = localDate.getDate();

  for (const s of schedules) {
    if (s.hour !== h || s.minute !== m) continue;
    // Check frequency
    if (s.frequency === 'weekly'  && s.day_of_week  !== dow) continue;
    if (s.frequency === 'monthly' && s.day_of_month !== dom) continue;
    // Avoid double-run in same minute
    const last = scheduleState[s.id]?.lastRun;
    if (last) {
      const lastDate = new Date(last.replace(' ', 'T'));
      const nowMs = Date.now();
      if ((nowMs - lastDate.getTime()) < 60000) continue;
    }
    logger.info(`[BACKUP_CRON] Exécution planification #${s.id} "${s.label}"`);
    runBackupSchedule(s.id, { userId: null, username: 'cron' }, 'cron').catch(e => logger.error('[BACKUP_CRON] ' + e.message));
  }
}, 60 * 1000);

// GET /api/backup-schedules/states — last run states
app.get('/api/backup-schedules/states', authMiddleware, requireRole('admin'), (req, res) => {
  res.json(scheduleState);
});


// ── AUDIT : ARCHIVER MAINTENANT (manuel / test) ────────────────────────────
app.post('/api/audit/archive-now', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const localStr = nowLocal();
  const localYear  = parseInt(localStr.slice(0, 4));
  const localMonth = parseInt(localStr.slice(5, 7));
  // Archiver le mois précédent par défaut
  const targetDate = new Date(localYear, localMonth - 2, 1);
  const year  = req.body.year  || targetDate.getFullYear();
  const month = req.body.month || (targetDate.getMonth() + 1);
  const result = archiveMonth(db, year, month, req.user.username);
  if (result.skipped) return res.json({ skipped: true, message: `Archive ${year}/${String(month).padStart(2,'0')} déjà existante` });
  res.json({ success: true, year, month, count: result.count });
});

// ── AUDIT : ENDPOINTS ─────────────────────────────────────────────────────────
// Lister les archives disponibles
app.get('/api/audit/archives', authMiddleware, requirePerm('audit_archive'), (req, res) => {
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


// ── AUDIT : TÉLÉCHARGER ARCHIVE EN ZIP ────────────────────────────────────────
app.get('/api/audit/archives/:id/download', authMiddleware, requirePerm('audit_archive'), (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM audit_archives WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Archive introuvable' });
  const zlib = require('zlib');
  let entries = [];
  try { entries = JSON.parse(row.data_json); } catch {}
  // Générer un CSV des entrées
  const BOM = '\uFEFF'; // BOM UTF-8 pour compatibilité Excel/LibreOffice
  const header = 'date,niveau,categorie,action,utilisateur,ip,detail,resultat\n';
  const rows = entries.map(e => [
    e.created_at, e.severity, e.category, e.action,
    e.username || '', e.ip || '', (e.detail || '').replace(/"/g, '""'), e.success ? 'OK' : 'ECHEC'
  ].map(v => `"${v}"`).join(',')).join('\n');
  const csv = BOM + header + rows;
  // Compresser en gzip
  const compressed = zlib.gzipSync(Buffer.from(csv, 'utf8'));
  const filename = `audit_${row.year}-${String(row.month).padStart(2,'0')}.csv.gz`;
  res.set({
    'Content-Type': 'application/gzip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': compressed.length,
  });
  res.send(compressed);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'ARCHIVE_TÉLÉCHARGÉE',
    category: 'admin', severity: 'info', detail: `${row.year}/${String(row.month).padStart(2,'0')} — ${row.entry_count} entrées`, ip: getClientIp(req), success: 1 });
});

// Déblocage manuel d'un compte verrouillé
app.post('/api/users/:id/unlock', authMiddleware, requireRole('admin'), (req, res) => {
  const db = getDb();
  const ip = getClientIp(req);
  const user = db.prepare('SELECT username FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  db.prepare('UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'COMPTE_DÉVERROUILLÉ', category: 'admin', severity: 'info', detail: `Déblocage manuel de "${user.username}"`, ip, success: 1 });
  res.json({ success: true });
});

// ── SITES ─────────────────────────────────────────────────────────────────────

// PAYS CRUD
app.get('/api/countries', authMiddleware, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM countries ORDER BY sort_order ASC, name ASC').all();
  res.json(rows);
});
app.post('/api/countries', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM countries').get().m;
  const r = db.prepare('INSERT INTO countries (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder + 1);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'PAYS_AJOUTE', category: 'config', severity: 'info', detail: name.trim(), ip: getClientIp(req), success: 1 });
  res.json({ id: r.lastInsertRowid, name: name.trim(), sort_order: maxOrder + 1 });
});
app.put('/api/countries/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, sort_order } = req.body;
  const db = getDb();
  if (name !== undefined) db.prepare('UPDATE countries SET name=? WHERE id=?').run(name.trim(), req.params.id);
  if (sort_order !== undefined) db.prepare('UPDATE countries SET sort_order=? WHERE id=?').run(sort_order, req.params.id);
  res.json({ success: true });
});
app.delete('/api/countries/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const db = getDb();
  const country = db.prepare('SELECT name FROM countries WHERE id=?').get(req.params.id);
  if (!country) return res.status(404).json({ error: 'Introuvable' });
  db.prepare('UPDATE sites SET country_id=NULL WHERE country_id=?').run(req.params.id);
  db.prepare('DELETE FROM countries WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'PAYS_SUPPRIME', category: 'config', severity: 'warn', detail: country.name, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});
app.put('/api/countries/reorder', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { order } = req.body;
  const db = getDb();
  const stmt = db.prepare('UPDATE countries SET sort_order=? WHERE id=?');
  order.forEach((id, idx) => stmt.run(idx, id));
  res.json({ success: true });
});
app.patch('/api/sites/:id/country', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { country_id } = req.body;
  getDb().prepare('UPDATE sites SET country_id=? WHERE id=?').run(country_id || null, req.params.id);
  res.json({ success: true });
});

app.get('/api/sites', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sites ORDER BY name_enc ASC').all();
  res.json(rows.map(r => ({
    id: r.id, name: decrypt(r.name_enc), location: decrypt(r.location_enc),
    contact: decrypt(r.contact_enc), description: decrypt(r.description_enc),
    created_at: r.created_at, country_id: r.country_id || null,
    parent_id: r.parent_id || null,
    device_count: db.prepare('SELECT COUNT(*) as c FROM devices WHERE site_id = ?').get(r.id).c
  })));
});

app.post('/api/sites', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, location, contact, description, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb();
  const r = db.prepare('INSERT INTO sites (name_enc, location_enc, contact_enc, description_enc, parent_id) VALUES (?,?,?,?,?)')
    .run(encrypt(name), encrypt(location||''), encrypt(contact||''), encrypt(description||''), parent_id || null);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SITE_CRÉÉ',
    category: 'config', severity: 'info', detail: name, ip: getClientIp(req), success: 1 });
  res.json({ id: r.lastInsertRowid, name, location, contact, description, parent_id: parent_id || null });
});

app.put('/api/sites/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const { name, location, contact, description, parent_id } = req.body;
  const db = getDb();
  const safeParent = parent_id && parseInt(parent_id) !== parseInt(req.params.id) ? parent_id : null;
  db.prepare("UPDATE sites SET name_enc=?, location_enc=?, contact_enc=?, description_enc=?, parent_id=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(encrypt(name), encrypt(location||''), encrypt(contact||''), encrypt(description||''), safeParent, req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SITE_MODIFIÉ',
    category: 'config', severity: 'info', detail: name, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

app.delete('/api/sites/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  getDb().prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  audit(getDb(), { userId: req.user.id, username: req.user.username, action: 'SITE_SUPPRIMÉ',
    category: 'config', severity: 'warn', detail: `Site #${req.params.id}`, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});
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
  const db = getDb(); const ip = getClientIp(req);
  db.prepare(`UPDATE device_models SET vendor_enc=?, model_enc=?, device_type_enc=?, backup_method_enc=?, backup_command_enc=?, updated_at=? WHERE id=?`).run(encrypt(vendor), encrypt(model), encrypt(device_type), encrypt(backup_method), encrypt(backup_command), nowLocal(), req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'MODÈLE_MODIFIÉ', category: 'config', severity: 'info', detail: `${vendor} ${model}`, ip, success: 1 });
  res.json({ success: true });
});

app.delete('/api/models/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const row = db.prepare('SELECT vendor_enc, model_enc FROM device_models WHERE id=?').get(req.params.id);
  const label = row ? `${decrypt(row.vendor_enc)} ${decrypt(row.model_enc)}` : req.params.id;
  db.prepare('DELETE FROM device_models WHERE id = ?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'MODÈLE_SUPPRIMÉ', category: 'config', severity: 'warn', detail: label, ip, success: 1 });
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
  const db2 = getDb(); const ip2 = getClientIp(req);
  db2.prepare(`UPDATE devices SET name_enc=?, site_id=?, model_id=?, ip_enc=?, ssh_port_enc=?, ssh_user_enc=?, ssh_password_enc=?, enabled=?, updated_at=? WHERE id=?`).run(encrypt(name), site_id, model_id, encrypt(ip), encrypt(ssh_port || '22'), encrypt(ssh_user), encrypt(ssh_password), enabled ? 1 : 0, nowLocal(), req.params.id);
  audit(db2, { userId: req.user.id, username: req.user.username, action: 'ÉQUIPEMENT_MODIFIÉ', category: 'config', severity: 'info', detail: `${name} (${ip})`, ip: ip2, success: 1 });
  res.json({ success: true });
});

app.delete('/api/devices/:id', authMiddleware, requirePerm('config_write'), (req, res) => {
  const db3 = getDb(); const ip3 = getClientIp(req);
  const dev = db3.prepare('SELECT name_enc, ip_enc FROM devices WHERE id=?').get(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Équipement introuvable' });
  // Bloquer si des backups existent pour cet équipement
  const backupCount = db3.prepare('SELECT COUNT(*) as c FROM backups WHERE device_id=?').get(req.params.id).c;
  if (backupCount > 0) {
    const devLabel = `${decrypt(dev.name_enc)} (${decrypt(dev.ip_enc)})`;
    return res.status(409).json({ error: `Impossible de supprimer "${devLabel}" : ${backupCount} backup(s) existant(s). Supprimez d'abord les backups associés.`, backupCount });
  }
  const devLabel = `${decrypt(dev.name_enc)} (${decrypt(dev.ip_enc)})`;
  db3.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  audit(db3, { userId: req.user.id, username: req.user.username, action: 'ÉQUIPEMENT_SUPPRIMÉ', category: 'config', severity: 'warn', detail: devLabel, ip: ip3, success: 1 });
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
  const _db_lu = getDb();
  const _bk_lu = _db_lu.prepare('SELECT b.version, d.name_enc FROM backups b LEFT JOIN devices d ON d.id=b.device_id WHERE b.id=?').get(req.params.id);
  audit(_db_lu, { userId: req.user.id, username: req.user.username, action: 'BACKUP_LU', category: 'backup', severity: 'info', detail: _bk_lu ? `${decrypt(_bk_lu.name_enc||'')} v${_bk_lu.version}` : `Backup ID ${req.params.id}`, ip: getClientIp(req), success: 1 });
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
    'INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc, triggered_by, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(device_id, version, encrypt(content), content.length, 'ok', encrypt(note || 'Upload manuel'), 'upload', nowLocal());
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
    'INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc, triggered_by, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(device_id, version, encrypt(content), content.length, status, encrypt(note || ''), req.user.username, nowLocal());

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
    detail: (() => { const bk2 = db.prepare('SELECT b.version, d.name_enc FROM backups b LEFT JOIN devices d ON d.id=b.device_id WHERE b.id=?').get(req.params.id); return bk2 ? `${decrypt(bk2.name_enc||'')} v${bk2.version}` : `Backup ID ${req.params.id}`; })(), ip: getClientIp(req), success: 1
  });
  res.json({ id: parseInt(req.params.id), pinned: newPinned });
});


// ── BACKUP : SUPPRESSION (protégée si épinglée) ──────────────────────────────

// ── BACKUP : LOG COPIE PRESSE-PAPIERS ────────────────────────────────────────
app.post('/api/backups/:id/audit-copy', authMiddleware, (req, res) => {
  const db = getDb();
  const bk = db.prepare('SELECT b.version, d.name_enc FROM backups b LEFT JOIN devices d ON d.id=b.device_id WHERE b.id=?').get(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'BACKUP_COPIÉ', category: 'backup', severity: 'info',
    detail: bk ? `${decrypt(bk.name_enc||'')} v${bk.version}` : `Backup ID ${req.params.id}`,
    ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

app.delete('/api/backups/:id', authMiddleware, requirePerm('backup_write'), (req, res) => {
  try {
    const db = getDb();
    const backup = db.prepare(`
      SELECT b.id, b.pinned, b.version, b.created_at,
        d.name_enc as device_name_enc, s.name_enc as site_name_enc
      FROM backups b
      LEFT JOIN devices d ON b.device_id = d.id
      LEFT JOIN sites s ON d.site_id = s.id
      WHERE b.id = ?`).get(req.params.id);
    if (!backup) return res.status(404).json({ error: 'Backup introuvable' });
    if (backup.pinned) return res.status(403).json({ error: 'Ce backup est épinglé. Désépinglez-le avant de le supprimer.' });
    db.prepare('DELETE FROM backups WHERE id = ?').run(req.params.id);
    let siteName = '?', deviceName = '?';
    try { siteName   = backup.site_name_enc   ? decrypt(backup.site_name_enc)   : '?'; } catch {}
    try { deviceName = backup.device_name_enc ? decrypt(backup.device_name_enc) : '?'; } catch {}
    const dateStr = (backup.created_at || '').slice(0, 10);
    audit(db, { userId: req.user.id, username: req.user.username, action: 'BACKUP_SUPPRIMÉ', category: 'backup', severity: 'warn',
      detail: `${siteName} / ${deviceName} — v${backup.version} du ${dateStr}`, ip: getClientIp(req), success: 1 });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/backups/:id error:', e.message);
    res.status(500).json({ error: e.message });
  }
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
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DIFF_CONSULTÉ', category: 'backup', severity: 'info',
    detail: (() => {
      const ba = db.prepare('SELECT b.version, d.name_enc FROM backups b LEFT JOIN devices d ON d.id=b.device_id WHERE b.id=?').get(id_a);
      const bb = db.prepare('SELECT b.version, d.name_enc FROM backups b LEFT JOIN devices d ON d.id=b.device_id WHERE b.id=?').get(id_b);
      const la = ba ? `${decrypt(ba.name_enc||'')} v${ba.version}` : `ID ${id_a}`;
      const lb = bb ? `${decrypt(bb.name_enc||'')} v${bb.version}` : `ID ${id_b}`;
      return `${la} ↔ ${lb}`;
    })(), ip: getClientIp(req), success: 1 });
  res.json({
    version_a: { id: a.id, version: a.version, created_at: a.created_at, device_name: decrypt(a.name_enc) },
    version_b: { id: b.id, version: b.version, created_at: b.created_at, device_name: decrypt(b.name_enc) },
    diff, added, removed
  });
});




// ── DROITS PAR RÔLE ────────────────────────────────────────────────────────────
// Droits par défaut intégrés (fallback si rien en base)
const DEFAULT_ROLE_PERMS = {
  admin:    { backup_read: true, backup_import: true, backup_write: true, backup_compare: true, config_read: true, config_write: true, audit_access: true, audit_archive: true, security_access: true, activity_write: true, activity_read: true, activity_tags: true, automatisation_read: true, automatisation_exec: true, automatisation_admin: true },
  operator: { backup_read: true, backup_import: false, backup_write: false, backup_compare: true, config_read: true, config_write: true, audit_access: false, audit_archive: false, security_access: false, activity_write: true, activity_read: true, activity_tags: true, automatisation_read: true, automatisation_exec: false, automatisation_admin: false },
  viewer:   { backup_read: true, backup_import: false, backup_write: false, backup_compare: false, config_read: true, config_write: false, audit_access: false, audit_archive: false, security_access: false, activity_write: true, activity_read: false, activity_tags: false, automatisation_read: true, automatisation_exec: false, automatisation_admin: false },
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

// Helper : vérifie si l'utilisateur peut voir les entrées des autres (activity_read)
function checkActivityReadPerm(req) {
  if (req.user.role === 'admin') return true;
  // 1. Permissions individuelles du JWT
  try {
    const p = JSON.parse(req.user.permissions || '{}');
    if (p.activity_read === true) return true;
  } catch {}
  // 2. Role permissions en base
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key='role_permissions'").get();
    if (row) {
      const rp = JSON.parse(row.value);
      if (rp[req.user.role]?.activity_read === true) return true;
    }
  } catch {}
  return false;
}

app.get('/api/activity/tags', authMiddleware, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM activity_tags ORDER BY code').all());
});

app.post('/api/activity/tags', authMiddleware, requirePerm('activity_tags'), (req, res) => {
  const { code, label, color } = req.body;
  if (!code || !label) return res.status(400).json({ error: 'Code et libellé requis' });
  const clean = code.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const db = getDb(); const ip = getClientIp(req);
  try {
    const r = db.prepare('INSERT INTO activity_tags (code, label, color) VALUES (?, ?, ?)').run(clean, label, color || '#066fd1');
    audit(db, { userId: req.user.id, username: req.user.username, action: 'TAG_CRÉÉ', category: 'suivi', severity: 'info', detail: `Tag [${clean}] "${label}" créé`, ip, success: 1 });
    res.json({ id: r.lastInsertRowid, code: clean, label, color });
  } catch { res.status(400).json({ error: 'Ce code existe déjà' }); }
});

app.put('/api/activity/tags/:id', authMiddleware, requirePerm('activity_tags'), (req, res) => {
  const { label, color } = req.body;
  const db = getDb(); const ip = getClientIp(req);
  const tag = db.prepare('SELECT code FROM activity_tags WHERE id=?').get(req.params.id);
  db.prepare('UPDATE activity_tags SET label=?, color=? WHERE id=?').run(label, color, req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'TAG_MODIFIÉ', category: 'suivi', severity: 'info', detail: `Tag [${tag?.code || req.params.id}] → libellé: "${label}", couleur: ${color}`, ip, success: 1 });
  res.json({ success: true });
});

app.delete('/api/activity/tags/:id', authMiddleware, requirePerm('activity_tags'), (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const tag = db.prepare('SELECT code, label FROM activity_tags WHERE id=?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Tag introuvable' });
  // Vérifier si le tag est utilisé
  const usages = db.prepare(
    'SELECT ae.id, ae.year, ae.month, ae.created_at, ae.content FROM activity_entries ae WHERE ae.tag_code=? ORDER BY ae.year DESC, ae.month DESC LIMIT 20'
  ).all(tag.code);
  if (usages.length > 0) {
    return res.status(409).json({
      error: `Le tag [${tag.code}] est utilisé dans ${usages.length} note(s) et ne peut pas être supprimé.`,
      usages: usages.map(e => ({
        id: e.id, year: e.year, month: e.month,
        date: (e.created_at||'').slice(0,10),
        excerpt: (e.content||'').replace(/\[secret\][\s\S]*?\[\/secret\]/gi,'[secret]').slice(0,60),
      })),
    });
  }
  db.prepare('DELETE FROM activity_tags WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'TAG_SUPPRIMÉ', category: 'suivi', severity: 'warn', detail: `Tag [${tag.code}] "${tag.label}" supprimé`, ip, success: 1 });
  res.json({ success: true });
});

// ── SUIVI D'ACTIVITÉ — ENTRÉES ────────────────────────────────────────────────
app.get('/api/activity/entries', authMiddleware, (req, res) => {
  const db = getDb();
  const { user_id, year, month } = req.query;
  const canViewAll = checkActivityReadPerm(req);
  const targetUserId = (canViewAll && user_id) ? parseInt(user_id) : req.user.id;
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
  const canViewAll = checkActivityReadPerm(req);
  const targetUserId = (canViewAll && user_id) ? parseInt(user_id) : req.user.id;
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
  db.prepare('INSERT INTO activity_entry_history (entry_id, event_type, detail, changed_by, changed_at) VALUES (?,?,?,?,?)').run(newId, 'created', `[${tag_code.toUpperCase()}] ${content.trim().replace(/\[secret\][\s\S]*?\[\/secret\]/gi,'[secret]').slice(0,80)}${content.length>80?'…':''}`, req.user.id, nowLocal());
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_AJOUTÉ', category: 'suivi', severity: 'info', detail: (() => { const _d = nowLocal().slice(0,10); const _dd = _d.slice(8,10); const _mm = _d.slice(5,7); const _txt = (content||'').replace(/\[secret\][\s\S]*?\[\/secret\]/gi,'[secret]').slice(0,60); return `${tag_code} · ${_dd}/${_mm} · ${_txt}${_txt.length===60?'…':''}${previewFlag?' (preview)':''}`; })(), ip: getClientIp(req), success: 1 });
  res.json({ id: newId, is_preview: previewFlag });
});

app.put('/api/activity/entries/:id', authMiddleware, (req, res) => {
  const { tag_code, content, is_preview, display_date } = req.body;
  const db = getDb();
  const entry = db.prepare('SELECT * FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Introuvable' });
  if (entry.user_id !== req.user.id)
    return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres notes' });
  const newPreview = is_preview === undefined ? entry.is_preview : (is_preview ? 1 : 0);
  // display_date : null = utiliser la date réelle, sinon stocker la date cosmétique (format YYYY-MM-DD)
  const newDisplayDate = display_date !== undefined ? (display_date || null) : entry.display_date;
  db.prepare('UPDATE activity_entries SET tag_code=?, content=?, is_preview=?, display_date=?, updated_at=? WHERE id=?').run(tag_code.toUpperCase(), content.trim(), newPreview, newDisplayDate, nowLocal(), req.params.id);
  // Historique : modification
  const changes = [];
  if (entry.tag_code !== tag_code.toUpperCase()) changes.push(`Tag: ${entry.tag_code} → ${tag_code.toUpperCase()}`);
  if (entry.content !== content.trim()) changes.push('Contenu modifié');
  if (entry.is_preview !== newPreview) changes.push(newPreview ? 'Marqué preview' : 'Preview retirée (validée)');
  if (newDisplayDate !== entry.display_date) {
    const oldDisp = entry.display_date ? `${entry.display_date.slice(8,10)}/${entry.display_date.slice(5,7)}/${entry.display_date.slice(0,4)}` : 'date réelle';
    const newDisp = newDisplayDate ? `${newDisplayDate.slice(8,10)}/${newDisplayDate.slice(5,7)}/${newDisplayDate.slice(0,4)}` : 'date réelle (réinitialisée)';
    changes.push(`Date d'affichage: ${oldDisp} → ${newDisp}`);
  }
  db.prepare('INSERT INTO activity_entry_history (entry_id, event_type, detail, changed_by, changed_at) VALUES (?,?,?,?,?)').run(parseInt(req.params.id), 'updated', changes.length ? changes.join(' | ') : 'Modification sans changement détecté', req.user.id, nowLocal());
  // Audit SUIVI_MODIFIÉ — inclut le changement de date cosmétique si applicable
  // Masquer les balises [secret] dans l'audit
  const maskSecrets = s => (s||'').replace(/\[secret\][\s\S]*?\[\/secret\]/gi, '[secret]');
  const _txt2 = maskSecrets((content||'').trim()).slice(0, 60);
  const _d2 = entry.created_at ? entry.created_at.slice(0,10) : nowLocal().slice(0,10);
  const _dateChange = (newDisplayDate !== entry.display_date)
    ? ` · Date affichage: ${newDisplayDate ? newDisplayDate.slice(8,10)+'/'+newDisplayDate.slice(5,7)+'/'+newDisplayDate.slice(0,4) : 'réinitialisée'}`
    : '';
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_MODIFIÉ', category: 'suivi', severity: 'info',
    detail: `${tag_code.toUpperCase()} · ${_d2.slice(8,10)}/${_d2.slice(5,7)} · ${_txt2}${_txt2.length===60?'…':''}${_dateChange}`, ip: getClientIp(req), success: 1 });
  res.json({ success: true });
});

app.delete('/api/activity/entries/:id', authMiddleware, (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const entry = db.prepare('SELECT * FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Introuvable' });
  if (entry.user_id !== req.user.id)
    return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres notes' });
  db.prepare('DELETE FROM activity_entries WHERE id=?').run(req.params.id);
  // Audit avec année, date, tag et extrait (secrets masqués)
  const pad = n => String(n).padStart(2,'0');
  const dateStr = `${pad(entry.created_at?.slice(8,10)||'??')}/${pad(entry.created_at?.slice(5,7)||'??')}/${entry.year}`;
  const excerpt = (entry.content||'').replace(/\[secret\][\s\S]*?\[\/secret\]/gi,'[secret]').slice(0,60);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_SUPPRIMÉ', category: 'suivi', severity: 'warn',
    detail: `[${entry.tag_code}] ${dateStr} — ${excerpt}${excerpt.length===60?'…':''}`, ip, success: 1 });
  res.json({ success: true });
});


// TOTP ROUTES
app.post('/api/auth/totp/setup-qr', (req, res) => {
  const { setup_token } = req.body;
  if (!setup_token) return res.status(400).json({ error: 'setup_token requis' });
  let p; try { p = jwt.verify(setup_token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token expiré' }); }
  if (!p.totp_setup_required) return res.status(403).json({ error: 'Non autorisé' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(p.id);
  if (!user) return res.status(404).json({ error: 'Introuvable' });
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.username, 'NexusVault', secret);
  db.prepare('UPDATE users SET totp_secret=? WHERE id=?').run(secret, user.id);
  QRCode.toDataURL(otpauth, { margin: 1, width: 256 })
    .then(qr => res.json({ secret, qr, username: user.username }))
    .catch(() => res.status(500).json({ error: 'Erreur génération QR' }));
});

app.post('/api/auth/totp/setup-verify', (req, res) => {
  const { setup_token, totp_token } = req.body;
  if (!setup_token || !totp_token) return res.status(400).json({ error: 'Champs requis' });
  const db = getDb(); const ip = getClientIp(req);
  let p; try { p = jwt.verify(setup_token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token expiré' }); }
  if (!p.totp_setup_required) return res.status(403).json({ error: 'Non autorisé' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(p.id);
  if (!user) return res.status(404).json({ error: 'Introuvable' });
  if (!authenticator.verify({ token: totp_token, secret: user.totp_secret }))
    return res.status(401).json({ error: 'Code TOTP invalide — vérifiez l\'heure de votre appareil' });
  db.prepare('UPDATE users SET totp_enabled=1, failed_attempts=0, locked_until=NULL, last_login_at=? WHERE id=?').run(nowLocal(), user.id);
  const tok = jwt.sign(
    { id: user.id, username: user.username, displayName: user.display_name, email: user.email, role: user.role, permissions: user.permissions || '{}', mustChangePassword: user.must_change_password === 1 },
    JWT_SECRET, { expiresIn: '8h' }
  );
  audit(db, { userId: user.id, username: user.username, action: 'TOTP_CONFIGURE', category: 'auth', severity: 'info', detail: 'TOTP configuré et activé', ip, success: 1 });
  res.json({ token: tok, mustChangePassword: user.must_change_password === 1 });
});

// FICHIERS JOINTS AU SUIVI D'ACTIVITE
app.get('/api/activity/entries/:id/files', authMiddleware, (req, res) => {
  const db=getDb();
  const rows=db.prepare('SELECT id,filename,mimetype,size_bytes,locked,uploaded_at,uploaded_by FROM activity_files WHERE entry_id=? ORDER BY uploaded_at ASC').all(req.params.id);
  res.json(rows.map(r=>({...r,filename:decrypt(r.filename)})));
});
app.post('/api/activity/entries/:id/files', authMiddleware, (req, res) => {
  const {filename,mimetype,data}=req.body;
  if (!filename||!data) return res.status(400).json({error:'filename et data requis'});
  const db=getDb(); const ip=getClientIp(req);
  const entry=db.prepare('SELECT id FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({error:'Note introuvable'});
  const size=Math.round((data.length*3)/4);
  const r=db.prepare('INSERT INTO activity_files (entry_id,filename,mimetype,size_bytes,data,locked,uploaded_by) VALUES (?,?,?,?,?,0,?)').run(req.params.id,encrypt(filename),mimetype||'application/octet-stream',size,encrypt(data),req.user.id);
  // Historique de la note
  db.prepare('INSERT INTO activity_entry_history (entry_id,event_type,detail,changed_by,changed_at) VALUES (?,?,?,?,?)').run(parseInt(req.params.id),'file_added',`Fichier ajouté : ${filename} (${(size/1024).toFixed(1)} Ko)`,req.user.id,nowLocal());
  // Audit global
  audit(db,{userId:req.user.id,username:req.user.username,action:'FICHIER_AJOUTE',category:'activity',severity:'info',detail:`Note #${req.params.id} — ${filename}`,ip,success:1});
  res.json({id:r.lastInsertRowid,filename,mimetype,size_bytes:size,locked:0,uploaded_at:new Date().toISOString()});
});
app.put('/api/activity/files/:id/lock', authMiddleware, (req, res) => {
  const db=getDb(); const ip=getClientIp(req);
  const row=db.prepare('SELECT id,locked,filename,entry_id FROM activity_files WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({error:'Fichier introuvable'});
  const newLock=row.locked?0:1;
  const fname=decrypt(row.filename);
  db.prepare('UPDATE activity_files SET locked=? WHERE id=?').run(newLock,req.params.id);
  const action=newLock?'verrouillé':'déverrouillé';
  // Historique de la note
  db.prepare('INSERT INTO activity_entry_history (entry_id,event_type,detail,changed_by,changed_at) VALUES (?,?,?,?,?)').run(row.entry_id,'file_locked',`Fichier ${action} : ${fname} (par ${req.user.username})`,req.user.id,nowLocal());
  // Audit global
  audit(db,{userId:req.user.id,username:req.user.username,action:newLock?'FICHIER_VERROUILLE':'FICHIER_DEVERROUILLE',category:'activity',severity:'info',detail:`Note #${row.entry_id} — ${fname}`,ip,success:1});
  res.json({success:true,locked:newLock});
});
app.delete('/api/activity/files/:id', authMiddleware, (req, res) => {
  const db=getDb(); const ip=getClientIp(req);
  const row=db.prepare('SELECT locked,filename,entry_id FROM activity_files WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({error:'Fichier introuvable'});
  if (row.locked) return res.status(403).json({error:'Fichier verrouille'});
  const fname=decrypt(row.filename);
  db.prepare('DELETE FROM activity_files WHERE id=?').run(req.params.id);
  // Historique de la note
  db.prepare('INSERT INTO activity_entry_history (entry_id,event_type,detail,changed_by,changed_at) VALUES (?,?,?,?,?)').run(row.entry_id,'file_deleted',`Fichier supprimé : ${fname} (par ${req.user.username})`,req.user.id,nowLocal());
  // Audit global
  audit(db,{userId:req.user.id,username:req.user.username,action:'FICHIER_SUPPRIME',category:'activity',severity:'warn',detail:`Note #${row.entry_id} — ${fname}`,ip,success:1});
  res.json({success:true});
});
app.get('/api/activity/files/:id/download', authMiddleware, (req, res) => {
  const db=getDb(); const ip=getClientIp(req);
  const row=db.prepare('SELECT * FROM activity_files WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({error:'Fichier introuvable'});
  const fname=decrypt(row.filename);
  const buf=Buffer.from(decrypt(row.data),'base64');
  // Audit global
  audit(db,{userId:req.user.id,username:req.user.username,action:'FICHIER_TELECHARGE',category:'activity',severity:'info',detail:`Note #${row.entry_id} — ${fname}`,ip,success:1});
  res.setHeader('Content-Disposition','attachment; filename="'+fname+'"');
  res.setHeader('Content-Type',row.mimetype);
  res.send(buf);
});

// ── SUIVI D'ACTIVITÉ — IMPORT CSV ─────────────────────────────────────────────
app.post('/api/activity/import-csv', authMiddleware, requirePerm('activity_tags'), (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'Contenu CSV manquant' });
  const db = getDb(); const ip = getClientIp(req);
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const results = { imported: 0, skipped: 0, errors: [], tagsCreated: [] };

  const insertEntry = db.prepare('INSERT INTO activity_entries (user_id, year, month, tag_code, content, is_preview, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)');
  const insertTag   = db.prepare("INSERT INTO activity_tags (code, label, color) VALUES (?,?,?)");
  const insertHist  = db.prepare('INSERT INTO activity_entry_history (entry_id, event_type, detail, changed_by, changed_at) VALUES (?,?,?,?,?)');

  const txn = db.transaction(() => {
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(';');
      if (parts.length < 5) { results.errors.push(`Ligne ${i+1}: format invalide (${parts.length} champs)`); results.skipped++; continue; }
      const [yearStr, monthStr, dayStr, tagRaw, ...noteParts] = parts;
      const year  = parseInt(yearStr);
      const month = parseInt(monthStr);
      const day   = parseInt(dayStr);
      const tag   = (tagRaw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20);
      const note  = noteParts.join(';').trim();

      if (!year || year < 2000 || year > 2100) { results.errors.push(`Ligne ${i+1}: année invalide (${yearStr})`); results.skipped++; continue; }
      if (!month || month < 1 || month > 12)   { results.errors.push(`Ligne ${i+1}: mois invalide (${monthStr})`); results.skipped++; continue; }
      if (!day   || day < 1   || day > 31)     { results.errors.push(`Ligne ${i+1}: jour invalide (${dayStr})`);   results.skipped++; continue; }
      if (!tag)  { results.errors.push(`Ligne ${i+1}: TAG vide`); results.skipped++; continue; }
      if (!note) { results.errors.push(`Ligne ${i+1}: note vide`); results.skipped++; continue; }

      // Créer le TAG s'il n'existe pas
      const existingTag = db.prepare('SELECT code FROM activity_tags WHERE code=?').get(tag);
      if (!existingTag) {
        try { insertTag.run(tag, 'A définir', '#000000'); results.tagsCreated.push(tag); } catch {}
      }

      // Construire la date
      const pad = n => String(n).padStart(2,'0');
      const createdAt = `${year}-${pad(month)}-${pad(day)} 00:00:00`;
      // Preview automatique si date future
      const today = new Date(); today.setHours(0,0,0,0);
      const entryDate = new Date(year, month-1, day);
      const isPreview = entryDate > today ? 1 : 0;
      const r = insertEntry.run(req.user.id, year, month, tag, note.trim(), isPreview, createdAt, createdAt);
      insertHist.run(r.lastInsertRowid, 'created', `[${tag}] Import CSV — ${note.trim().replace(/\[secret\][\s\S]*?\[\/secret\]/gi,'[secret]').slice(0,60)}`, req.user.id, nowLocal());
      results.imported++;
    }
  });

  try {
    txn();
    const tagInfo = results.tagsCreated.length ? ` · Tags créés: ${results.tagsCreated.join(', ')}` : '';
    audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_IMPORTÉ', category: 'suivi', severity: 'info',
      detail: `Import CSV — ${results.imported} note(s) importée(s), ${results.skipped} ignorée(s)${tagInfo}`, ip, success: 1 });
    res.json({ success: true, ...results });
  } catch (e) {
    audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_IMPORT_ÉCHEC', category: 'suivi', severity: 'warn',
      detail: `Import CSV échoué : ${e.message}`, ip, success: 0 });
    res.status(500).json({ error: e.message });
  }
});

// ── SUIVI D'ACTIVITÉ — AUDIT EXPORT ──────────────────────────────────────────
// Audit quand on ouvre une note en édition
app.post('/api/activity/entries/:id/audit-edit', authMiddleware, (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const entry = db.prepare('SELECT * FROM activity_entries WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Introuvable' });
  const pad = n => String(n).padStart(2,'0');
  const dateStr = `${pad(entry.created_at?.slice(8,10)||'??')}/${pad(entry.created_at?.slice(5,7)||'??')}/${entry.year}`;
  const excerpt = (entry.content||'').replace(/\[secret\][\s\S]*?\[\/secret\]/gi,'[secret]').slice(0,60);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'SUIVI_ÉDITÉ', category: 'suivi', severity: 'info',
    detail: `[${entry.tag_code}] ${dateStr} — ${excerpt}${excerpt.length===60?'…':''}`, ip, success: 1 });
  res.json({ success: true });
});
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

  // Stats Automatisation
  const autoDocTotal = db.prepare('SELECT COUNT(*) as c FROM automation_documents').get().c;
  const autoDocRecent = db.prepare(`
    SELECT d.name, d.created_at, c.name as cat_name, c.color as cat_color
    FROM automation_documents d
    LEFT JOIN automation_categories c ON d.category_id = c.id
    ORDER BY d.created_at DESC LIMIT 3`).all();
  const autoCatTop3 = db.prepare(`
    SELECT c.name, c.color, COUNT(d.id) as doc_count
    FROM automation_categories c
    LEFT JOIN automation_documents d ON d.category_id = c.id
    GROUP BY c.id HAVING doc_count > 0
    ORDER BY doc_count DESC LIMIT 3`).all();
  const autoExpiring = db.prepare(`
    SELECT d.name, d.valid_until, c.name as cat_name
    FROM automation_documents d
    LEFT JOIN automation_categories c ON d.category_id = c.id
    WHERE d.valid_until IS NOT NULL AND d.valid_until >= date('now')
    ORDER BY d.valid_until ASC LIMIT 3`).all();

  res.json({
    devices:       db.prepare('SELECT COUNT(*) as c FROM devices').get().c,
    sites:         db.prepare('SELECT COUNT(*) as c FROM sites').get().c,
    backups:       db.prepare('SELECT COUNT(*) as c FROM backups').get().c,
    models:        db.prepare('SELECT COUNT(*) as c FROM device_models').get().c,
    automation: {
      total:    autoDocTotal,
      recent:   autoDocRecent,
      top3cats: autoCatTop3,
      expiring: autoExpiring,
    },
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
// ── AUTOMATISATION — CATÉGORIES ───────────────────────────────────────────────
app.get('/api/automation/categories', authMiddleware, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM automation_categories ORDER BY name ASC').all());
});

app.post('/api/automation/categories', authMiddleware, requirePerm('automatisation_admin'), (req, res) => {
  const { name, description, type, color, parent_id, valid_until } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb(); const ip = getClientIp(req);
  const r = db.prepare('INSERT INTO automation_categories (name, description, type, color, parent_id, valid_until) VALUES (?,?,?,?,?,?)')
    .run(name.trim(), description?.trim() || null, type || 'generic', color || '#066fd1', parent_id || null, valid_until || null);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'CAT_CRÉÉE', category: 'automatisation', severity: 'info',
    detail: `"${name.trim()}" (${type || 'generic'})`, ip, success: 1 });
  res.json({ id: r.lastInsertRowid, success: true });
});

app.put('/api/automation/categories/:id', authMiddleware, requirePerm('automatisation_admin'), (req, res) => {
  const { name, description, type, color, parent_id, valid_until } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb(); const ip = getClientIp(req);
  const existing = db.prepare('SELECT * FROM automation_categories WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Introuvable' });
  // Empêcher catégorie parente d'elle-même ou cycle direct
  if (parent_id && parseInt(parent_id) === parseInt(req.params.id))
    return res.status(400).json({ error: 'Une catégorie ne peut pas être son propre parent' });
  db.prepare('UPDATE automation_categories SET name=?, description=?, type=?, color=?, parent_id=?, valid_until=?, updated_at=? WHERE id=?')
    .run(name.trim(), description?.trim() || null, type || 'generic', color || '#066fd1', parent_id || null, valid_until || null, nowLocal(), req.params.id);
  const changes = [];
  if (existing.name !== name.trim()) changes.push(`nom: "${existing.name}" → "${name.trim()}"`);
  if (existing.type !== (type || 'generic')) changes.push(`type: ${existing.type} → ${type}`);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'CAT_MODIFIÉE', category: 'automatisation', severity: 'info',
    detail: `"${name.trim()}" (${type || 'generic'})${changes.length ? ' — ' + changes.join(', ') : ''}`, ip, success: 1 });
  res.json({ success: true });
});

app.delete('/api/automation/categories/:id', authMiddleware, requirePerm('automatisation_admin'), (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const cat = db.prepare('SELECT * FROM automation_categories WHERE id=?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Introuvable' });
  // Vérifier enfants
  const children = db.prepare('SELECT COUNT(*) as c FROM automation_categories WHERE parent_id=?').get(req.params.id).c;
  if (children > 0) return res.status(409).json({ error: `Cette catégorie a ${children} sous-catégorie(s). Supprimez-les d'abord.` });
  db.prepare('DELETE FROM automation_categories WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'CAT_SUPPRIMÉE', category: 'automatisation', severity: 'warn',
    detail: `"${cat.name}" (${cat.type})`, ip, success: 1 });
  res.json({ success: true });
});

// ── AUTOMATISATION — DOCUMENTS ────────────────────────────────────────────────

// Liste des documents d'une catégorie
app.get('/api/automation/categories/:id/documents', authMiddleware, (req, res) => {
  const db = getDb();
  const docs = db.prepare(`
    SELECT d.*, u.username as created_by_name,
      (SELECT COUNT(*) FROM automation_document_files f WHERE f.document_id = d.id) as file_count
    FROM automation_documents d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.category_id = ? ORDER BY d.created_at DESC`).all(req.params.id);
  res.json(docs);
});

// Détail d'un document (avec ses fichiers)
app.get('/api/automation/documents/:id', authMiddleware, (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const doc = db.prepare(`
    SELECT d.*, u.username as created_by_name, c.type as category_type
    FROM automation_documents d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN automation_categories c ON d.category_id = c.id
    WHERE d.id = ?`).get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Introuvable' });
  const files = db.prepare(`
    SELECT f.id, f.filename, f.mimetype, f.size_bytes, f.uploaded_at, u.username as uploaded_by_name
    FROM automation_document_files f
    LEFT JOIN users u ON f.uploaded_by = u.id
    WHERE f.document_id = ? ORDER BY f.uploaded_at ASC`).all(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DOC_CONSULTÉ', category: 'automatisation', severity: 'info',
    detail: `Document "${doc.name}"`, ip, success: 1, ref_id: doc.id });
  res.json({ ...doc, files });
});

// Créer un document
app.post('/api/automation/categories/:id/documents', authMiddleware, requirePerm('automatisation_write'), (req, res) => {
  const { name, description, note, valid_until, doc_password } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb(); const ip = getClientIp(req);
  const cat = db.prepare('SELECT * FROM automation_categories WHERE id=?').get(req.params.id);
  const r = db.prepare('INSERT INTO automation_documents (category_id, name, description, note, valid_until, doc_password, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id, name.trim(), description?.trim()||null, note?.trim()||null, valid_until||null, doc_password||null, req.user.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DOC_CRÉÉ', category: 'automatisation', severity: 'info',
    detail: `Document "${name.trim()}" dans catégorie "${cat?.name||req.params.id}"`, ip, success: 1, ref_id: r.lastInsertRowid });
  res.json({ id: r.lastInsertRowid, success: true });
});

// Modifier un document
app.put('/api/automation/documents/:id', authMiddleware, requirePerm('automatisation_write'), (req, res) => {
  const { name, description, note, valid_until, doc_password } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb(); const ip = getClientIp(req);
  const doc = db.prepare('SELECT * FROM automation_documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Introuvable' });
  db.prepare('UPDATE automation_documents SET name=?, description=?, note=?, valid_until=?, doc_password=?, updated_at=? WHERE id=?')
    .run(name.trim(), description?.trim()||null, note?.trim()||null, valid_until||null, doc_password||doc.doc_password||null, nowLocal(), req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DOC_MODIFIÉ', category: 'automatisation', severity: 'info',
    detail: `Document "${name.trim()}"`, ip, success: 1, ref_id: parseInt(req.params.id) });
  res.json({ success: true });
});

// Supprimer un document
app.delete('/api/automation/documents/:id', authMiddleware, requirePerm('automatisation_write'), (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const doc = db.prepare('SELECT * FROM automation_documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Introuvable' });
  db.prepare('DELETE FROM automation_documents WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DOC_SUPPRIMÉ', category: 'automatisation', severity: 'warn',
    detail: `Document "${doc.name}"`, ip, success: 1 });
  res.json({ success: true });
});

// Ajouter un fichier joint à un document
app.post('/api/automation/documents/:id/files', authMiddleware, requirePerm('automatisation_write'), (req, res) => {
  const { filename, mimetype, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'Fichier requis' });
  const db = getDb(); const ip = getClientIp(req);
  const doc = db.prepare('SELECT * FROM automation_documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  const buf = Buffer.from(data, 'base64');
  const r = db.prepare('INSERT INTO automation_document_files (document_id, filename, mimetype, size_bytes, data, uploaded_by) VALUES (?,?,?,?,?,?)')
    .run(req.params.id, filename, mimetype||'application/octet-stream', buf.length, buf, req.user.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'FICHIER_AJOUTÉ', category: 'automatisation', severity: 'info',
    detail: `"${filename}" → document "${doc.name}"`, ip, success: 1, ref_id: parseInt(req.params.id) });
  res.json({ id: r.lastInsertRowid, success: true });
});

// Télécharger un fichier joint
app.get('/api/automation/files/:id/download', authMiddleware, (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const row = db.prepare(`SELECT f.*, d.name as doc_name FROM automation_document_files f LEFT JOIN automation_documents d ON f.document_id=d.id WHERE f.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  audit(db, { userId: req.user.id, username: req.user.username, action: 'FICHIER_TÉLÉCHARGÉ', category: 'automatisation', severity: 'info',
    detail: `"${row.filename}" (doc: "${row.doc_name}")`, ip, success: 1, ref_id: row.document_id });
  res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`);
  res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
  res.send(Buffer.from(row.data));
});

// Supprimer un fichier joint
app.delete('/api/automation/files/:id', authMiddleware, requirePerm('automatisation_write'), (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const f = db.prepare(`SELECT f.*, d.name as doc_name FROM automation_document_files f LEFT JOIN automation_documents d ON f.document_id=d.id WHERE f.id=?`).get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Introuvable' });
  db.prepare('DELETE FROM automation_document_files WHERE id=?').run(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'FICHIER_SUPPRIMÉ', category: 'automatisation', severity: 'warn',
    detail: `"${f.filename}" du document "${f.doc_name}"`, ip, success: 1, ref_id: f.document_id });
  res.json({ success: true });
});

// Audit tentative accès document sécurisé échouée
app.post('/api/automation/documents/:id/access-denied', authMiddleware, (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const doc = db.prepare('SELECT name FROM automation_documents WHERE id=?').get(req.params.id);
  audit(db, { userId: req.user.id, username: req.user.username, action: 'DOC_ACCÈS_REFUSÉ', category: 'automatisation', severity: 'warn',
    detail: `Tentative d'accès refusée — document "${doc?.name||req.params.id}"`, ip, success: 0, ref_id: parseInt(req.params.id) });
  res.json({ success: true });
});

// Audit copie d'un fichier script
app.post('/api/automation/files/:id/copy-audit', authMiddleware, (req, res) => {
  const db = getDb(); const ip = getClientIp(req);
  const row = db.prepare(`SELECT f.filename, d.name as doc_name FROM automation_document_files f LEFT JOIN automation_documents d ON f.document_id=d.id WHERE f.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  audit(db, { userId: req.user.id, username: req.user.username, action: 'FICHIER_COPIÉ', category: 'automatisation', severity: 'info',
    detail: `"${row.filename}" (doc: "${row.doc_name}") copié dans le presse-papier`, ip, success: 1 });
  res.json({ success: true });
});

// Prévisualisation d'un fichier (texte/PDF/Word via LibreOffice)
app.get('/api/automation/files/:id/preview', authMiddleware, async (req, res) => {
  const os = require('os'); const path = require('path');
  const { execFile } = require('child_process'); const fs = require('fs');
  const db = getDb(); const ip = getClientIp(req);

  const row = db.prepare(`
    SELECT f.*, d.name as doc_name
    FROM automation_document_files f
    LEFT JOIN automation_documents d ON d.id = f.document_id
    WHERE f.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Introuvable' });

  audit(db, { userId: req.user.id, username: req.user.username,
    action: 'FICHIER_PRÉVISUALISÉ', category: 'automatisation', severity: 'info',
    detail: `"${row.filename}" (doc: "${row.doc_name}")`, ip, success: 1, ref_id: row.document_id });

  const buf = Buffer.from(row.data);
  const fn  = row.filename.toLowerCase();
  const mime = row.mimetype || '';

  // ── Office → LibreOffice → PDF (avec cache en base) ─────────────────────────
  if (fn.match(/\.(docx?|odt|odp|pptx?|xlsx?|ods|odg)$/) ||
      mime.includes('word') || mime.includes('officedocument') || mime.includes('opendocument')) {

    // Vérifier le cache — valide tant que le fichier n'a pas été remplacé
    if (row.pdf_cache && row.pdf_cached_at) {
      logger.info(`[PREVIEW] Cache HIT pour fichier #${row.id} "${row.filename}"`);
      const cached = Buffer.from(row.pdf_cache);
      return res.json({ type: 'pdf', content: cached.toString('base64'),
        filename: row.filename, mimetype: 'application/pdf', cached: true });
    }

    logger.info(`[PREVIEW] Conversion LibreOffice pour #${row.id} "${row.filename}"...`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv_lo_'));
    const ext    = path.extname(row.filename) || '.docx';
    const safeBaseName = `doc_${row.id}`;
    const tmpIn  = path.join(tmpDir, safeBaseName + ext);

    try {
      fs.writeFileSync(tmpIn, buf);
      // Chercher l'exécutable LibreOffice (soffice sur Alpine, libreoffice sur Debian/Ubuntu)
      const loBin = await new Promise(resolve => {
        const { execFile: ef } = require('child_process');
        ef('which', ['soffice'], (e, out) => {
          if (!e && out.trim()) return resolve('soffice');
          ef('which', ['libreoffice'], (e2, out2) => {
            resolve(!e2 && out2.trim() ? 'libreoffice' : 'soffice');
          });
        });
      });
      logger.info(`[PREVIEW] LibreOffice binary: ${loBin}`);

      await new Promise((resolve, reject) => {
        execFile(loBin, [
          '--headless', '--convert-to', 'pdf', '--outdir', tmpDir, tmpIn,
        ], { timeout: 60000, env: { ...process.env, HOME: tmpDir } }, (err, stdout, stderr) => {
          if (err) {
            logger.warn(`[PREVIEW] LibreOffice stderr: ${stderr}`);
            return reject(new Error(err.message + (stderr ? '\n' + stderr.slice(0, 200) : '')));
          }
          resolve();
        });
      });
      const pdfPath = path.join(tmpDir, safeBaseName + '.pdf');
      if (!fs.existsSync(pdfPath)) throw new Error(`LibreOffice n'a pas produit de PDF (${pdfPath})`);
      const pdfBuf = fs.readFileSync(pdfPath);

      // Sauvegarder en cache dans la base
      db.prepare(`UPDATE automation_document_files
        SET pdf_cache = ?, pdf_cached_at = datetime('now','localtime')
        WHERE id = ?`).run(pdfBuf, row.id);
      logger.info(`[PREVIEW] PDF en cache (${pdfBuf.length} o) pour #${row.id}`);

      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return res.json({ type: 'pdf', content: pdfBuf.toString('base64'),
        filename: row.filename, mimetype: 'application/pdf', cached: false });

    } catch (err) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      logger.warn(`[PREVIEW] LibreOffice échoué pour #${row.id}: ${err.message}`);
      return res.json({ type: 'office', content: buf.toString('base64'),
        filename: row.filename, mimetype: row.mimetype });
    }
  }

  // ── PDF direct ───────────────────────────────────────────────────────────────
  if (fn.endsWith('.pdf') || mime === 'application/pdf') {
    return res.json({ type: 'pdf', content: buf.toString('base64'),
      filename: row.filename, mimetype: 'application/pdf' });
  }

  // ── Texte / Code ─────────────────────────────────────────────────────────────
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('yaml') ||
      mime.includes('xml') || mime.includes('javascript') || mime.includes('python') ||
      mime.includes('shell') || ['.txt','.md','.yaml','.yml','.json','.xml','.sh',
      '.py','.js','.ts','.sql','.ini','.cfg','.conf','.toml','.html','.htm',
      '.css','.rb','.go','.java','.c','.cpp','.h','.rs','.php'].some(e => fn.endsWith(e))) {
    return res.json({ type: 'text', content: buf.toString('utf8'),
      filename: row.filename, mimetype: mime });
  }

  res.json({ type: 'unsupported', filename: row.filename });
});

// Historique d'un document
app.get('/api/automation/documents/:id/history', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT action, detail, username, created_at, severity
    FROM audit_log
    WHERE ref_id = ? AND category = 'automatisation'
    ORDER BY created_at DESC LIMIT 100`).all(req.params.id);
  res.json(rows);
});

module.exports = { logger };

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
      // If env APP_URL set but not yet in DB, persist it
      else if (process.env.APP_URL && !cfg.app_url) {
        cfg.app_url = process.env.APP_URL;
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('smtp_config', ?)").run(JSON.stringify(cfg));
        logger.info('[APP_URL] URL injectée depuis la variable d\'environnement: ' + process.env.APP_URL);
      }
    } catch {}
  } else if (process.env.APP_URL) {
    // No smtp_config yet — create one with just app_url
    const cfg = { host:'', port:587, secure:false, user:'', pass:'', from:'', app_url: process.env.APP_URL };
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('smtp_config', ?)").run(JSON.stringify(cfg));
    logger.info('[APP_URL] URL injectée depuis la variable d\'environnement (config SMTP vide): ' + process.env.APP_URL);
  }
  // Charger config Slack
  const slackRow = db.prepare("SELECT value FROM settings WHERE key='slack_config'").get();
  if (slackRow) { try { const sl = JSON.parse(slackRow.value); if (sl.webhook_url) process.env.SLACK_WEBHOOK_URL = sl.webhook_url; } catch {} }
  // Charger config Telegram
  const tgRow = db.prepare("SELECT value FROM settings WHERE key='telegram_config'").get();
  if (tgRow) {
    try {
      const tg = JSON.parse(tgRow.value);
      if (tg.bot_token) { process.env.TELEGRAM_BOT_TOKEN = tg.bot_token; process.env.TELEGRAM_CHAT_ID = tg.chat_id || ''; }
    } catch {}
  }
});
