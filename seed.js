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

// ── Entrées historiques 2023 ──────────────────────────────────────────────────
const entries2023 = [
  // Jan 2023
  { uid:adminId,  month:1, day:5,  tag:'NET',     content:'Remplacement switch cœur sw-paris-core-01 — migration vers Cisco Catalyst 9300. Fenêtre maintenance 22h00-02h00. OK.' },
  { uid:martinId, month:1, day:9,  tag:'SECU',    content:'Déploiement antivirus CrowdStrike Falcon sur 120 postes Windows. Rollout par vague de 30 postes/jour.' },
  { uid:adminId,  month:1, day:15, tag:'BACKUP',  content:'Mise en place politique de sauvegarde hebdomadaire des configs réseau. Script cron activé sur serveur NMS.' },
  { uid:martinId, month:1, day:22, tag:'ADM',     content:'Création comptes VPN pour 8 nouveaux télétravailleurs. Attribution certificats SSL individuels.' },
  { uid:durandId, month:1, day:28, tag:'INCIDENT',content:'Coupure fibre opérateur site Lyon — basculement sur lien 4G LTE backup. Durée: 4h12. RCA: travaux voirie.' },
  // Fev 2023
  { uid:adminId,  month:2, day:3,  tag:'SECU',    content:'Audit PCI-DSS préparatoire — analyse flux cartes bancaires. 3 écarts identifiés, plan de remédiation établi.' },
  { uid:martinId, month:2, day:7,  tag:'NET',     content:'Configuration BGP avec nouveau FAI (Orange Business). AS65001. Tests de failover LAN-WAN validés.' },
  { uid:adminId,  month:2, day:14, tag:'ADM',     content:'Migration Active Directory vers Windows Server 2022. Promotion nouveau DC, rétrogradation ancien après 72h stabilité.' },
  { uid:martinId, month:2, day:20, tag:'BACKUP',  content:'Vérification mensuelle intégrité sauvegardes — 18 configs vérifiées. 1 anomalie corrigée (charset UTF-8).' },
  { uid:durandId, month:2, day:25, tag:'INCIDENT',content:'Alerte IDS: tentative brute-force SSH sur fw-bxl-01. IP bloquée, origine: 185.234.xx.xx (Russie). Rapport CERT.' },
  // Mar 2023
  { uid:adminId,  month:3, day:2,  tag:'NET',     content:'Extension VLAN 80 (IoT) sur sites Paris et Lyon. Segmentation réseau imprimantes et équipements connectés.' },
  { uid:martinId, month:3, day:8,  tag:'SECU',    content:'Mise à jour règles IPS FortiGate — base signatures 18.0.456. Tests de non-régression OK sur flux de production.' },
  { uid:adminId,  month:3, day:15, tag:'BACKUP',  content:'Déploiement solution backup cloud Azure Backup Vault pour configs critiques. Rétention 90 jours activée.' },
  { uid:martinId, month:3, day:21, tag:'ADM',     content:'Revue trimestrielle des accès admin. 2 comptes dormants désactivés. MFA activé sur 15 comptes restants.' },
  { uid:durandId, month:3, day:28, tag:'INCIDENT',content:'Pic CPU 98% sur fw-pdc-01 pendant 45min. Cause: connexions UDP flood interne. Source isolée, VM réinstallée.' },
  // Avr 2023
  { uid:adminId,  month:4, day:4,  tag:'NET',     content:'Activation OSPF authentication MD5 sur backbone. Mise à jour configuration 12 routeurs de distribution.' },
  { uid:martinId, month:4, day:10, tag:'SECU',    content:'Formation ISO 27001 équipe sécurité — 2 jours. Certification 3 techniciens prévue T3 2023.' },
  { uid:adminId,  month:4, day:17, tag:'BACKUP',  content:'Test restauration DR mensuel — RTO mesuré: 38 minutes. Amélioration par rapport mois précédent (53 min).' },
  { uid:martinId, month:4, day:24, tag:'ADM',     content:'Migration DNS interne vers Infoblox. Zones de résolution créées, serveurs secondaires configurés.' },
  // Mai 2023
  { uid:adminId,  month:5, day:3,  tag:'SECU',    content:'Déploiement SIEM (Splunk). Connecteurs syslog configurés sur 45 équipements réseau. Dashboards initiaux créés.' },
  { uid:martinId, month:5, day:9,  tag:'NET',     content:'Upgrade liens inter-datacenter Paris-Lyon à 10Gbps. Fibres noires posées, interfaces SFP+ installées.' },
  { uid:adminId,  month:5, day:16, tag:'BACKUP',  content:'Audit sauvegardes Q1 2023 — taux succès 97,8%. 3 échecs dus timeouts SSH. Scripts optimisés.' },
  { uid:durandId, month:5, day:23, tag:'INCIDENT',content:'Panne UPS datacenter Paris PDU-B. Basculement automatique PDU-A OK. Remplacement batterie planifié.' },
  // Jun 2023
  { uid:adminId,  month:6, day:1,  tag:'ADM',     content:'Renouvellement certificats SSL wildcard *.corp.local — validité 2 ans. Déploiement sur 8 équipements.' },
  { uid:martinId, month:6, day:7,  tag:'NET',     content:'Configuration QoS DSCP sur tous les liens WAN. Priorité: VoIP EF, Data AF41, Bulk BE.' },
  { uid:adminId,  month:6, day:14, tag:'SECU',    content:'Pentest externe mandaté — société TigerSec. Rapport remis: 1 critique, 4 medium. Corrections planifiées S30.' },
  { uid:martinId, month:6, day:21, tag:'BACKUP',  content:'Migration sauvegardes vers NAS Synology RS2421+ site Bruxelles. 2To transférés, vérification checksums OK.' },
  // Jul 2023
  { uid:adminId,  month:7, day:5,  tag:'SECU',    content:'Correction vulnérabilité critique (CVE-2023-27997 Fortinet RCE). Patch 7.2.5 appliqué en urgence, nuit du 4 au 5.' },
  { uid:martinId, month:7, day:12, tag:'NET',     content:'Remplacement 3 switches access défaillants site Namur. Modèle Cisco 2960X remplacé par Catalyst 9200L.' },
  { uid:adminId,  month:7, day:19, tag:'ADM',     content:'Audit permissions NTFS serveurs de fichiers. Nettoyage 230 ACL orphelines. Documentation mise à jour.' },
  { uid:durandId, month:7, day:26, tag:'INCIDENT',content:'Attaque ransomware bloquée sur poste RH Paris. CrowdStrike a isolé la menace à 08h43. Analyse forensique lancée.' },
  // Aou 2023
  { uid:adminId,  month:8, day:2,  tag:'BACKUP',  content:'Revue procédures DR suite incident juillet. Amélioration runbook, temps isolation réduit de 12min à 4min.' },
  { uid:martinId, month:8, day:9,  tag:'NET',     content:'Ajout lien MPLS site Genève en redondance. BGP configuré, tests de convergence validés sous 8 secondes.' },
  { uid:adminId,  month:8, day:16, tag:'SECU',    content:'Mise à jour politique BYOD — chiffrement obligatoire appareils mobiles. Déploiement MDM Microsoft Intune.' },
  { uid:martinId, month:8, day:23, tag:'ADM',     content:'Migration WSUS local vers Windows Update for Business (WUfB). Dépréciation serveur WSUS planifiée Nov 2023.' },
  // Sep 2023
  { uid:adminId,  month:9, day:6,  tag:'NET',     content:'Déploiement SD-WAN Fortinet sur sites secondaires. 6 sites migrés en phase 1. Réduction coûts WAN estimée 30%.' },
  { uid:martinId, month:9, day:13, tag:'SECU',    content:'Exercice Red Team interne — test phishing sur 80 utilisateurs. Taux de clic: 12%. Formation relancée.' },
  { uid:adminId,  month:9, day:20, tag:'BACKUP',  content:'Certification sauvegardes conforme RGPD — vérification localisation données EU. Rapport DPO signé.' },
  { uid:durandId, month:9, day:27, tag:'INCIDENT',content:'Défaillance link aggregation LACP sw-paris-acc-03. Basculement sur port single. Remplacement planifié J+3.' },
  // Oct 2023
  { uid:adminId,  month:10, day:4, tag:'ADM',     content:'Revue annuelle politique de sécurité (PSI). Validation COMEX. Diffusion aux équipes IT France et Belgique.' },
  { uid:martinId, month:10, day:11,tag:'NET',     content:'Activation IPv6 dual-stack sur backbone. Adressage /48 alloué par FAI. Tests accès externes validés.' },
  { uid:adminId,  month:10, day:18,tag:'SECU',    content:'Déploiement EDR sur serveurs Windows (80 instances). CrowdStrike Falcon complète la couverture postes.' },
  { uid:martinId, month:10, day:25,tag:'BACKUP',  content:'Test annuel PRA — simulation perte total datacenter Paris. RTO global: 6h42. Objectif 4h non atteint: plan d\'action.' },
  // Nov 2023
  { uid:adminId,  month:11, day:2, tag:'NET',     content:'Migration NTP — remplacement serveur Stratum 2 interne par pool NTP Cloudflare + GPS local site Paris.' },
  { uid:martinId, month:11, day:8, tag:'SECU',    content:'Revue trimestrielle accès fournisseurs. 4 accès temporaires révoqués, 2 renouvelés avec MFA obligatoire.' },
  { uid:adminId,  month:11, day:15,tag:'BACKUP',  content:'Upgrade solution sauvegarde Veeam B&R 12.1. Migration jobs, tests restauration OK. Nouvelle déduplication +25%.' },
  { uid:durandId, month:11, day:22,tag:'INCIDENT',content:'Coupure partielle réseau Belgique — routeur BGP rebooté suite OOM. Config mémoire ajustée, monitoring renforcé.' },
  // Dec 2023
  { uid:adminId,  month:12, day:7, tag:'ADM',     content:'Bilan annuel sécurité 2023 — 0 incident critique, 3 medium, 12 low. Budget 2024 présenté DSI.' },
  { uid:martinId, month:12, day:14,tag:'NET',     content:'Gel des changements réseau pour fêtes de fin d\'année (14/12-02/01). Procédure d\'urgence activée.' },
  { uid:adminId,  month:12, day:21,tag:'BACKUP',  content:'Sauvegarde complète pré-congés — snapshot toutes configurations. Archives conservées 1 an minimum.' },
];

