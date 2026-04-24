# NexusVault — Changelog

---

## 2026-04-24_b48.140
> Build 48 du 24 avril 2026 — 140 requêtes cumulées

### Corrections permissions (causes racines identifiées)
- **activity_tags — cause** : `requirePerm()` dans `auth.js` lisait uniquement `req.user.permissions` (champ JWT signé au login). Or la matrice des droits est stockée dans `settings.role_permissions` et N'EST PAS dans le JWT. Fix : `requirePerm()` vérifie d'abord le JWT, puis interroge `settings.role_permissions` en base comme fallback — sans nécessiter une reconnexion
- **activity_read — cause** : le sélecteur d'utilisateur nécessite `api.users()` → `GET /api/users` → `requireRole('admin')`. Un non-admin recevait 403 et `users` restait vide. Fix : nouvel endpoint `GET /api/users/for-activity` accessible à tout utilisateur ayant `activity_read` (vérifié via JWT ou role_permissions en base). Retourne uniquement `id`, `username`, `display_name`
- **Date build** : corrigée — 24/04/2026 au lieu de 23/04/2026

---

## 2026-04-23_b47.138
> Build 47 du 23 avril 2026 — 138 requêtes cumulées

### Corrections permissions
- **Navbar** : "Suivi" renommé "Suivi d'activité" dans `fr.js`
- **activity_tags** : routes backend POST/PUT/DELETE des tags utilisaient `requireRole('admin')` en dur. Remplacé par `requirePerm('activity_tags')` — tout rôle avec ce droit peut maintenant créer/modifier/supprimer des tags
- **activity_read** : le backend filtrait `user_id` uniquement pour `role === 'admin'`. Ajout de `canViewAll = req.user.role === 'admin' || userPerms.activity_read === true` dans les routes `/api/activity/entries` et `/api/activity/years` — les non-admins avec ce droit voient les entrées des autres utilisateurs
- **Droits d'accès** : après sauvegarde, la page se recharge automatiquement (1s) pour appliquer les nouveaux droits sans attendre une reconnexion

---

## 2026-04-23_b46.135
> Build 46 du 23 avril 2026 — 135 requêtes cumulées

### Corrections permissions
- **activity_tags** : l'onglet "Tags d'activité" dans Administration est maintenant visible pour tout rôle ayant `activity_tags` coché, pas seulement admin. Condition corrigée : `isAdmin || can('activity_tags')`
- **activity_read** : la page Suivi d'activité affiche maintenant le sélecteur d'utilisateurs et permet de voir les notes des autres si `can('activity_read')`. Variable `canViewAll = isAdmin || can('activity_read')` utilisée à 3 endroits : chargement des users, sélecteur UI, `targetUserId`

---

## 2026-04-23_b45.133
> Build 45 du 23 avril 2026 — 133 requêtes cumulées

### Corrections & améliorations
- **Appareils — Sites** : boutons Modifier/Suppr. maintenant conditionnés par `can('config_write')` (comme Modèles et Équipements)
- **Liste d'accès IP/URL** : message centré, icône info supprimée
- **Notifications** : message d'avertissement stylisé `alert-warn` centré (identique à l'onglet OIDC)
- **Droits d'accès — backup_compare** : nouveau droit "Comparer les backups". Le bouton "Comparer" dans Backups est masqué si ce droit est absent. Admin/Opérateur: ✓, Lecteur: ✗
- **Droits d'accès — activité** : lignes inversées. `activity_write` = "Ajouter / modifier ses propres notes" (en premier). `activity_read` = "Consulter le suivi des autres utilisateurs" (en second)
- **Tags d'activité dans Admin** : onglet renommé "Tags d'activité" (était "Suivi d'activité") pour éviter la confusion avec la page principale
- **Navbar** : lien `/activity` conditionné par `can('activity_read') || can('activity_write')`. Lien `/scripts` conditionné par `can('scripts_read')`

---

## 2026-04-23_b44.127
> Build 44 du 23 avril 2026 — 127 requêtes cumulées

