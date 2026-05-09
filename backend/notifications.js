// ── NexusVault — Moteur de notifications ─────────────────────────────────────
// Architecture extensible : chaque "channel" est un handler indépendant.
// Pour ajouter un nouveau canal (ex: Slack, Webhook), ajouter une entrée dans CHANNELS.

const nodemailer = require('nodemailer');

// ── Catalogue des événements notifiables ─────────────────────────────────────
const EVENT_CATALOG = {
  backup_download: {
    key:         'backup_download',
    label:       'Téléchargement de configuration',
    description: 'Déclenché quand un utilisateur télécharge la configuration d\'un équipement.',
    options:     {},
  },
  login_failed_threshold: {
    key:         'login_failed_threshold',
    label:       'Tentatives de connexion échouées',
    description: 'Alerte après N tentatives échouées depuis la même IP.',
    options:     { threshold: 3 }, // nb tentatives avant alerte
  },
  account_locked: {
    key:         'account_locked',
    label:       'Compte verrouillé (brute force)',
    description: 'Déclenché quand un compte est verrouillé après 5 tentatives échouées. Inclut toutes les tentatives des 10 dernières minutes.',
    options:     {},
  },
  preview_recap: {
    key:         'preview_recap',
    label:       'Récapitulatif des notes en preview',
    description: 'Résumé périodique de toutes les notes marquées preview.',
    options:     { frequency: 'weekly', day_of_week: 1, day_of_month: 1 }, // weekly|monthly|daily
  },
  preview_overdue: {
    key:         'preview_overdue',
    label:       'Notes preview sur mois/années passés',
    description: 'Alerte si des notes preview existent sur des périodes déjà écoulées.',
    options:     { frequency: 'daily' },
  },
  expiration_document: {
    key:         'expiration_document',
    label:       'Expiration de document',
    description: 'Envoie une notification x jours avant la fin de la validité d\'une catégorie temporaire.',
    options:     { days_before: 30 },
  },
};

module.exports.EVENT_CATALOG = EVENT_CATALOG;

// ── Canaux de notification disponibles ───────────────────────────────────────
// Ajouter un nouveau canal ici pour l'exposer dans l'interface
const CHANNEL_CATALOG = {
  email: {
    key:   'email',
    label: 'Email (SMTP)',
    icon:  'mail',
    available: () => !!process.env.SMTP_HOST,
  },
  log: {
    key:   'log',
    label: 'Logs Docker',
    icon:  'terminal',
    available: () => true,
  },
  telegram: {
    key:   'telegram',
    label: 'Telegram',
    icon:  'telegram',
    available: () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  },
  slack: {
    key:   'slack',
    label: 'Slack',
    icon:  'slack',
    available: () => !!process.env.SLACK_WEBHOOK_URL,
  },
  // Futurs canaux
  // webhook: { key:'webhook', label:'Webhook HTTP', icon:'link', available:()=>false },
  // teams:   { key:'teams',   label:'MS Teams',     icon:'teams', available:()=>false },
};

module.exports.CHANNEL_CATALOG = CHANNEL_CATALOG;

// ── Envoi effectif via un canal ───────────────────────────────────────────────
async function sendViaChannel(channel, { subject, body, bodyText }) {
  switch (channel) {
    case 'email': {
      if (!process.env.SMTP_HOST) throw new Error('SMTP non configuré');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
      });
      const from = process.env.SMTP_FROM || 'NexusVault <no-reply@nexusvault.local>';
      // Récupérer les emails des admins
      const { getDb } = require('./db.js');
      const db = getDb();
      const admins = db.prepare("SELECT email FROM users WHERE role='admin' AND enabled=1 AND email IS NOT NULL AND email != ''").all();
      if (!admins.length) throw new Error('Aucun admin avec email configuré');
      const to = admins.map(a => a.email).join(', ');
      await transport.sendMail({
        from, to,
        subject: `[NexusVault] ${subject}`,
        html: wrapHtml(subject, body),
        text: bodyText || body,
      });
      return { to };
    }
    case 'log': {
      const { logger } = require('./server.js');
      (logger || console).warn(`[NOTIF] ${subject} — ${bodyText || body}`);
      return {};
    }
    case 'telegram': {
      const token  = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID non configuré');
      const text = `🔔 *NexusVault*\n*${subject}*\n\n${(bodyText || body).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}`;
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Erreur Telegram');
      return { chat_id: chatId };
    }
    case 'slack': {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL non configuré');
      const resp = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `*${subject}*\n${bodyText || body}` }),
      });
      if (!resp.ok) throw new Error(`Slack HTTP ${resp.status}`);
      return {};
    }
    default:
      throw new Error(`Canal "${channel}" non implémenté`);
  }
}

