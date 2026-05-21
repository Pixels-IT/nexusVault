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
    key:         'preview_recap',
    label:       'Récapitulatif des notes en brouillon à venir',
    description: 'Résumé périodique de toutes les notes futures marquées en brouillon (00h05).'
  },
  retention_recap: {
    key:         'retention_recap',
    label:       'Récapitulatif des fichiers en rétention',
    description: 'Résumé périodique des fichiers en rétention qui arrivent à expiration (00h05).',
    options:     { frequency: 'weekly', day_of_week: 1, day_of_month: 1 },
  },
  preview_overdue: {
    key:         'preview_overdue',
    label:       'Récapitulatif des notes en brouillon passées',
    description: 'Résumé périodique de toutes les notes passées en brouillon (00h05)',
  },
  expiration_document: {
    key:         'expiration_document',
    label:       'Expiration de document',
    description: 'Envoie une notification à partir de x jours avant la fin de la validité d\'une catégorie temporaire. (00h05)',
    options:     { days_before: 30 },
  },
  backup_schedule_result: {
    key:         'backup_schedule_result',
    label:       'Résultat des sauvegardes automatiques des équipements',
    description: 'Envoie un rapport après chaque exécution de planification de backup équipement : statut (succès/échec) par équipement.',
    options:     { notify_on_success: true, notify_on_failure: true },
  },
  document_deleted: {
    key:         'document_deleted',
    label:       'Suppression d\'un document',
    description: 'Alerte quand un utilisateur supprime un document de la partie Automatisation.',
    options:     {},
  },
  file_deleted: {
    key:         'file_deleted',
    label:       'Suppression d\'un fichier dans un document',
    description: 'Alerte quand un utilisateur supprime un fichier intégré à un document.',
    options:     {},
  },
  backup_deleted: {
    key:         'backup_deleted',
    label:       'Suppression d\'une sauvegarde',
    description: 'Alerte quand un utilisateur supprime une sauvegarde de la partie Backup.',
    options:     {},
  },
  activity_deleted: {
    key:         'activity_deleted',
    label:       'Suppression d\'un suivi d\'activité',
    description: 'Alerte quand un utilisateur supprime un suivi d\'activité.',
    options:     {},
  },
  activity_file_deleted: {
    key:         'activity_file_deleted',
    label:       'Suppression d\'un fichier d\'un suivi d\'activité',
    description: 'Alerte quand un utilisateur supprime un fichier dans un suivi d\'activité.',
    options:     {},
  },
  db_backup_created: {
    key:         'db_backup_created',
    label:       'Création d\'une backup SQLite',
    description: 'Alerte quand un utilisateur déclenche une sauvegarde manuelle de la base de données.',
    options:     {},
  },
  db_backup_deleted: {
    key:         'db_backup_deleted',
    label:       'Suppression d\'une backup SQLite',
    description: 'Alerte quand un utilisateur supprime un fichier de sauvegarde SQLite.',
    options:     {},
  },
  db_backup_downloaded: {
    key:         'db_backup_downloaded',
    label:       'Téléchargement d\'une backup SQLite',
    description: 'Alerte quand un utilisateur télécharge un fichier de sauvegarde SQLite.',
    options:     {},
  },
  db_backup_restored: {
    key:         'db_backup_restored',
    label:       'Restauration d\'une backup SQLite',
    description: 'Alerte quand un utilisateur restaure la base de données depuis un fichier de sauvegarde.',
    options:     {},
  },
  db_backup_sqlite_alert: {
    key:         'db_backup_sqlite_alert',
    label:       'Alerte des sauvegardes SQLite',
    description: 'Envoyée après chaque backup SQLite automatique : nom du fichier, date, taille, statut OK ou Échec.',
    options:     {},
  },
};

module.exports.EVENT_CATALOG = EVENT_CATALOG;