### Corrections
- **Personnalisation — largeur** : en mode `embedded` dans Admin, le composant retourne un `<div>` au lieu d'un `<main>` pour hériter correctement de la largeur de la colonne de contenu Admin
- **Personnalisation — alerte centrée** : le texte de l'alerte du Tableau de bord est centré (`textAlign:center`, `justifyContent:center`)
- **Droits d'accès — Scripts** : permissions `scripts_read` ("Voir les scripts") et `scripts_exec` ("Exécuter les scripts") ajoutées dans la matrice `PERM_GROUPS` de `RolePermissionsCard`
- **URL de l'application** : description → "URL publique de l'application." / label → "Adresse URL"
- **Appareils — permissions** : les boutons Ajouter, Édit., Dupli. et Suppr. dans `ModelsTab` et `DevicesTab` sont maintenant conditionnés par `can('config_write')`. Sans cette permission, les boutons sont invisibles

---

## 2026-04-23_b43.122
> Build 43 du 23 avril 2026 — 122 requêtes cumulées

### Corrections critiques
- **Crash Sécurité (définitif)** : les états `appUrl`, `urlSaving`, `urlMsg` déclarés par `useState` n'étaient pas présents dans `SecurityGeneralTab` malgré les références dans le JSX et le `useEffect`. Ajoutés proprement

### Nouvelles fonctionnalités
- **Personnalisation** : nouveau menu dans Administration → après "Mon compte". 4 onglets :
  - **Tableau de bord** : checkboxes pour afficher/masquer chaque tuile par section (Backups / Activité)
  - **Backup** : placeholder "Bientôt disponible"
  - **Scripts** : placeholder "Bientôt disponible"
  - **Suivi d'activité** : 4 préférences (déplier année courante, compteur PRV, en-tête PDF, chargement auto)
- **Scripts** : textes corrigés ("Gestion des scripts", "lieu sécurisé")
- **Navbar** : "Suivi" renommé "Suivi d'activité" via `fr.js`

---

## 2026-04-23_b42.118
> Build 42 du 23 avril 2026 — 118 requêtes cumulées

### Corrections critiques
- **Crash Sécurité** : la carte URL de l'application dans `SecurityGeneralTab` référençait des variables supprimées lors du nettoyage (`smtp.app_url`, `urlMsg`, `urlSaving`, `saveAppUrl`). Remplacées par des états locaux propres (`appUrl`, `urlMsg`, `urlSaving`, `saveAppUrl`)

### Nouvelles fonctionnalités
- **Navigation — Scripts** : nouveau lien dans la navbar entre Backups et Suivi. Route `/scripts`. Page placeholder "Bientôt disponible"
- **Permissions Scripts** : `scripts_read` (Admin ✓, Opérateur ✓, Lecteur ✓) et `scripts_exec` (Admin ✓, Opérateur ✗, Lecteur ✗) ajoutés dans `usePerms.js` et dans la matrice Droits d'accès

---

## 2026-04-23_b41.116
> Build 41 du 23 avril 2026 — 116 requêtes cumulées

### Corrections & nouvelles fonctionnalités
- **Drapeaux** : SVG inline en base64 intégrés dans `frontend/src/i18n/flags.js` — aucune dépendance réseau, chargés avec le bundle Vite. Drapeaux dessinés en SVG pur pour les 11 langues
- **Sécurité → Général** : cartes SMTP et Telegram supprimées (configurables via Notifications → boutons dédiés). Code orphelin nettoyé
- **Notifications** : texte → "Les notifications sont envoyées aux administrateurs uniquement !"
- **Notifications — modals** : `Spinner` ajouté dans les imports Admin.jsx (causait une erreur silencieuse)
- **Notifications — colonnes** : Événement prend toute la largeur (`width:100%`), colonnes SMTP/Telegram/Slack réduites à 56px
- **Notifications — brute force** : option durée de la fenêtre (5/10/15 minutes) dans la colonne Options
- **OIDC — texte info** : centré, icône SVG supprimée

---

## 2026-04-23_b40.109
> Build 40 du 23 avril 2026 — 109 requêtes cumulées

