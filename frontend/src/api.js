const BASE = '/api';

function getToken() { return localStorage.getItem('dp_token'); }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    if (data.usages) err.usages = data.usages;
    throw err;
  }
  return data;
}

const api = {
  login: (u, p, totp_token) => {
    const body = { username: u, password: p };
    if (totp_token) body.totp_token = totp_token;
    return request('POST', '/auth/login', body);
  },
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
  getEntryFiles: (id) => request("GET", "/activity/entries/"+id+"/files"),
  uploadEntryFile: (id,d) => request("POST", "/activity/entries/"+id+"/files", d),
  lockEntryFile: (id) => request("PUT", "/activity/files/"+id+"/lock"),
  deleteEntryFile: (id) => request("DELETE", "/activity/files/"+id),
  getFeatureFlags: () => request('GET', '/settings/feature-flags'),
  setFeatureFlags: (f) => request('PUT', '/settings/feature-flags', f),
  getCountries:    () => request('GET', '/countries'),
  addCountry:      (n) => request('POST', '/countries', { name: n }),
  updateCountry:   (id, d) => request('PUT', `/countries/${id}`, d),
  deleteCountry:   (id) => request('DELETE', `/countries/${id}`),
  reorderCountries:(o) => request('PUT', '/countries/reorder', { order: o }),
  setSiteCountry:  (sid, cid) => request('PATCH', `/sites/${sid}/country`, { country_id: cid }),
  bruteConfig:     () => request('GET', '/security/brute-config'),
  saveBruteConfig: (data) => request('PUT', '/security/brute-config', data),
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
  // TOTP
  totpSetupQr:     (setup_token) => request('POST', '/auth/totp/setup-qr', { setup_token }),
  totpSetupVerify: (setup_token, totp_token) => request('POST', '/auth/totp/setup-verify', { setup_token, totp_token }),
  importActivityCsv: (csv) => request('POST', '/activity/import-csv', { csv }),
  auditEditEntry: (id) => request('POST', `/activity/entries/${id}/audit-edit`),
  // Automation categories
  automationCategories: ()      => request('GET',    '/automation/categories'),
  createCategory:       (d)     => request('POST',   '/automation/categories', d),
  updateCategory:       (id, d) => request('PUT',    `/automation/categories/${id}`, d),
  deleteCategory:       (id)    => request('DELETE', `/automation/categories/${id}`),
  // Automation documents
  automationDocuments:    (catId)      => request('GET',    `/automation/categories/${catId}/documents`),
  automationDocument:     (id)         => request('GET',    `/automation/documents/${id}`),
  createDocument:         (catId, d)   => request('POST',   `/automation/categories/${catId}/documents`, d),
  updateDocument:         (id, d)      => request('PUT',    `/automation/documents/${id}`, d),
  deleteDocument:         (id)         => request('DELETE', `/automation/documents/${id}`),
  addDocumentFile: async  (docId, file) => {
    const data = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});
    return request('POST', `/automation/documents/${docId}/files`, { filename:file.name, mimetype:file.type, data });
  },
  downloadAutomationFile: (id, filename) => {
    const token = localStorage.getItem('dp_token');
    fetch(`/api/automation/files/${id}/download`, { headers:{ Authorization:`Bearer ${token}` }})
      .then(r=>r.blob()).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename;a.click();});
  },
  deleteAutomationFile: (id) => request('DELETE', `/automation/files/${id}`),
  automationDocumentHistory: (id) => request('GET', `/automation/documents/${id}/history`),
  automationDocAccessDenied: (id) => request('POST', `/automation/documents/${id}/access-denied`, {}),
  previewAutomationFile: (id) => request('GET', `/automation/files/${id}/preview`),
  getPdfLogo: () => request('GET', '/settings/pdf-logo'),
  setPdfLogo: (logo) => request('PUT', '/settings/pdf-logo', { logo }),
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
  archiveNow:      (year, month) => request('POST', '/audit/archive-now', { year, month }),
  auditArchives:   () => request('GET', '/audit/archives'),
  auditArchiveDl:  (id) => `${BASE}/audit/archives/${id}/download`,
  getFeatureFlags: () => request('GET', '/settings/feature-flags'),
  setFeatureFlags: (f) => request('PUT', '/settings/feature-flags', f),
  getCountries:    () => request('GET', '/countries'),
  addCountry:      (n) => request('POST', '/countries', { name: n }),
  updateCountry:   (id, d) => request('PUT', `/countries/${id}`, d),
  deleteCountry:   (id) => request('DELETE', `/countries/${id}`),
  reorderCountries:(o) => request('PUT', '/countries/reorder', { order: o }),
  setSiteCountry:  (sid, cid) => request('PATCH', `/sites/${sid}/country`, { country_id: cid }),
  bruteConfig:     () => request('GET', '/security/brute-config'),
  saveBruteConfig: (data) => request('PUT', '/security/brute-config', data),
  unlockUser:      (id) => request('POST', `/users/${id}/unlock`),
  logout:         (source) => request('POST', '/auth/logout', { source }),
  logBackupCopy:  (id) => request('POST', `/backups/${id}/audit-copy`),
  ldapConfig:     () => request('GET', '/ldap/config'),
  ldapSave:       (d) => request('PUT', '/ldap/config', d),
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

  // Backup schedules
  backupSchedules:        ()      => request('GET',    '/backup-schedules'),
  backupScheduleCreate:   (d)     => request('POST',   '/backup-schedules', d),
  backupScheduleUpdate:   (id, d) => request('PUT',    `/backup-schedules/${id}`, d),
  backupScheduleDelete:   (id)    => request('DELETE', `/backup-schedules/${id}`),
  backupScheduleDevices:  (id, d) => request('PUT',    `/backup-schedules/${id}/devices`, d),
  backupScheduleRunNow:   (id)    => request('POST',   `/backup-schedules/${id}/run-now`),
  backupScheduleStates:   ()      => request('GET',    '/backup-schedules/states'),
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