// ── Dispatcher principal ──────────────────────────────────────────────────────
async function dispatch(eventKey, payload, getDb) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM notification_config WHERE event_key=? AND enabled=1").get(eventKey);
  if (!row) return; // non configuré ou désactivé

  let channels = [];
  try { channels = JSON.parse(row.channels); } catch {}
  if (!channels.length) return;

  const { subject, body, bodyText } = buildMessage(eventKey, payload);

  for (const channel of channels) {
    let success = 1, error = null;
    try {
      await sendViaChannel(channel, { subject, body, bodyText });
    } catch (e) {
      success = 0;
      error = e.message;
      // Fallback vers logs si email échoue
      if (channel === 'email') {
        try { process.stdout.write(`[NOTIF][FALLBACK] ${subject} — ${bodyText || body}\n`); } catch {}
      }
    }
    const pad = n => String(n).padStart(2,'0');
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    db.prepare("INSERT INTO notification_log (event_key, channel, subject, body, sent_at, success, error) VALUES (?,?,?,?,?,?,?)")
      .run(eventKey, channel, subject, bodyText || body, nowStr, success, error);
  }
}

module.exports.dispatch = dispatch;

// ── Construction des messages par événement ───────────────────────────────────
function buildMessage(eventKey, p) {
  switch (eventKey) {
    case 'backup_download':
      return {
        subject: `Téléchargement de configuration — ${p.device || '?'}`,
        body: `<p>Un utilisateur a téléchargé une configuration d'équipement.</p>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <tr><td style="padding:6px 10px;color:#64748b;width:140px">Date / Heure</td><td style="padding:6px 10px"><strong>${p.datetime || '?'}</strong></td></tr>
  <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Utilisateur</td><td style="padding:6px 10px">${p.username || '?'}</td></tr>
  <tr><td style="padding:6px 10px;color:#64748b">Adresse IP</td><td style="padding:6px 10px">${p.ip || '?'}</td></tr>
  <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Équipement</td><td style="padding:6px 10px">${p.device || '?'}</td></tr>
  <tr><td style="padding:6px 10px;color:#64748b">Version</td><td style="padding:6px 10px">${p.version || '?'}</td></tr>
</table>`,
        bodyText: `Téléchargement: ${p.device} par ${p.username} depuis ${p.ip} le ${p.datetime}`,
      };

    case 'login_failed_threshold':
      return {
        subject: `Tentatives de connexion échouées — ${p.username || '?'}`,
        body: `<p>Le seuil d'alertes de connexions échouées a été atteint.</p>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <tr><td style="padding:6px 10px;color:#64748b;width:140px">Date / Heure</td><td style="padding:6px 10px"><strong>${p.datetime || '?'}</strong></td></tr>
  <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Identifiant</td><td style="padding:6px 10px">${p.username || '?'}</td></tr>
  <tr><td style="padding:6px 10px;color:#64748b">Adresse IP</td><td style="padding:6px 10px">${p.ip || '?'}</td></tr>
  <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Tentatives</td><td style="padding:6px 10px">${p.attempts || '?'} / ${p.threshold || 5}</td></tr>
</table>`,
        bodyText: `${p.attempts} tentatives échouées pour "${p.username}" depuis ${p.ip} le ${p.datetime}`,
      };

    case 'account_locked':
      return {
        subject: `Compte verrouillé — ${p.username || '?'}`,
        body: `<p>Un compte a été verrouillé suite à une attaque par force brute.</p>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <tr><td style="padding:6px 10px;color:#64748b;width:140px">Date / Heure</td><td style="padding:6px 10px"><strong>${p.datetime || '?'}</strong></td></tr>
  <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Identifiant</td><td style="padding:6px 10px">${p.username || '?'}</td></tr>
  <tr><td style="padding:6px 10px;color:#64748b">Adresse IP</td><td style="padding:6px 10px">${p.ip || '?'}</td></tr>
  <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Tentatives</td><td style="padding:6px 10px">${p.attempts || 5} en 10 minutes</td></tr>
  <tr><td style="padding:6px 10px;color:#64748b">Verrouillé jusqu'à</td><td style="padding:6px 10px">${p.locked_until || '?'}</td></tr>
</table>`,
        bodyText: `Compte "${p.username}" verrouillé depuis ${p.ip} — ${p.attempts} tentatives en 10 min`,
      };

    case 'preview_recap':
      return {
        subject: 'Récapitulatif des notes en preview',
        body: `<p>Voici le récapitulatif des notes marquées "preview" dans NexusVault.</p>${p.html || '<p>Aucune note en preview.</p>'}`,
        bodyText: p.text || 'Aucune note en preview.',
      };

    case 'preview_overdue':
      return {
        subject: 'Notes preview sur des périodes passées',
        body: `<p><strong>Attention</strong> : des notes sont marquées "preview" sur des mois ou années déjà écoulés.</p>${p.html || ''}`,
        bodyText: p.text || '',
      };

    default:
      return { subject: `Événement NexusVault: ${eventKey}`, body: JSON.stringify(p), bodyText: JSON.stringify(p) };
  }
}

// ── Template HTML email ───────────────────────────────────────────────────────
function wrapHtml(subject, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:32px">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#0d47a1,#26c6da);padding:20px 28px">
    <div style="color:white;font-size:20px;font-weight:800;letter-spacing:1px">NEXUS<span style="opacity:.7">VAULT</span></div>
    <div style="color:rgba(255,255,255,.75);font-size:13px;margin-top:4px">${subject}</div>
  </div>
  <div style="padding:24px 28px">${body}</div>
  <div style="background:#f8fafc;padding:12px 28px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8">
    NexusVault — Notification automatique — Ne pas répondre
  </div>
</div></body></html>`;
}