// ── Entrées historiques 2024 ──────────────────────────────────────────────────
const entries2024 = [
  // Jan 2024
  { uid:adminId,  month:1, day:8,  tag:'NET',     content:'Fin gel réseau. Déploiement 15 mises à jour firmware en attente. Tests de non-régression validés.' },
  { uid:martinId, month:1, day:12, tag:'SECU',    content:'Correction CVE-2024-21762 (FortiOS SSLVPN RCE). Patch appliqué en urgence sur 6 firewalls en 3h.' },
  { uid:adminId,  month:1, day:18, tag:'ADM',     content:'Intégration nouveaux outils ITSM — ServiceNow. Formation équipe helpdesk sur module incidents réseau.' },
  { uid:martinId, month:1, day:25, tag:'BACKUP',  content:'Revue et optimisation plans sauvegarde 2024. Fréquence quotidienne activée sur équipements critiques.' },
  // Fev 2024
  { uid:adminId,  month:2, day:1,  tag:'NET',     content:'Extension zone DMZ — 2 nouveaux VLAN (VLAN 200 WAF, VLAN 210 Reverse Proxy). Règles firewall créées.' },
  { uid:martinId, month:2, day:8,  tag:'SECU',    content:'Activation MFA sur tous les accès VPN. Migration Cisco AnyConnect vers GlobalProtect Palo Alto.' },
  { uid:adminId,  month:2, day:15, tag:'ADM',     content:'Audit comptes de service AD. 12 comptes avec mot de passe qui n\'expire jamais — politique corrigée.' },
  { uid:durandId, month:2, day:22, tag:'INCIDENT',content:'Storm de broadcast site Bordeaux — boucle L2 non détectée. STP reconfiguré, BPDU Guard activé.' },
  // Mar 2024
  { uid:adminId,  month:3, day:7,  tag:'SECU',    content:'Déploiement solution DLP (Data Loss Prevention) — surveillance transferts données sensibles sur proxies.' },
  { uid:martinId, month:3, day:14, tag:'NET',     content:'Mise en service cluster HA FortiGate (FGCP active-passive) site Paris. Failover testé: 2,3 secondes.' },
  { uid:adminId,  month:3, day:21, tag:'BACKUP',  content:'Test restauration trimestriel — 8 configs restaurées en environnement isolé. Cohérence validée 100%.' },
  { uid:martinId, month:3, day:28, tag:'ADM',     content:'Migration messagerie Exchange On-Premise vers Exchange Online. 350 boîtes mail migrées en 3 vagues.' },
  // Avr 2024
  { uid:adminId,  month:4, day:4,  tag:'NET',     content:'Déploiement Cisco DNA Center pour gestion centralisée switches IOS-XE. Onboarding 45 équipements.' },
  { uid:martinId, month:4, day:11, tag:'SECU',    content:'Exercice crise cyber — simulation ransomware. Temps de réponse équipe: 18 min. Objectif 15 min presque atteint.' },
  { uid:adminId,  month:4, day:18, tag:'BACKUP',  content:'Activation Object Lock (WORM) sur stockage S3 compatible backups critiques. Immuabilité 30 jours.' },
  { uid:durandId, month:4, day:25, tag:'INCIDENT',content:'Intrusion détectée sur VLAN guest Namur — scan interne. Source: imprimante compromise. Isolation + réinitialisation.' },
  // Mai 2024
  { uid:adminId,  month:5, day:2,  tag:'ADM',     content:'Bilan sécurité Q1 2024 présenté RSSI. Indicateurs: MTTD 4h12, MTTR 6h35. Amélioration vs Q4 2023.' },
  { uid:martinId, month:5, day:9,  tag:'NET',     content:'Extension MPLS — ajout site Toulouse. Bande passante 100Mbps, configuration QoS héritée des autres sites.' },
  { uid:adminId,  month:5, day:16, tag:'SECU',    content:'Renouvellement certificats PKI interne — CA racine et CA intermédiaire. Migration SHA-256 → SHA-384.' },
  { uid:martinId, month:5, day:23, tag:'BACKUP',  content:'Déploiement backup immutable air-gap — solution Veeam + Quantum DXi. Protection ransomware renforcée.' },
  // Jun 2024
  { uid:adminId,  month:6, day:6,  tag:'NET',     content:'Mise à niveau infrastructure Wi-Fi — remplacement AP Cisco 2802 par C9130. Couverture 6GHz activée.' },
  { uid:martinId, month:6, day:13, tag:'SECU',    content:'Audit SOC2 Type II annuel — collecte preuves. 0 finding critique. Rapport audit disponible S32.' },
  { uid:adminId,  month:6, day:20, tag:'ADM',     content:'Refonte procédures ITIL — nouveaux SLAs P1:1h, P2:4h, P3:8h. Intégration ServiceNow OLA/UC.' },
  { uid:durandId, month:6, day:27, tag:'INCIDENT',content:'DDoS volumétrique sur IP publique Paris (120Gbps). Mitigation Cloudflare activée en 8 min. Durée: 22 min.' },
  // Jul 2024
  { uid:adminId,  month:7, day:4,  tag:'SECU',    content:'Mise à jour PSSI suite audit juin. Chapitre gestion incidents renforcé, procédure notification CNIL ajoutée.' },
  { uid:martinId, month:7, day:11, tag:'NET',     content:'Activation BGP FlowSpec pour mitigation DDoS automatique. Tests validés avec opérateurs Orange et SFR.' },
  { uid:adminId,  month:7, day:18, tag:'BACKUP',  content:'Exercice DR complet H1 2024 — RTO atteint en 4h58. Amélioration significative vs 2023 (6h42).' },
  { uid:martinId, month:7, day:25, tag:'ADM',     content:'Préparation audit ISO 27001 — collecte 180 pièces justificatives. Audit externe planifié septembre 2024.' },
  // Aou 2024
  { uid:adminId,  month:8, day:1,  tag:'NET',     content:'Déploiement ZTNA (Zero Trust) pour accès applications sensibles. Remplacement VPN legacy 40 utilisateurs pilotes.' },
  { uid:martinId, month:8, day:8,  tag:'SECU',    content:'Patch Tuesday août 2024 — 12 CVE corrigées dont 2 critiques (Windows CLFS, Exchange). Déploiement 48h.' },
  { uid:adminId,  month:8, day:15, tag:'BACKUP',  content:'Migration données d\'archivage vers Azure Cool Storage. Économie stockage 60%. Politiques lifecycle activées.' },
  { uid:durandId, month:8, day:22, tag:'INCIDENT',content:'Panne onduleur datacenter Bruxelles — bascule groupe électrogène. Durée: 1h47. RCA: maintenance préventive manquée.' },
  // Sep 2024
  { uid:adminId,  month:9, day:5,  tag:'ADM',     content:'Certification ISO 27001 obtenue ! Audit 2 jours, 0 non-conformité majeure. Certificat valide 3 ans.' },
  { uid:martinId, month:9, day:12, tag:'NET',     content:'Optimisation routage inter-sites — OSPF cost ajusté, réduction latence Paris-Lyon de 12ms à 8ms.' },
  { uid:adminId,  month:9, day:19, tag:'SECU',    content:'Déploiement CASB (Cloud Access Security Broker) — gouvernance accès SaaS (M365, Salesforce, ServiceNow).' },
  { uid:martinId, month:9, day:26, tag:'BACKUP',  content:'Vérification conformité RGPD sauvegardes Q3 — chiffrement AES-256 validé, localisation EU confirmée.' },
  // Oct 2024
  { uid:adminId,  month:10, day:3, tag:'NET',     content:'Phase 2 SD-WAN — migration 8 sites supplémentaires. Économie WAN mensuelle: 12 400€. SLA amélioré.' },
  { uid:martinId, month:10, day:10,tag:'SECU',    content:'Purple Team exercise — collaboration équipes offensives/défensives. 15 TTPs MITRE ATT&CK testés.' },
  { uid:adminId,  month:10, day:17,tag:'ADM',     content:'Revue annuelle fournisseurs IT — 3 contrats renouvelés, 1 résilié (prestataire NOC sous-performant).' },
  { uid:durandId, month:10, day:24,tag:'INCIDENT',content:'Erreur configuration BGP site Genève — route leak interne. Correction en 9 minutes. Impact: 3 utilisateurs.' },
  // Nov 2024
  { uid:adminId,  month:11, day:7, tag:'NET',     content:'Upgrade backbone 40Gbps Paris-Bruxelles. Fibres DWDM provisionnées, LSP MPLS TE créés. Latence -40%.' },
  { uid:martinId, month:11, day:14,tag:'SECU',    content:'Simulation phishing Q4 — 95 utilisateurs ciblés. Taux de clic: 6% (en baisse vs 12% jan). Efficacité formations.' },
  { uid:adminId,  month:11, day:21,tag:'BACKUP',  content:'Bilan annuel sauvegardes 2024 — taux succès 99,2%. 3 incidents mineurs. Plan 2025 validé DSI.' },
  { uid:durandId, month:11, day:28,tag:'INCIDENT',content:'Défaillance disque NAS Lyon — RAID dégradé. Remplacement hot-swap J+0. Données intègres, pas de perte.' },
  // Dec 2024
  { uid:adminId,  month:12, day:5, tag:'ADM',     content:'Bilan sécurité annuel 2024. Incidents: 0 critique, 2 élevé, 8 moyen. Budget 2025 cybersécurité +15%.' },
  { uid:martinId, month:12, day:12,tag:'NET',     content:'Planification réseau 2025 — roadmap H1: SASE, expansion SD-WAN phase 3, refresh switches access sites FR.' },
  { uid:adminId,  month:12, day:19,tag:'BACKUP',  content:'Sauvegarde complète fin d\'année. Archives 2022-2024 migrées en stockage froid. Gel changements activé.' },
];

