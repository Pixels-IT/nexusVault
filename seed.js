/**
 * NexusVault — Script de données de démonstration
 *
 * Usage :
 *   docker cp seed.js nexusvault-backend:/app/seed.js
 *   docker exec -it nexusvault-backend node seed.js
 *
 * Ce script crée :
 *   - 2 pays, 15 sites répartis
 *   - 5 modèles d'équipements, 28 équipements
 *   - Des backups avec configurations réseau fictives
 *   - 1 utilisateur opérateur + 1 lecteur
 *   - Des entrées de suivi d'activité sur Mars, Avril et Mai 2026
 *   - Archives d'audit pour Mars et Avril 2026
 */

'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb, encrypt, audit } = require('./db.js');

const db = getDb();

// ── UTILITAIRES ───────────────────────────────────────────────────────────────
function dt(y, m, d, h = 9, min = 0) {
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(min)}:00`;
}
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randIp(prefix) { return `${prefix}.${randInt(1,254)}`; }

console.log('\n=== NexusVault Seed — démarrage ===\n');

// ── 1. PAYS ───────────────────────────────────────────────────────────────────
console.log('1/8  Pays...');
const countries = db.prepare('SELECT COUNT(*) as c FROM countries').get().c;
let cFrance, cBelgique;
if (countries === 0) {
  cFrance   = db.prepare('INSERT INTO countries (name, sort_order) VALUES (?,?)').run('France', 1).lastInsertRowid;
  cBelgique = db.prepare('INSERT INTO countries (name, sort_order) VALUES (?,?)').run('Belgique', 2).lastInsertRowid;
} else {
  cFrance   = db.prepare("SELECT id FROM countries WHERE name='France'").get()?.id
            || db.prepare('INSERT INTO countries (name, sort_order) VALUES (?,?)').run('France', 1).lastInsertRowid;
  cBelgique = db.prepare("SELECT id FROM countries WHERE name='Belgique'").get()?.id
            || db.prepare('INSERT INTO countries (name, sort_order) VALUES (?,?)').run('Belgique', 2).lastInsertRowid;
}

// ── 2. SITES (15) ─────────────────────────────────────────────────────────────
console.log('2/8  Sites...');
const sitesDef = [
  // France (9 sites)
  { name:'Paris - Siège',       loc:'Paris 8e',         contact:'it-paris@pixelabs.fr',    country: cFrance },
  { name:'Paris - Datacenter',  loc:'Paris 13e',        contact:'dc-paris@pixelabs.fr',    country: cFrance },
  { name:'Lyon - Bureaux',      loc:'Lyon Part-Dieu',   contact:'it-lyon@pixelabs.fr',     country: cFrance },
  { name:'Lyon - Datacenter',   loc:'Lyon Gerland',     contact:'dc-lyon@pixelabs.fr',     country: cFrance },
  { name:'Bordeaux',            loc:'Bordeaux Mériadeck',contact:'it-bx@pixelabs.fr',      country: cFrance },
  { name:'Marseille',           loc:'Marseille Euroméditerranée',contact:'it-mrs@pixelabs.fr', country: cFrance },
  { name:'Toulouse',            loc:'Toulouse Capitole',contact:'it-tlse@pixelabs.fr',     country: cFrance },
  { name:'Nantes',              loc:'Nantes Île de Nantes',contact:'it-nantes@pixelabs.fr',country: cFrance },
  { name:'Strasbourg',          loc:'Strasbourg Wacken',contact:'it-stras@pixelabs.fr',    country: cFrance },
  // Belgique (6 sites)
  { name:'Bruxelles - Siège',   loc:'Bruxelles Centre', contact:'it-bxl@pixelabs.be',      country: cBelgique },
  { name:'Bruxelles - DC',      loc:'Bruxelles Zaventem',contact:'dc-bxl@pixelabs.be',     country: cBelgique },
  { name:'Liège',               loc:'Liège Guillemins', contact:'it-liege@pixelabs.be',    country: cBelgique },
  { name:'Gand',                loc:'Gand Centre',      contact:'it-gand@pixelabs.be',     country: cBelgique },
  { name:'Anvers',              loc:'Anvers Port',      contact:'it-anvers@pixelabs.be',   country: cBelgique },
  { name:'Namur',               loc:'Namur Centre',     contact:'it-namur@pixelabs.be',    country: cBelgique },
];
const siteIds = [];
for (const s of sitesDef) {
  const r = db.prepare('INSERT INTO sites (name_enc, location_enc, contact_enc, country_id) VALUES (?,?,?,?)')
    .run(encrypt(s.name), encrypt(s.loc), encrypt(s.contact), s.country);
  siteIds.push(r.lastInsertRowid);
}

// ── 3. MODÈLES (5) ────────────────────────────────────────────────────────────
console.log('3/8  Modèles...');
const modelsDef = [
  { vendor:'Cisco',    model:'Catalyst 9300-48P', type:'Switch',    cmd:'show running-config' },
  { vendor:'Cisco',    model:'Catalyst 9500-48Y', type:'Switch',    cmd:'show running-config' },
  { vendor:'Fortinet', model:'FortiGate 200F',    type:'Pare-Feu',  cmd:'show full-configuration' },
  { vendor:'Palo Alto',model:'PA-820',            type:'Pare-Feu',  cmd:'show config running' },
  { vendor:'Synology', model:'RS2423RP+',         type:'NAS',       cmd:'n/a' },
];
const modelIds = [];
for (const m of modelsDef) {
  const r = db.prepare('INSERT INTO device_models (vendor_enc, model_enc, device_type_enc, backup_method_enc, backup_command_enc) VALUES (?,?,?,?,?)')
    .run(encrypt(m.vendor), encrypt(m.model), encrypt(m.type), encrypt('SSH'), encrypt(m.cmd));
  modelIds.push(r.lastInsertRowid);
}
const [mCisco9300, mCisco9500, mFortigate, mPaloAlto, mSynology] = modelIds;

// ── 4. ÉQUIPEMENTS (28) ───────────────────────────────────────────────────────
console.log('4/8  Équipements...');
// index sites : 0=Paris Siège, 1=Paris DC, 2=Lyon Bureaux, 3=Lyon DC, 4=Bordeaux,
//               5=Marseille, 6=Toulouse, 7=Nantes, 8=Strasbourg,
//               9=Bruxelles Siège, 10=Bruxelles DC, 11=Liège, 12=Gand, 13=Anvers, 14=Namur
const devicesDef = [
  // Paris Siège (0) — 3 équipements
  { name:'sw-paris-core-01',   site:0, model:mCisco9500,  ip:'10.0.1.1',   user:'admin' },
  { name:'sw-paris-acc-01',    site:0, model:mCisco9300,  ip:'10.0.1.10',  user:'admin' },
  { name:'fw-paris-01',        site:0, model:mFortigate,  ip:'10.0.1.254', user:'admin' },
  // Paris DC (1) — 3 équipements
  { name:'sw-pdc-core-01',     site:1, model:mCisco9500,  ip:'10.0.2.1',   user:'admin' },
  { name:'sw-pdc-core-02',     site:1, model:mCisco9500,  ip:'10.0.2.2',   user:'admin' },
  { name:'fw-pdc-01',          site:1, model:mPaloAlto,   ip:'10.0.2.254', user:'admin' },
  // Lyon Bureaux (2) — 2 équipements
  { name:'sw-lyon-core-01',    site:2, model:mCisco9300,  ip:'10.1.1.1',   user:'admin' },
  { name:'fw-lyon-01',         site:2, model:mFortigate,  ip:'10.1.1.254', user:'admin' },
  // Lyon DC (3) — 2 équipements
  { name:'sw-ldc-core-01',     site:3, model:mCisco9500,  ip:'10.1.2.1',   user:'admin' },
  { name:'nas-ldc-01',         site:3, model:mSynology,   ip:'10.1.2.50',  user:'admin' },
  // Bordeaux (4) — 2 équipements
  { name:'sw-bx-01',           site:4, model:mCisco9300,  ip:'10.2.1.1',   user:'admin' },
  { name:'fw-bx-01',           site:4, model:mFortigate,  ip:'10.2.1.254', user:'admin' },
  // Marseille (5) — 2 équipements
  { name:'sw-mrs-01',          site:5, model:mCisco9300,  ip:'10.3.1.1',   user:'admin' },
  { name:'fw-mrs-01',          site:5, model:mFortigate,  ip:'10.3.1.254', user:'admin' },
  // Toulouse (6) — 1 équipement
  { name:'sw-tlse-01',         site:6, model:mCisco9300,  ip:'10.4.1.1',   user:'admin' },
  // Nantes (7) — 1 équipement
  { name:'sw-nantes-01',       site:7, model:mCisco9300,  ip:'10.5.1.1',   user:'admin' },
  // Strasbourg (8) — 1 équipement
  { name:'sw-stras-01',        site:8, model:mCisco9300,  ip:'10.6.1.1',   user:'admin' },
  // Bruxelles Siège (9) — 2 équipements
  { name:'sw-bxl-core-01',     site:9, model:mCisco9500,  ip:'10.10.1.1',  user:'admin' },
  { name:'fw-bxl-01',          site:9, model:mFortigate,  ip:'10.10.1.254',user:'admin' },
  // Bruxelles DC (10) — 2 équipements
  { name:'sw-bdc-core-01',    site:10, model:mCisco9500,  ip:'10.10.2.1',  user:'admin' },
  { name:'nas-bdc-01',        site:10, model:mSynology,   ip:'10.10.2.50', user:'admin' },
  // Liège (11) — 1 équipement
  { name:'sw-liege-01',       site:11, model:mCisco9300,  ip:'10.11.1.1',  user:'admin' },
  // Gand (12) — 1 équipement
  { name:'sw-gand-01',        site:12, model:mCisco9300,  ip:'10.12.1.1',  user:'admin' },
  // Anvers (13) — 2 équipements
  { name:'sw-anvers-01',      site:13, model:mCisco9300,  ip:'10.13.1.1',  user:'admin' },
  { name:'fw-anvers-01',      site:13, model:mPaloAlto,   ip:'10.13.1.254',user:'admin' },
  // Namur (14) — 1 équipement
  { name:'sw-namur-01',       site:14, model:mCisco9300,  ip:'10.14.1.1',  user:'admin' },
];
const deviceIds = [];
for (const d of devicesDef) {
  const r = db.prepare('INSERT INTO devices (name_enc, site_id, model_id, ip_enc, ssh_user_enc, ssh_password_enc) VALUES (?,?,?,?,?,?)')
    .run(encrypt(d.name), siteIds[d.site], d.model, encrypt(d.ip), encrypt(d.user), encrypt('P@ssw0rd!demo'));
  deviceIds.push(r.lastInsertRowid);
}

// ── 5. BACKUPS ────────────────────────────────────────────────────────────────
console.log('5/8  Backups...');
function cfgSwitch(hostname, vlans, priority = 32768) {
  const vlanLines = vlans.map(([id, name]) => `vlan ${id}\n name ${name}`).join('\n');
  return [
    `!\nhostname ${hostname}`,
    `!\nip domain-name pixelabs.local\nip name-server 8.8.8.8\n!`,
    vlanLines,
    `!\nspanning-tree mode rapid-pvst\nspanning-tree extend system-id\nspanning-tree vlan 1-4094 priority ${priority}`,
    `!\ninterface Vlan1\n no ip address\n shutdown\n!`,
    `!\ninterface Vlan10\n description SERVERS\n ip address 10.0.${randInt(1,9)}.${randInt(1,9)} 255.255.255.0\n!`,
    `!\ninterface GigabitEthernet1/0/1\n description Uplink-Core\n switchport mode trunk\n switchport trunk native vlan 99\n!`,
    `!\nline con 0\n logging synchronous\nline vty 0 4\n login local\n transport input ssh\n!`,
    `end`,
  ].join('\n');
}
function cfgFirewall(hostname) {
  return [
    `config system global`,
    `  set hostname ${hostname}`,
    `  set timezone 28`,
    `  set admin-timeout 30`,
    `end`,
    `config system interface`,
    `  edit "wan1"`,
    `    set mode dhcp`,
    `    set role wan`,
    `  next`,
    `  edit "internal"`,
    `    set ip 192.168.1.99 255.255.255.0`,
    `    set allowaccess ping https ssh`,
    `    set role lan`,
    `  next`,
    `end`,
    `config firewall policy`,
    `  edit 1`,
    `    set name "LAN-to-WAN"`,
    `    set srcintf "internal"`,
    `    set dstintf "wan1"`,
    `    set srcaddr "all"`,
    `    set dstaddr "all"`,
    `    set action accept`,
    `    set schedule "always"`,
    `    set service "ALL"`,
    `    set nat enable`,
    `  next`,
    `end`,
  ].join('\n');
}

const vlansBase = [[10,'SERVERS'],[20,'USERS'],[30,'WIFI'],[40,'VOIP'],[50,'IOT'],[99,'MGMT']];
const vlansV2   = [...vlansBase, [60,'CAMERAS'],[70,'PRINTERS']];

// Backups pour les principaux équipements (switches core et firewalls)
const backupData = [
  { devIdx:0,  cfgs:[cfgSwitch('sw-paris-core-01',vlansBase,4096), cfgSwitch('sw-paris-core-01',vlansV2,4096)], notes:['Config initiale','Ajout VLAN 60 Cameras + VLAN 70 Printers'] },
  { devIdx:1,  cfgs:[cfgSwitch('sw-paris-acc-01',vlansBase)],       notes:['Config initiale'] },
  { devIdx:2,  cfgs:[cfgFirewall('fw-paris-01'), cfgFirewall('fw-paris-01').replace('LAN-to-WAN','LAN-WAN').replace('set nat enable','set nat enable\n    set utm-status enable')], notes:['Déploiement initial','Activation UTM + IPS'] },
  { devIdx:3,  cfgs:[cfgSwitch('sw-pdc-core-01',vlansBase,4096)],   notes:['Config initiale datacenter'] },
  { devIdx:4,  cfgs:[cfgSwitch('sw-pdc-core-02',vlansBase,8192)],   notes:['Config initiale datacenter secondaire'] },
  { devIdx:5,  cfgs:[cfgFirewall('fw-pdc-01')],                      notes:['Config pare-feu datacenter Paris'] },
  { devIdx:6,  cfgs:[cfgSwitch('sw-lyon-core-01',vlansBase)],        notes:['Installation Lyon'] },
  { devIdx:7,  cfgs:[cfgFirewall('fw-lyon-01')],                     notes:['Pare-feu Lyon'] },
  { devIdx:8,  cfgs:[cfgSwitch('sw-ldc-core-01',vlansBase,4096)],    notes:['Config datacenter Lyon'] },
  { devIdx:10, cfgs:[cfgSwitch('sw-bx-01',[[10,'SERVERS'],[20,'USERS'],[99,'MGMT']])], notes:['Site Bordeaux'] },
  { devIdx:11, cfgs:[cfgFirewall('fw-bx-01')],                        notes:['Pare-feu Bordeaux'] },
  { devIdx:17, cfgs:[cfgSwitch('sw-bxl-core-01',vlansBase,4096)],    notes:['Config Bruxelles Siège'] },
  { devIdx:18, cfgs:[cfgFirewall('fw-bxl-01')],                       notes:['Pare-feu Bruxelles'] },
  { devIdx:19, cfgs:[cfgSwitch('sw-bdc-core-01',vlansBase,4096), cfgSwitch('sw-bdc-core-01',vlansV2,4096)], notes:['Config DC Bruxelles','Ajout VLANs Cameras/Printers'] },
];

for (const b of backupData) {
  const devId = deviceIds[b.devIdx];
  b.cfgs.forEach((cfg, i) => {
    db.prepare('INSERT INTO backups (device_id, version, content_enc, size_bytes, status, note_enc, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(devId, i + 1, encrypt(cfg), cfg.length, 'ok', encrypt(b.notes[i] || ''), dt(2026, 3 + Math.floor(i * 0.5), randInt(1, 28), randInt(8, 17)));
  });
}

// ── 6. UTILISATEURS ───────────────────────────────────────────────────────────
console.log('6/8  Utilisateurs...');
const hash = bcrypt.hashSync('Demo@2026!', 12);
for (const u of [
  { username:'j.martin',  display:'Julie Martin',    email:'j.martin@pixelabs.fr',  role:'operator' },
  { username:'p.durand',  display:'Pierre Durand',   email:'p.durand@pixelabs.fr',  role:'viewer'   },
]) {
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(u.username);
  if (!exists) {
    db.prepare('INSERT INTO users (username, display_name, email, password_hash, must_change_password, role, enabled) VALUES (?,?,?,?,0,?,1)')
      .run(u.username, u.display, u.email, hash, u.role);
    console.log(`   + ${u.role}: ${u.username} / Demo@2026!`);
  }
}

// Récupérer les IDs utilisateurs
const adminId    = db.prepare("SELECT id FROM users WHERE username='admin'").get()?.id || 1;
const martinId   = db.prepare("SELECT id FROM users WHERE username='j.martin'").get()?.id;
const durandId   = db.prepare("SELECT id FROM users WHERE username='p.durand'").get()?.id;

// ── 7. JOURNAL D'ACTIVITÉ ─────────────────────────────────────────────────────
console.log('7/8  Activité...');
// Tags
const tags = [
  { code:'SECU',    label:'Sécurité',  color:'#dc2626' },
  { code:'ADM',     label:'Admin',     color:'#2563eb' },
  { code:'NET',     label:'Réseau',    color:'#059669' },
  { code:'BACKUP',  label:'Backup',    color:'#7c3aed' },
  { code:'INCIDENT',label:'Incident',  color:'#d97706' },
];
for (const t of tags) {
  try { db.prepare('INSERT INTO activity_tags (code, label, color) VALUES (?,?,?)').run(t.code, t.label, t.color); } catch {}
}

const entries = [
  // Mars 2026
  { uid:adminId,  un:'admin',   month:3, day:3,  tag:'ADM',     content:'Mise à jour firmware Cisco 9300 sur sw-paris-acc-01 vers 17.9.4a. Redémarrage sans incident.' },
  { uid:martinId, un:'j.martin',month:3, day:5,  tag:'NET',     content:'Reconfiguration trunk sw-paris-core-01 — ajout VLAN 60 Caméras suite à installation vidéosurveillance RDC.' },
  { uid:adminId,  un:'admin',   month:3, day:7,  tag:'BACKUP',  content:'Test de restauration configuration sw-pdc-core-01 en environnement de test. Résultat OK en 4 minutes.' },
  { uid:durandId, un:'p.durand',month:3, day:10, tag:'ADM',     content:'Vérification des droits accès VPN — revue trimestrielle des comptes actifs. 3 comptes désactivés.' },
  { uid:martinId, un:'j.martin',month:3, day:14, tag:'SECU',    content:'Alerte détectée : tentative de connexion SSH depuis IP externe 185.220.101.45 sur fw-paris-01. IP bloquée en ACL.' },
  { uid:adminId,  un:'admin',   month:3, day:17, tag:'NET',     content:'Déploiement VLAN 70 Imprimantes sur tous les sites France. Isolation réseau configurée avec règles inter-VLAN.' },
  { uid:martinId, un:'j.martin',month:3, day:20, tag:'BACKUP',  content:'Sauvegarde manuelle de l\'ensemble des équipements Paris avant migration du datacenter. 6 configs archivées.' },
  { uid:durandId, un:'p.durand',month:3, day:24, tag:'INCIDENT',content:'Panne switch sw-bx-01 Bordeaux — perte alimentation. Redémarrage à froid effectué 14h32. Retour nominal 14h48.' },
  { uid:adminId,  un:'admin',   month:3, day:27, tag:'ADM',     content:'Révision politique de mot de passe sur FortiGate : longueur minimale portée à 14 caractères, rotation 90 jours.' },
  // Avril 2026
  { uid:adminId,  un:'admin',   month:4, day:2,  tag:'NET',     content:'Migration OSPF vers OSPF area 0 sur backbone Paris-Lyon. Tests de convergence OK sous 3 secondes.' },
  { uid:martinId, un:'j.martin',month:4, day:4,  tag:'SECU',    content:'Audit de sécurité trimestriel — scan Nessus sur périmètre externe. 2 vulnérabilités medium corrigées (CVE-2024-21762 Fortinet).' },
  { uid:adminId,  un:'admin',   month:4, day:7,  tag:'BACKUP',  content:'Déploiement du processus de backup automatique sur équipements Belgique. Configuration NexusVault via SSH.' },
  { uid:durandId, un:'p.durand',month:4, day:9,  tag:'ADM',     content:'Revue des accès administrateurs suite départ d\'un collaborateur. 1 compte désactivé, clés SSH révoquées.' },
  { uid:martinId, un:'j.martin',month:4, day:11, tag:'INCIDENT',content:'Boucle réseau détectée site Liège 09h15 — STP convergence défaillante. Désactivation port G1/0/24 sw-liege-01. RCA en cours.' },
  { uid:adminId,  un:'admin',   month:4, day:15, tag:'NET',     content:'Mise en service fw-anvers-01 (Palo Alto PA-820). Politiques de sécurité configurées, tests de passage OK.' },
  { uid:martinId, un:'j.martin',month:4, day:17, tag:'SECU',    content:'Déploiement certificat SSL wildcard *.pixelabs.local sur les interfaces d\'administration de tous les firewalls.' },
  { uid:adminId,  un:'admin',   month:4, day:22, tag:'ADM',     content:'Formation NexusVault auprès équipe N2 Belgique. 3 techniciens formés sur l\'utilisation backups et journal d\'activité.' },
  { uid:durandId, un:'p.durand',month:4, day:24, tag:'BACKUP',  content:'Vérification intégrité backups datacenter Lyon — 12 configurations vérifiées, toutes cohérentes avec état produit.' },
  { uid:adminId,  un:'admin',   month:4, day:28, tag:'NET',     content:'Upgrade firmware FortiGate 7.4.4 sur fw-pdc-01 et fw-bxl-01. Maintenance window 02h00-04h00. Zéro incident.' },
  // Mai 2026
  { uid:adminId,  un:'admin',   month:5, day:2,  tag:'ADM',     content:'Revue mensuelle des comptes utilisateurs NexusVault. Vérification droits et activité des derniers 30 jours.' },
  { uid:martinId, un:'j.martin',month:5, day:5,  tag:'NET',     content:'Ajout QoS VoIP sur VLAN 40 sites Paris Siège et Bruxelles Siège. DSCP EF appliqué, tests qualité appels OK.' },
  { uid:adminId,  un:'admin',   month:5, day:7,  tag:'SECU',    content:'Application patch MS-2024-045 sur systèmes de management réseau. Redémarrage programmé hors heures ouvrées.' },
  { uid:durandId, un:'p.durand',month:5, day:9,  tag:'BACKUP',  content:'Test de restauration disaster recovery — simulation perte datacenter Lyon. RPO atteint en 22 minutes. RTO: 47 min.' },
  { uid:martinId, un:'j.martin',month:5, day:12, tag:'INCIDENT',content:'Saturation lien WAN Namur 95% pendant 2h. Analyse: synchronisation NAS en journée. Migration tâche en nuit.' },
  { uid:adminId,  un:'admin',   month:5, day:14, tag:'NET',     content:'Déploiement NAC (Network Access Control) sur switches Paris Siège — authentification 802.1X pour postes de travail.' },
];

for (const e of entries) {
  if (!e.uid) continue;
  db.prepare('INSERT INTO activity_entries (user_id, year, month, tag_code, content, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(e.uid, 2026, e.month, e.tag, e.content, dt(2026, e.month, e.day, randInt(8,17), randInt(0,59)), dt(2026, e.month, e.day, randInt(8,17), randInt(0,59)));
}

// ── 8. JOURNAL D'AUDIT + ARCHIVES ─────────────────────────────────────────────
console.log('8/8  Audit & archives...');

function insertAuditEntry(userId, username, action, category, severity, detail, ip, dateStr) {
  db.prepare('INSERT INTO audit_log (user_id, username, action, category, severity, detail, ip, success, created_at) VALUES (?,?,?,?,?,?,?,1,?)')
    .run(userId || null, username, action, category, severity, detail, ip, dateStr);
}

const ips = ['192.168.1.100','192.168.1.101','10.0.1.50','10.0.2.30','10.10.1.20'];

// Générer les entrées d'audit pour Mars, Avril et Mai
for (const [year, month, nbEntries] of [[2026,3,35],[2026,4,30],[2026,5,20]]) {
  for (let i = 0; i < nbEntries; i++) {
    const day = randInt(1, 28);
    const hour = randInt(7, 19);
    const d = dt(year, month, day, hour, randInt(0,59));
    const ip = rnd(ips);
    const user = rnd([
      { id: adminId, name: 'admin' },
      { id: martinId, name: 'j.martin' },
      { id: durandId, name: 'p.durand' },
    ].filter(u => u.id));
    const events = [
      { action:'CONNEXION_REUSSIE', cat:'auth', sev:'info', detail:`Depuis ${ip}` },
      { action:'BACKUP_LU',         cat:'backup', sev:'info', detail:`sw-paris-core-01 v${randInt(1,3)}` },
      { action:'BACKUP_COPIE',      cat:'backup', sev:'info', detail:`fw-pdc-01 v${randInt(1,2)}` },
      { action:'CONFIG_MODIFIEE',   cat:'config', sev:'info', detail:`Site ${rnd(['Lyon DC','Paris Siège','Bruxelles DC'])} mis à jour` },
      { action:'CONNEXION_ECHEC',   cat:'auth',   sev:'warn', detail:`Tentative depuis ${ip} — identifiants incorrects` },
      { action:'DECONNEXION',       cat:'auth',   sev:'info', detail:'Déconnexion volontaire' },
      { action:'BACKUP_UPLOADE',    cat:'backup', sev:'info', detail:`fw-bxl-01 v${randInt(1,2)} importé manuellement` },
    ];
    const ev = rnd(events);
    insertAuditEntry(user.id, user.name, ev.action, ev.cat, ev.sev, ev.detail, ip, d);
  }
}

// Archiver Mars et Avril (supprimer de audit_log et insérer dans audit_archives)
for (const [year, month] of [[2026,3],[2026,4]]) {
  const mo = String(month).padStart(2,'0');
  const rows = db.prepare(`SELECT * FROM audit_log WHERE created_at LIKE '${year}-${mo}-%' ORDER BY id ASC`).all();
  if (rows.length === 0) { console.log(`   ⚠ Aucune entrée pour ${year}/${mo}`); continue; }
  const archivedAt = dt(year, month + 1, 1, 0, 5); // archivé le 1er du mois suivant à 00h05
  try {
    db.prepare('INSERT INTO audit_archives (year, month, entry_count, data_json, archived_at, archived_by) VALUES (?,?,?,?,?,?)')
      .run(year, month, rows.length, JSON.stringify(rows), archivedAt, 'cron');
    db.prepare(`DELETE FROM audit_log WHERE created_at LIKE '${year}-${mo}-%'`).run();
    // Ajouter une entrée dans le journal courant pour signaler l'archivage
    insertAuditEntry(null, 'cron', 'AUDIT_ARCHIVE', 'admin', 'info',
      `Archive ${year}/${mo} créée — ${rows.length} entrée(s) archivées`, '127.0.0.1',
      archivedAt);
    console.log(`   ✓ Archive ${year}/${mo} — ${rows.length} entrées`);
  } catch (e) {
    console.log(`   ⚠ Archive ${year}/${mo} déjà existante (ignorée)`);
  }
}

// ── FIN ───────────────────────────────────────────────────────────────────────
const counts = {
  pays:        db.prepare('SELECT COUNT(*) as c FROM countries').get().c,
  sites:       db.prepare('SELECT COUNT(*) as c FROM sites').get().c,
  modeles:     db.prepare('SELECT COUNT(*) as c FROM device_models').get().c,
  equipements: db.prepare('SELECT COUNT(*) as c FROM devices').get().c,
  backups:     db.prepare('SELECT COUNT(*) as c FROM backups').get().c,
  users:       db.prepare('SELECT COUNT(*) as c FROM users').get().c,
  activite:    db.prepare('SELECT COUNT(*) as c FROM activity_entries').get().c,
  audit:       db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c,
  archives:    db.prepare('SELECT COUNT(*) as c FROM audit_archives').get().c,
};

console.log('\n=== Seed terminé ===');
console.log(`  Pays           : ${counts.pays}`);
console.log(`  Sites          : ${counts.sites}`);
console.log(`  Modèles        : ${counts.modeles}`);
console.log(`  Équipements    : ${counts.equipements}`);
console.log(`  Backups        : ${counts.backups}`);
console.log(`  Utilisateurs   : ${counts.users}`);
console.log(`  Activité       : ${counts.activite} entrées`);
console.log(`  Audit courant  : ${counts.audit} entrées`);
console.log(`  Archives audit : ${counts.archives} (Mars + Avril 2026)`);
console.log('\nComptes de test :');
console.log('  Opérateur : j.martin  / Demo@2026!');
console.log('  Lecteur   : p.durand  / Demo@2026!');
console.log('');