### Corrections
- **LangSwitcher — drapeaux** : abandon de Twemoji via CDN (images bloquées dans les conteneurs Docker sans accès internet). Retour aux emojis Unicode natifs avec stack de polices emoji explicite (`Apple Color Emoji`, `Segoe UI Emoji`, `Noto Color Emoji`). Affichage garanti dans tous les navigateurs modernes sans dépendance réseau. Taille 20-22px dans le bouton et le dropdown

---

## 2026-04-23_b39.108
> Build 39 du 23 avril 2026 — 108 requêtes cumulées

### Corrections & nouvelles fonctionnalités
- **LangSwitcher — drapeaux SVG** : utilise Twemoji 14.0.2 via cdnjs pour afficher les vrais drapeaux SVG (conversion code langue → codepoint Regional Indicator). Taille dropdown réduite (190px, police 12px)
- **Notifications — UX refonte complète** :
  - Carte supérieure : message centré + 3 boutons colorés (SMTP bleu, Telegram bleu clair, Slack rose). Chaque bouton ouvre un modal dédié avec formulaire + bouton "Tester". Un point vert et ✓ s'affichent si le canal est configuré
  - Tableau des règles : une ligne par événement, une colonne par canal activé, cases à cocher individuelles (grisées si canal non configuré), colonne Options (fréquence, seuil)
- **Slack** : nouveau canal de notification. Webhook URL, configuration en modal, test direct
- **Fix notifications vides** : `available()` évaluée côté backend avant sérialisation JSON

---

## 2026-04-23_b38.103
> Build 38 du 23 avril 2026 — 103 requêtes cumulées

### Corrections & nouvelles fonctionnalités
- **Notifications — fix affichage vide** : le catalog endpoint sérialisait `available()` comme fonction (non JSON) → le channel list était vide côté frontend. Fix : `available()` est maintenant évalué côté backend avant sérialisation
- **Telegram** : nouveau canal de notification. Configuration dans Administration → Sécurité → Général (Bot Token + Chat ID). Bouton "Tester". Chargé en mémoire au démarrage comme SMTP. Le handler Telegram utilise l'API `sendMessage` native
- **LangSwitcher — drapeaux grands format** : les emojis drapeaux sont affichés en 22-24px (style Nginx Proxy Manager) avec bordure gauche colorée sur la langue active et chevron dans le bouton
- **LangSwitcher — rechargement** : changer de langue provoque un `window.location.reload()` après 50ms pour appliquer la traduction immédiatement sur toute l'interface sans avoir à gérer un re-render global

---

## 2026-04-23_b37.100
> Build 37 du 23 avril 2026 — 100 requêtes cumulées

### Nouvelles fonctionnalités
- **Système de notifications** (Administration → Sécurité → Notifications) : architecture extensible par canaux (email SMTP, logs Docker — futurs : webhook, Slack, Teams). Chaque notification est configurable indépendamment avec activation/désactivation et choix des canaux
- **5 événements notifiables** :
  - `backup_download` : téléchargement de configuration (date/heure, utilisateur, IP, équipement, version)
  - `login_failed_threshold` : tentatives échouées au seuil configuré (défaut 3), paramétrable 1-10
  - `account_locked` : verrouillage brute force (date/heure, IP, identifiant, nb tentatives, durée verrou)
  - `preview_recap` : récapitulatif périodique (quotidien/hebdo/mensuel avec choix du jour) de toutes les notes preview
  - `preview_overdue` : alerte si des notes preview existent sur des mois/années passés
- **Interface** : cartes dépliables par événement, checkboxes canaux avec badge "SMTP requis", bouton "Tester" pour chaque événement, options de fréquence dynamiques
- **Historique** : chaque envoi (succès ou erreur) est tracé en base (`notification_log`)

---

## 2026-04-23_b36.99
> Build 36 du 23 avril 2026 — 99 requêtes cumulées