// ── Entrées historiques 2025 ──────────────────────────────────────────────────
const entries2025 = [
  // Jan 2025
  { uid:adminId,  month:1, day:9,  tag:'NET',     content:'Fin gel réseau. Déploiement SASE phase 1 — onboarding 5 sites pilotes Zscaler ZIA + ZPA.' },
  { uid:martinId, month:1, day:15, tag:'SECU',    content:'Correction CVE-2025-0282 (Ivanti Connect Secure). Patch appliqué d\'urgence, audit logs analysés.' },
  { uid:adminId,  month:1, day:22, tag:'ADM',     content:'Intégration annuaire Azure AD avec Okta pour SSO unifié. 1200 utilisateurs migrés en 4 vagues.' },
  { uid:martinId, month:1, day:29, tag:'BACKUP',  content:'Audit sauvegardes post-migration Azure. 98,7% des configs sauvegardées. 3 équipements ajoutés au plan.' },
  // Fev 2025
  { uid:adminId,  month:2, day:6,  tag:'NET',     content:'Phase 2 SASE — migration 10 sites supplémentaires. Abandon proxy legacy Bluecoat après 8 ans.' },
  { uid:martinId, month:2, day:13, tag:'SECU',    content:'Table top exercise scénario supply chain attack. Durée 4h. Gap analysis: améliorer vérification intégrité packages.' },
  { uid:adminId,  month:2, day:20, tag:'BACKUP',  content:'Déploiement Cohesity DataProtect pour VM critiques. Intégration vSphere, politiques SLA configurées.' },
  { uid:durandId, month:2, day:27, tag:'INCIDENT',content:'Faux positif EDR bloque processus métier Paris. Impact 45 min production. Exclusion ajoutée, post-mortem fait.' },
  // Mar 2025
  { uid:adminId,  month:3, day:6,  tag:'ADM',     content:'Certification ISO 27001 surveillance annuelle — 0 non-conformité. Prochaine surveillance mars 2026.' },
  { uid:martinId, month:3, day:13, tag:'NET',     content:'Activation EVPN/VXLAN datacenter Paris. Migration L2 overlay, performances inter-VM améliorées de 35%.' },
  { uid:adminId,  month:3, day:20, tag:'SECU',    content:'Déploiement XDR (Extended Detection Response) — corrélation SIEM+EDR+NDR. MTTD estimé -60%.' },
  { uid:martinId, month:3, day:27, tag:'BACKUP',  content:'Test DR Q1 2025 — RTO: 3h22. Premier passage sous l\'objectif 4h. Amélioration continue validée.' },
  // Avr 2025
  { uid:adminId,  month:4, day:3,  tag:'NET',     content:'SD-WAN phase 3 — migration 12 derniers sites. 100% du parc migré. Économie annuelle WAN: 180k€.' },
  { uid:martinId, month:4, day:10, tag:'SECU',    content:'Patch Patch Tuesday avril critique — correction CVE-2025-29824 (CLFS Windows SYSTEM). Déploiement 6h.' },
  { uid:adminId,  month:4, day:17, tag:'ADM',     content:'Migration complète vers Entra ID (Azure AD). Dépréciation AD on-premise planifiée T4 2025.' },
  { uid:durandId, month:4, day:24, tag:'INCIDENT',content:'Saturation BGP table routage site Amsterdam — mémoire TCAM. Agrégation routes activée, résolution 23 min.' },
  // Mai 2025
  { uid:adminId,  month:5, day:2,  tag:'NET',     content:'Déploiement 5G private network site entrepôt Lyon — 8 bornes Nokia, couverture 100% surface logistique.' },
  { uid:martinId, month:5, day:8,  tag:'SECU',    content:'Red Team exercise Q2 — 3 vecteurs d\'attaque testés, 2 bloqués XDR, 1 atteint niveau lateral movement.' },
  { uid:adminId,  month:5, day:15, tag:'BACKUP',  content:'Audit trimestriel sauvegardes. Nouveaux équipements réseau ajoutés au plan. 100% équipements couverts.' },
  { uid:martinId, month:5, day:22, tag:'ADM',     content:'Revue fournisseurs S1 2025. Renouvellement contrat Cisco ELA 3 ans. Économie estimée 200k€ sur période.' },
  // Jun 2025
  { uid:adminId,  month:6, day:5,  tag:'SECU',    content:'Activation Microsoft Sentinel pour SIEM cloud. Migration alertes depuis Splunk. ROI estimé positif an 2.' },
  { uid:martinId, month:6, day:12, tag:'NET',     content:'Mise à niveau infrastructure DNS — déploiement DNSSEC sur zones publiques. Validation algorithme ECDSA P-256.' },
  { uid:adminId,  month:6, day:19, tag:'BACKUP',  content:'Exercice DR H1 2025 — RTO: 2h58. Premier passage sous 3h ! Record historique. Équipe félicitée.' },
  { uid:durandId, month:6, day:26, tag:'INCIDENT',content:'Fuite données potentielle détectée DLP — export CSV non autorisé. Enquête: erreur manipulation. Rappel procédures.' },
  // Jul 2025
  { uid:adminId,  month:7, day:3,  tag:'ADM',     content:'Décommissionnement 12 serveurs physiques obsolètes. Virtualisation complète datacenter Paris atteinte.' },
  { uid:martinId, month:7, day:10, tag:'NET',     content:'Activation anycast DNS résolveurs internes — Cloudflare 1.1.1.1 for Teams + résolveurs propres en fallback.' },
  { uid:adminId,  month:7, day:17, tag:'SECU',    content:'Déploiement PAM (Privileged Access Management) CyberArk. 45 comptes admin en coffre-fort. PEDM activé.' },
  { uid:martinId, month:7, day:24, tag:'BACKUP',  content:'Migration politique archivage: rétention 7 ans pour configs critiques (obligation légale secteur financier).' },
  // Aou 2025
  { uid:adminId,  month:8, day:7,  tag:'NET',     content:'Refresh switches access France phase 1 — remplacement 60 Cisco 2960X par Catalyst 9200. PoE++ activé.' },
  { uid:martinId, month:8, day:14, tag:'SECU',    content:'Patch zero-day Windows Server 2025 (CVE-2025-38345). Déploiement forcé en 4h sur 35 serveurs critiques.' },
  { uid:adminId,  month:8, day:21, tag:'BACKUP',  content:'Revue annuelle politique DR/BCP. Mise à jour plans suite changements infra. Formation équipes astreinte.' },
  { uid:durandId, month:8, day:28, tag:'INCIDENT',content:'Panne cooling datacenter Bruxelles — température salle +8°C en 12 min. Réduction charge serveurs. Durée: 2h.' },
  // Sep 2025
  { uid:adminId,  month:9, day:4,  tag:'ADM',     content:'Audit ISO 27001 renouvellement triannuel — certification maintenue. Prochaine échéance: octobre 2027.' },
  { uid:martinId, month:9, day:11, tag:'NET',     content:'Refresh switches access phase 2 Belgique — 40 équipements. Wi-Fi 6E activé, couverture renforcée.' },
  { uid:adminId,  month:9, day:18, tag:'SECU',    content:'Exercice phishing simulé Q3 2025 — taux clic 4%. Objectif 5% atteint pour la première fois !' },
  { uid:martinId, month:9, day:25, tag:'BACKUP',  content:'Intégration NexusVault API dans CMDB — synchronisation automatique état équipements et dernière sauvegarde.' },
  // Oct 2025
  { uid:adminId,  month:10, day:2, tag:'NET',     content:'Activation RPKI pour sécurisation routage BGP — validation ROA pour 4 blocs IPv4 et 2 blocs IPv6.' },
  { uid:martinId, month:10, day:9, tag:'SECU',    content:'Revue TIBER-EU (threat intelligence). Rapport menaces secteur reçu CERT. 3 IOC intégrés dans XDR.' },
  { uid:adminId,  month:10, day:16,tag:'ADM',     content:'Renouvellement licences 2026 — Microsoft EA, Palo Alto, CrowdStrike. Budget total: 890k€ validé DSI.' },
  { uid:durandId, month:10, day:23,tag:'INCIDENT',content:'Perte connectivité partielle site Nantes — BGP session down 47 min. Cause: reboot inattendu routeur PE FAI.' },
  // Nov 2025
  { uid:adminId,  month:11, day:6, tag:'NET',     content:'Déploiement AIOps (Moogsoft) pour corrélation alertes réseau. Réduction faux positifs estimée -70%.' },
  { uid:martinId, month:11, day:13,tag:'SECU',    content:'Patch Tuesday nov 2025 — CVE-2025-49019 critique Exchange exploitée. Patch OOB en urgence 4h après divulgation.' },
  { uid:adminId,  month:11, day:20,tag:'BACKUP',  content:'Bilan DR annuel — MTTD: 3h12, MTTR: 5h44. Progression constante depuis 3 ans. Objectifs 2026 définis.' },
  { uid:durandId, month:11, day:27,tag:'INCIDENT',content:'BGP route flap upstream Orange. 12 min de dégradation trafic Internet. Escalade NOC opérateur, patch correctif.' },
  // Dec 2025
  { uid:adminId,  month:12, day:4, tag:'ADM',     content:'Bilan annuel sécurité 2025. Incidents: 0 critique, 1 élevé, 5 moyen. Meilleure année depuis 5 ans.' },
  { uid:martinId, month:12, day:11,tag:'NET',     content:'Roadmap réseau 2026 validée: SASE complet, 5G private extension, renouvellement backbone 100Gbps.' },
  { uid:adminId,  month:12, day:18,tag:'BACKUP',  content:'Sauvegarde bilan fin d\'année — snapshot complet 68 équipements. Gel changements 18 déc - 5 jan 2026.' },
];

for (const [year, arr] of [[2023, entries2023],[2024, entries2024],[2025, entries2025]]) {
  for (const e of arr) {
    if (!e.uid) continue;
    db.prepare('INSERT INTO activity_entries (user_id, year, month, tag_code, content, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(e.uid, year, e.month, e.tag, e.content, dt(year, e.month, e.day, randInt(8,17), randInt(0,59)), dt(year, e.month, e.day, randInt(8,17), randInt(0,59)));
  }
  console.log(`  Entrées ${year}: ${arr.length} notes`);
}

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