// ── Canaux de notification disponibles ───────────────────────────────────────
// Ajouter un nouveau canal ici pour l'exposer dans l'interface
function getChannelAvailability() {
  try {
    const { getDb } = require('./db.js');
    const db = getDb();
    const smtpRow = db.prepare("SELECT value FROM settings WHERE key='smtp_config'").get();
    const tgRow   = db.prepare("SELECT value FROM settings WHERE key='telegram_config'").get();
    const slRow   = db.prepare("SELECT value FROM settings WHERE key='slack_config'").get();
    const smtp    = smtpRow   ? JSON.parse(smtpRow.value)   : {};
    const tg      = tgRow     ? JSON.parse(tgRow.value)     : {};
    const sl      = slRow     ? JSON.parse(slRow.value)     : {};
    return {
      email:    !!(smtp.host || process.env.SMTP_HOST),
      telegram: !!(tg.bot_token || process.env.TELEGRAM_BOT_TOKEN),
      slack:    !!(sl.webhook_url || process.env.SLACK_WEBHOOK_URL),
    };
  } catch { return { email: !!process.env.SMTP_HOST, telegram: !!(process.env.TELEGRAM_BOT_TOKEN), slack: !!process.env.SLACK_WEBHOOK_URL }; }
}

const CHANNEL_CATALOG = {
  email: {
    key:   'email',
    label: 'Email (SMTP)',
    icon:  'mail',
    available: () => getChannelAvailability().email,
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
    available: () => getChannelAvailability().telegram,
  },
  slack: {
    key:   'slack',
    label: 'Slack',
    icon:  'slack',
    available: () => getChannelAvailability().slack,
  },
  // Futurs canaux
  // webhook: { key:'webhook', label:'Webhook HTTP', icon:'link', available:()=>false },
  // teams:   { key:'teams',   label:'MS Teams',     icon:'teams', available:()=>false },
};

module.exports.CHANNEL_CATALOG = CHANNEL_CATALOG;

