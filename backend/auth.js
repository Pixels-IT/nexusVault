const jwt = require('jsonwebtoken');
const { getDb, audit } = require('./db');

// ── Validation du secret JWT au démarrage ───────────────────────────────────
// Un secret manquant ou laissé à une valeur par défaut connue permettrait à
// quiconque de forger des tokens : on refuse de démarrer.
const KNOWN_BAD_JWT_SECRETS = [
  'fallback-secret-change-me',
  'CHANGEZ-CE-SECRET-JWT-AVANT-PROD!!',
  'CHANGEZ-CE-SECRET-JWT-AVANT-PRODUCTION!!',
];
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || KNOWN_BAD_JWT_SECRETS.includes(JWT_SECRET)) {
  console.error('[FATAL] JWT_SECRET absent, trop court (<32 caractères) ou laissé à sa valeur par défaut.');
  console.error('[FATAL] Générez un secret : openssl rand -hex 32  — puis renseignez-le dans .env');
  process.exit(1);
}

// Algorithme de signature imposé — empêche les attaques de confusion d'algorithme
const JWT_ALG = 'HS256';

function getClientIp(req) {
  return req.headers['x-real-ip']
    || req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || '';
}

function checkWhitelist(req) {
  const db = getDb();
  const rows = db.prepare("SELECT value_enc, type FROM whitelist WHERE enabled = 1").all();
  if (rows.length === 0) return true;
  const { decrypt } = require('./db');
  const rawIp = getClientIp(req);
  const clientIp = rawIp.replace(/^::ffff:/, '').trim();
  const origin = req.headers.origin || req.headers.referer || '';

  for (const row of rows) {
    const val = decrypt(row.value_enc).trim();
    if (row.type === 'ip') {
      if (val.includes('/')) {
        try {
          const [network, bits] = val.split('/');
          const n = parseInt(bits);
          if (n < 0 || n > 32) continue;
          const toInt = ip => ip.split('.').reduce((a, o) => ((a << 8) >>> 0) + parseInt(o), 0) >>> 0;
          const mask   = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
          const match  = ((toInt(clientIp) & mask) >>> 0) === ((toInt(network) & mask) >>> 0);
          if (match) return true;
        } catch (e) { process.stdout.write(`[WHITELIST] CIDR err: ${e.message}\n`); }
      } else {
        if (clientIp === val || (val.endsWith('.') && clientIp.startsWith(val))) return true;
      }
    }
    if (row.type === 'url' && origin.includes(val)) return true;
  }
  process.stdout.write(`[WHITELIST] BLOCKED: ${clientIp} → ${req.path}\n`);
  return false;
}

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Non authentifié' });
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  };
}

function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (req.user.role === 'admin') return next();
    // 1. Vérifier les permissions individuelles du JWT
    let jwtPerms = {};
    try { jwtPerms = JSON.parse(req.user.permissions || '{}'); } catch {}
    if (jwtPerms[perm] === true) return next();
    // 2. Vérifier les role_permissions sauvegardées en base (matrice)
    try {
      const db = getDb();
      const row = db.prepare("SELECT value FROM settings WHERE key='role_permissions'").get();
      if (row) {
        const rolePerms = JSON.parse(row.value);
        const permsForRole = rolePerms[req.user.role] || {};
        if (permsForRole[perm] === true) return next();
      }
    } catch {}
    return res.status(403).json({ error: 'Permission insuffisante' });
  };
}

module.exports = { authMiddleware, requireRole, requirePerm, JWT_SECRET, JWT_ALG, getClientIp, checkWhitelist };