### Nouvelles fonctionnalités
- **Internationalisation (i18n)** : bouton drapeau dans la navbar → dropdown avec 11 langues et leurs drapeaux. Langue persistée dans `localStorage` (`nv_lang`), détection automatique depuis `navigator.language` au premier accès
- **Langues disponibles** : Français (référence), English, Deutsch, Español, Italiano, Português, Nederlands, Polski, Русский, 日本語, 中文
- **Fallback automatique** : toute clé non traduite utilise le français. Les traductions partielles sont acceptées
- **Extensible** : pour ajouter une langue, créer `frontend/src/i18n/locales/<code>.js` (copier `fr.js`) et l'ajouter dans `LANGUAGES` dans `i18n/index.js`. Un README contributeur est inclus dans `locales/`
- **Clés i18n actives** : navigation (Navbar), tableau de bord (titres, sous-titres, labels des tuiles)

---

## 2026-04-23_b35.98
> Build 35 du 23 avril 2026 — 98 requêtes cumulées

### Nouvelles fonctionnalités
- **Brute force protection** : après 5 tentatives échouées en 10 minutes, le compte est automatiquement verrouillé. Le login retourne un message avec le temps restant. Un bouton "Débloquer" apparaît dans la liste des utilisateurs (colonne Statut) pour permettre le déblocage manuel par un admin. Actions tracées en audit (`COMPTE_VERROUILLÉ`, `CONNEXION_BLOQUÉE`, `COMPTE_DÉVERROUILLÉ`)
- **Authentification OIDC** : nouvel onglet "Authentification" dans Administration → Sécurité. Paramètres : fournisseur, Issuer URL, Client ID/Secret, URI de redirection, scopes, création auto des utilisateurs inconnus, rôle par défaut. Les endpoints OIDC sont calculés à partir de l'Issuer URL. Aperçu du bouton de connexion. Config stockée en base
- **Tags suivi — colonnes** : Aperçu et Code proches (largeur fixe), Libellé maximisé (flex:1), boutons Édit./Suppr. alignés à droite

## v2026-04-22_b34.95 — Récapitulatif complet de la journée
> 34 builds · 95 requêtes · 22 avril 2026

---

## Résumé des fonctionnalités

### 🔐 Authentification & Sécurité
- **Renommage** : `VaultNexus` → `NexusVault` dans tous les fichiers, conteneurs, volumes
- **Reset de mot de passe par email** : lien "Mot de passe oublié ?" sur la page de connexion → modal `ForgotPasswordModal` (sans quitter la page). Génère un token valable 10 min, lien envoyé par email HTML stylisé (dégradé bleu NexusVault). Si SMTP absent, lien loggé dans les logs Docker via `logger.info`
- **Page `/reset-password`** : saisie du nouveau MDP (14 car. min.) avec indicateurs de complexité, états : demande / envoyé / token invalide / succès. Route publique hors `ProtectedLayout`
- **Audit reset** : chaque demande tracée en base (`RESET_DEMANDÉ`) avec identifiant, email et statut

