const jwt = require('jsonwebtoken');
const { getDb, audit } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '';
}

function checkWhitelist(req) {
  const db = getDb();
  const rows = db.prepare("SELECT value_enc, type FROM whitelist WHERE enabled = 1").all();
  if (rows.length === 0) return true; // whitelist vide = tout autorisé
  const { decrypt } = require('./db');
  const ip = getClientIp(req);
  const origin = req.headers.origin || req.headers.referer || '';
  for (const row of rows) {
    const val = decrypt(row.value_enc);
    if (row.type === 'ip' && ip.includes(val)) return true;
    if (row.type === 'url' && origin.includes(val)) return true;
  }
  return false;
}

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Non authentifié' });
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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
    let perms = {};
    try { perms = JSON.parse(req.user.permissions || '{}'); } catch {}
    if (!perms[perm]) return res.status(403).json({ error: 'Permission insuffisante' });
    next();
  };
}

module.exports = { authMiddleware, requireRole, requirePerm, JWT_SECRET, getClientIp, checkWhitelist };
