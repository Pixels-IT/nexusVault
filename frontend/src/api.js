const BASE = '/api';

function getToken() { return localStorage.getItem('dp_token'); }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const api = {
  login: (u, p) => request('POST', '/auth/login', { username: u, password: p }),
  changePassword: (cur, nw) => request('POST', '/auth/change-password', { currentPassword: cur, newPassword: nw }),
  stats: () => request('GET', '/stats'),
  // Account
  getAccount: () => request('GET', '/account'),
  updateAccount: (d) => request('PUT', '/account', d),  // d = { username, display_name, email }
  // Users
  users: () => request('GET', '/users'),
  usersForActivity: () => request('GET', '/users/for-activity'),
  adminCount: () => request('GET', '/users/admin-count'),
  createUser: (d) => request('POST', '/users', d),
  updateUser: (id, d) => request('PUT', `/users/${id}`, d),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  unlockUser: (id) => request('POST', `/users/${id}/unlock`),
  // Whitelist
  whitelist: () => request('GET', '/whitelist'),
  createWhitelist: (d) => request('POST', '/whitelist', d),
  updateWhitelist: (id, d) => request('PUT', `/whitelist/${id}`, d),
  deleteWhitelist: (id) => request('DELETE', `/whitelist/${id}`),
  // Settings
  getSettings: () => request('GET', '/settings'),
  updateSettings: (d) => request('PUT', '/settings', d),
  getPublicSettings: () => fetch('/api/settings/public').then(r => r.json()),
  getPrefs: () => request('GET', '/me/prefs'),
  // Activity
  activityTags: () => request('GET', '/activity/tags'),
  createTag: (d) => request('POST', '/activity/tags', d),
  updateTag: (id, d) => request('PUT', `/activity/tags/${id}`, d),
  deleteTag: (id) => request('DELETE', `/activity/tags/${id}`),
  activityYears: (params) => request('GET', '/activity/years' + (params ? '?' + new URLSearchParams(params) : '')),
  activityEntries: (params) => request('GET', '/activity/entries' + (params ? '?' + new URLSearchParams(params) : '')),
  activityEntryHistory: (id) => request('GET', `/activity/entries/${id}/history`),
  updateEntry: (id, data) => request('PUT', `/activity/entries/${id}`, data),
  createEntry: (d) => request('POST', '/activity/entries', d),
  updateEntry: (id, d) => request('PUT', `/activity/entries/${id}`, d),
  deleteEntry: (id) => request('DELETE', `/activity/entries/${id}`),
  getRolePerms: () => request('GET', '/role-permissions'),
  saveRolePerms: (d) => request('PUT', '/role-permissions', d),
  savePrefs: (d) => request('PUT', '/me/prefs', d),
  // Audit
  audit: (params) => request('GET', '/audit' + (params ? '?' + new URLSearchParams(params) : '')),
  auditArchives: () => request('GET', '/audit/archives'),
  forgotPassword: (username) => request('POST', '/auth/forgot-password', { username }),
  resetPassword: (token, password) => request('POST', '/auth/reset-password', { token, password }),
  checkResetToken: (token) => request('GET', '/auth/reset-token-valid?token=' + encodeURIComponent(token)),
  slackConfig:    () => request('GET', '/slack/config'),
  slackSave:      (d) => request('PUT', '/slack/config', d),
  slackTest:      () => request('POST', '/slack/test'),
  telegramConfig: () => request('GET', '/telegram/config'),
  telegramSave:   (d) => request('PUT', '/telegram/config', d),
  telegramTest:   () => request('POST', '/telegram/test'),
  notifCatalog:    () => request('GET', '/notifications/catalog'),
  notifConfig:     () => request('GET', '/notifications/config'),
  notifSave:       (key, d) => request('PUT', `/notifications/config/${key}`, d),
  notifTest:       (key) => request('POST', `/notifications/test/${key}`),
  notifLog:        (limit) => request('GET', `/notifications/log?limit=${limit||50}`),
  oidcConfig: () => request('GET', '/oidc/config'),
  oidcSave:   (d) => request('PUT', '/oidc/config', d),
  oidcPublic: () => request('GET', '/oidc/public'),
  smtpConfig: () => request('GET', '/smtp/config'),
  smtpSave: (d) => request('PUT', '/smtp/config', d),
  smtpTest: () => request('POST', '/smtp/test'),
  cronStatus: () => request('GET', '/cron/status'),
  cronConfig: (d) => request('PUT', '/cron/config', d),
  auditArchiveGet: (id) => request('GET', `/audit/archives/${id}`),
  // Sites
  sites: () => request('GET', '/sites'),
  createSite: (d) => request('POST', '/sites', d),
  updateSite: (id, d) => request('PUT', `/sites/${id}`, d),
  deleteSite: (id) => request('DELETE', `/sites/${id}`),
  // Models
  models: () => request('GET', '/models'),
  createModel: (d) => request('POST', '/models', d),
  updateModel: (id, d) => request('PUT', `/models/${id}`, d),
  deleteModel: (id) => request('DELETE', `/models/${id}`),
  // Devices
  devices: () => request('GET', '/devices'),
  createDevice: (d) => request('POST', '/devices', d),
  updateDevice: (id, d) => request('PUT', `/devices/${id}`, d),
  deleteDevice: (id) => request('DELETE', `/devices/${id}`),
  // Backups
  backups: (params) => request('GET', '/backups' + (params ? '?' + new URLSearchParams(params) : '')),
  backupContent: (id) => request('GET', `/backups/${id}/content`),
  triggerBackup: (device_id, note) => request('POST', '/backups/trigger', { device_id, note }),
  pinBackup: (id) => request('PATCH', `/backups/${id}/pin`),
  deleteBackup: (id) => request('DELETE', `/backups/${id}`),
  uploadBackup: (device_id, content, note) => request('POST', '/backups/upload', { device_id, content, note }),
  diff: (id_a, id_b) => request('GET', `/backups/diff?id_a=${id_a}&id_b=${id_b}`),
};

export default api;