// ── Envoi effectif via un canal ───────────────────────────────────────────────
async function sendViaChannel(channel, { subject, body, bodyText }, getDb) {
  switch (channel) {
    case 'email': {
      const _sdb = getDb();
      const _smtpRow = _sdb.prepare("SELECT value FROM settings WHERE key='smtp_config'").get();
      const _smtp = _smtpRow ? JSON.parse(_smtpRow.value) : {};
      const smtpHost = _smtp.host || process.env.SMTP_HOST;
      const smtpPort = parseInt(_smtp.port || process.env.SMTP_PORT || '587');
      const smtpSecure = (_smtp.secure !== undefined ? _smtp.secure : process.env.SMTP_SECURE === 'true');
      const smtpUser = _smtp.user || process.env.SMTP_USER;
      const smtpPass = _smtp.pass || process.env.SMTP_PASS || '';
      const smtpFrom = _smtp.from || process.env.SMTP_FROM || 'NexusVault <no-reply@nexusvault.local>';
      if (!smtpHost) throw new Error('SMTP non configuré');
      const transport = nodemailer.createTransport({
        host: smtpHost, port: smtpPort, secure: smtpSecure,
        connectionTimeout: 10000, greetingTimeout: 8000, socketTimeout: 15000,
        auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      });
      const from = smtpFrom;
      // Récupérer les destinataires selon la configuration
      const _emailDb = getDb();
      const recipientsMode  = (_emailDb.prepare("SELECT value FROM settings WHERE key='notif_recipients_mode'").get()?.value) || 'admins_only';
      const extraEmailsRaw  = (_emailDb.prepare("SELECT value FROM settings WHERE key='notif_extra_emails'").get()?.value) || '';
      const extraEmails     = extraEmailsRaw.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
      let toEmails = [];
      if (recipientsMode !== 'extra_only') {
        // Inclure les admins (mode 'admins_only' ou 'admins_and_extra')
        const admins = _emailDb.prepare("SELECT email FROM users WHERE role='admin' AND enabled=1 AND email IS NOT NULL AND email != ''").all();
        toEmails.push(...admins.map(a => a.email));
      }
      if (recipientsMode !== 'admins_only') {
        // Inclure les destinataires supplémentaires
        toEmails.push(...extraEmails);
      }
      toEmails = [...new Set(toEmails)]; // dédupliquer
      if (!toEmails.length) throw new Error('Aucun destinataire configuré pour les notifications email');
      const to = toEmails.join(', ');
      await transport.sendMail({
        from, to,
        subject: `[NexusVault] ${subject}`,
        html: wrapHtml(subject, body),
        text: bodyText || body,
      });
      return { to };
    }
    case 'log': {
      process.stdout.write(`[NOTIF] ${subject} — ${bodyText || body}\n`);
      return {};
    }
    case 'telegram': {
      const _tgsdb = getDb();
      const _tgRow = _tgsdb.prepare("SELECT value FROM settings WHERE key='telegram_config'").get();
      const _tgCfg = _tgRow ? JSON.parse(_tgRow.value) : {};
      const token  = _tgCfg.bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = _tgCfg.chat_id   || process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) throw new Error('Telegram non configuré');
      // Utiliser HTML plutôt que MarkdownV2 — beaucoup plus permissif (seuls <, >, & à échapper)
      const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const text = `🔔 <b>NexusVault</b>\n<b>${escHtml(subject)}</b>\n\n${escHtml(bodyText || body)}`;
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.description || 'Erreur Telegram');
      return { chat_id: chatId };
    }
    case 'slack': {
      const _slsdb = getDb();
      const _slRow = _slsdb.prepare("SELECT value FROM settings WHERE key='slack_config'").get();
      const _slCfg = _slRow ? JSON.parse(_slRow.value) : {};
      const webhookUrl = _slCfg.webhook_url || process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) throw new Error('Slack non configuré');
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
  try {
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
        await sendViaChannel(channel, { subject, body, bodyText }, getDb);
      } catch (e) {
        success = 0;
        error = e.message;
        process.stdout.write(`[NOTIF][ERROR] ${eventKey}/${channel}: ${e.message}\n`);
        if (channel === 'email') {
          try { process.stdout.write(`[NOTIF][FALLBACK] ${subject} — ${bodyText || body}\n`); } catch {}
        }
      }
      const pad = n => String(n).padStart(2,'0');
      const now = new Date();
      const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      try {
        db.prepare("INSERT INTO notification_log (event_key, channel, subject, body, sent_at, success, error) VALUES (?,?,?,?,?,?,?)")
          .run(eventKey, channel, subject, bodyText || body, nowStr, success, error);
      } catch (logErr) {
        process.stdout.write(`[NOTIF][LOG_ERROR] ${logErr.message}\n`);
      }
    }
  } catch (e) {
    process.stdout.write(`[NOTIF][DISPATCH_ERROR] ${eventKey}: ${e.message}\n`);
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

    case 'retention_recap':
      return {
        subject: `Récapitulatif rétention — ${p.count || 0} élément${(p.count||0) > 1 ? 's' : ''}`,
        body: p.html || '<p>Aucun élément en rétention.</p>',
        bodyText: p.text || 'Aucun élément en rétention.',
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

    case 'backup_schedule_result':
      return {
        subject: `Sauvegardes automatiques "${p.subject?.replace('[NexusVault] ','') || eventKey}"`,
        body: `<p><strong>${p.ok || 0}</strong> succès / <strong>${p.fail || 0}</strong> erreur(s)</p><pre style="font-family:monospace;background:#f8fafc;padding:12px;border-radius:4px;font-size:12px">${p.text || ''}</pre>`,
        bodyText: p.text || '',
      };

    case 'expiration_document': {
      const daysLabel = p.daysLeft === 0 ? '⚠ Aujourd\'hui' : p.daysLeft === 1 ? '⚠ Demain' : `Dans ${p.daysLeft} jour${p.daysLeft > 1 ? 's' : ''}`;
      const urgentColor = p.daysLeft <= 1 ? '#d63939' : p.daysLeft <= 2 ? '#f76707' : '#0e9f8e';
      return {
        subject: `⏰ Document expirant bientôt — ${p.name || '?'} (${daysLabel})`,
        body: `<p>Un document va expirer prochainement.</p><table style="border-collapse:collapse;width:100%;font-size:13px"><tr><td style="padding:6px 10px;color:#64748b;width:140px">Document</td><td style="padding:6px 10px"><strong>${p.name || '?'}</strong></td></tr><tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Expiration</td><td style="padding:6px 10px">${p.valid_until || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Catégorie</td><td style="padding:6px 10px">${p.category || '?'}</td></tr><tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b">Délai</td><td style="padding:6px 10px;font-weight:700;color:${urgentColor}">${daysLabel}</td></tr></table>`,
        bodyText: `Document "${p.name || '?'}" expire le ${p.valid_until || '?'} — ${daysLabel} (catégorie: ${p.category || '?'})`,
      };
    }

    case 'file_deleted':
      return {
        subject: `Fichier supprimé — ${p.filename || '?'} (${p.doc_name || '?'})`,
        body: `<p>Un fichier a été supprimé d'un document dans Automatisation.</p><table style="border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 10px;color:#64748b">Fichier</td><td style="padding:6px 10px"><strong>${p.filename || '?'}</strong></td></tr><tr><td style="padding:6px 10px;color:#64748b">Document</td><td style="padding:6px 10px">${p.doc_name || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Supprimé par</td><td style="padding:6px 10px">${p.username || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Date</td><td style="padding:6px 10px">${p.datetime || '?'}</td></tr></table>`,
        bodyText: `Fichier "${p.filename}" du document "${p.doc_name}" supprimé par ${p.username} le ${p.datetime}`,
      };

    case 'document_deleted':
      return {
        subject: `Document supprimé — ${p.name || '?'}`,
        body: `<p>Un document a été supprimé dans Automatisation.</p><table style="border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 10px;color:#64748b">Document</td><td style="padding:6px 10px"><strong>${p.name || '?'}</strong></td></tr><tr><td style="padding:6px 10px;color:#64748b">Catégorie</td><td style="padding:6px 10px">${p.category || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Supprimé par</td><td style="padding:6px 10px">${p.username || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Date</td><td style="padding:6px 10px">${p.datetime || '?'}</td></tr></table>`,
        bodyText: `Document "${p.name}" supprimé par ${p.username} le ${p.datetime} (catégorie: ${p.category})`,
      };

    case 'activity_file_deleted':
      return {
        subject: `Fichier de suivi supprimé — ${p.filename || '?'}`,
        body: `<p>Un fichier a été supprimé d'un suivi d'activité.</p><table style="border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 10px;color:#64748b">Fichier</td><td style="padding:6px 10px"><strong>${p.filename || '?'}</strong></td></tr><tr><td style="padding:6px 10px;color:#64748b">Suivi</td><td style="padding:6px 10px">[${p.tag_code||'?'}] ${p.year||''}/${String(p.month||'').padStart(2,'0')}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Supprimé par</td><td style="padding:6px 10px">${p.username || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Date</td><td style="padding:6px 10px">${p.datetime || '?'}</td></tr></table>`,
        bodyText: `Fichier "${p.filename}" du suivi [${p.tag_code}] ${p.year}/${String(p.month||'').padStart(2,'0')} supprimé par ${p.username}`,
      };

    case 'activity_deleted':
      return {
        subject: `Suivi d'activité supprimé — [${p.tag_code || '?'}] ${p.year || ''}/${String(p.month || '').padStart(2,'0')}`,
        body: `<p>Un suivi d'activité a été supprimé.</p><table style="border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 10px;color:#64748b">Tag</td><td style="padding:6px 10px"><strong>${p.tag_code || '?'}</strong></td></tr><tr><td style="padding:6px 10px;color:#64748b">Période</td><td style="padding:6px 10px">${p.year}/${String(p.month||'').padStart(2,'0')}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Extrait</td><td style="padding:6px 10px">${p.content_preview || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Supprimé par</td><td style="padding:6px 10px">${p.username || '?'}</td></tr></table>`,
        bodyText: `Suivi [${p.tag_code}] ${p.year}/${String(p.month||'').padStart(2,'0')} supprimé par ${p.username}`,
      };

    case 'backup_deleted':
      return {
        subject: `Sauvegarde supprimée — ${p.device || '?'} ${p.version || ''}`,
        body: `<p>Une sauvegarde a été supprimée dans Backup.</p><table style="border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 10px;color:#64748b">Équipement</td><td style="padding:6px 10px"><strong>${p.device || '?'}</strong></td></tr><tr><td style="padding:6px 10px;color:#64748b">Version</td><td style="padding:6px 10px">${p.version || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Supprimée par</td><td style="padding:6px 10px">${p.username || '?'}</td></tr><tr><td style="padding:6px 10px;color:#64748b">Date</td><td style="padding:6px 10px">${p.datetime || '?'}</td></tr></table>`,
        bodyText: `Sauvegarde ${p.version} de "${p.device}" supprimée par ${p.username} le ${p.datetime}`,
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
