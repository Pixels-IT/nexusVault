# NexusVault — Changelog

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