### ⚙️ Configuration SMTP dans l'UI
- Nouvelle carte dans **Administration → Sécurité → Général** : hôte, port, user, mot de passe, From, case SSL/TLS
- Bouton "Tester" : envoie un email de test à l'email du compte connecté
- Config stockée en base (`settings` → `smtp_config`), chargée automatiquement au démarrage du backend
- **Cron SMTP check** toutes les 2h : logue `[WARN] [API] SMTP non configuré` si absent
- Les variables SMTP et `APP_URL` **supprimées du `.env.example`** (gérées via l'UI)

### 🏠 Tableau de bord
- **Section Backups** : 4 tuiles (Total backups, Équipements, Sites, Modèles)
- **Section Suivi d'activité** : 4 tuiles avec `height` fixe (`115px`) et `position:absolute` pour le chiffre et le TOP3
  - Notes totales (toutes périodes), Mois en cours, Année courante, Année précédente
  - **TOP3 tags** intégré dans les tuiles Année courante/précédente : affiché uniquement si total ≥ 3 notes, sans numéros, aligné à droite, séparateur à `right:120px`
  - Chiffre blanc (52px) **toujours ancré** `bottom:10px right:14px` via `position:absolute`

### 📋 Suivi d'activité
- **Notes preview** : notes sur mois futurs auto-flaggées `is_preview=1`. Badge **PRV** orange à gauche du TAG, fond hachurée orange, texte italique grisé. Exclues de tous les compteurs et de l'export PDF
- **Checkbox preview** : disponible en édition pour les mois passés. Décocher = valider la note
- **Historique** : bouton "Historique" (vert, icône rotation) dans le footer du modal d'édition. Timeline chronologique : création, modifications, changements de tag/preview — avec date, heure, utilisateur
- **Compteur automatique** : `MonthSection` charge ses entrées au montage (sans clic). Compteur visible immédiatement, format `(3 notes + 1 PRV)`
- **Compteur par année** : affiché sur la ligne de l'année sans avoir à déplier
- **État déplié persistant** : `openYears` dans le state parent → les années restent ouvertes après ajout de note
- **Export PDF amélioré** : header dégradé bleu, barre méta, camembert SVG de répartition par TAG (modes mois/année), notes preview exclues

### 📊 Journal d'audit
- **Filtres avec ✕** : Résultat (OK/Échec), Sévérité, Catégorie — chaque filtre réinitialisable individuellement
- **Filtre Résultat** appliqué côté backend (`?success=0/1`)
- **Colonnes** : Utilisateur réduit (90px), Détail maximisé, Action 150px, Résultat 70px
- **Archivage automatique (cron)** : le 1er du mois à l'heure configurée (heure locale via `nowLocal()`), les entrées du mois précédent sont archivées en base (`audit_archives`) et supprimées du journal actif
- **Bouton "Archive"** dans le header du journal : ouvre `ArchiveListModal` → grille de cartes par mois → modal de détail avec filtre OK/Échec
- **Droit `audit_archive`** : nouvelle permission dans la matrice, contrôle la visibilité du bouton Archive

### 🔒 Administration → Sécurité (onglets)
Structure à 3 onglets (style identique à la page Appareils) :
- **Général** : grille 2 colonnes (Timeout | URL application) + Liste d'accès IP/URL + Configuration SMTP
- **Planificateur** : cron archivage (heure/minute configurable, voyant vert, prochain/dernier run)
- **Droits d'accès** : matrice permissions × rôles

### 🖼️ Logos & Interface
- **Nouveau logo NexusVault** : `logo.png` (bouclier) + `titre.png` (NEXUSVAULT) assemblés avec fond transparent, `logo-login.png` (480px) et `logo-nav.png` (28px)
- **Favicon** mis à jour avec le bouclier
- **Page login** centrée avec fond dégradé sombre/clair selon le thème

### 🔧 Backend & Infrastructure
- **Logger structuré** : `[YYYY-MM-DD HH:MM:SS] [LEVEL]` via `nowLocal()` (heure locale TZ), configurable par `LOG_LEVEL=debug|info|warn|error`
- **`CACHEBUST`** dans `docker-compose.yml` pour forcer le rebuild du cache Docker à chaque déploiement
- **`APP_URL`** transmis au conteneur backend via `docker-compose.yml`
- **Table `activity_entry_history`** : historique des modifications de notes
- **Table `password_reset_tokens`** : tokens de reset MDP (durée 10 min)
- **Table `audit_archives`** : archives mensuelles du journal d'audit
- **Champ `is_preview`** sur `activity_entries`

---

## Variables .env requises

| Variable | Obligatoire | Description |
|---|---|---|
| `ENCRYPTION_KEY` | ✅ | Clé AES-256, générer avec `openssl rand -hex 32` |
| `JWT_SECRET` | ✅ | Secret JWT, générer avec `openssl rand -hex 32` |
| `APP_PORT` | ✅ | Port d'accès web (défaut : 8080) |
| `TZ` | recommandé | Fuseau horaire (défaut : `Europe/Paris`) |
| `LOG_LEVEL` | optionnel | `debug\|info\|warn\|error` (défaut : `info`) |

> **SMTP et APP_URL** se configurent depuis l'interface Administration → Sécurité → Général.

---

## Compte par défaut
- Login : `admin` / MDP : `changeme` (changement forcé, 14 caractères minimum)
