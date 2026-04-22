# VaultNexus — Changelog

## v2026-04-22_b3.8
> Build 3 du 22 avril 2026 — 8 requêtes cumulées

### Corrections
- **Journal d'audit — heure TZ** : la fonction `audit()` passe désormais `created_at` explicitement depuis Node.js (`new Date()` local) au lieu de laisser SQLite évaluer `datetime('now','localtime')` (qui ignorait la variable `TZ` du conteneur).
- **Suivi d'activité — dépliage conditionnel sur filtre** : les années et mois ne se déplient plus automatiquement si aucune note ne correspond au filtre. Seuls les niveaux ayant au moins une correspondance s'ouvrent.
- **Numérotation de build** : système de versionnage `vJJ-MM-AAAA_bB.R` mis en place. Le fichier `.build_meta` maintient l'état entre les sessions.

---

## v2026-04-22_b2.6
> Build 2 du 22 avril 2026 — 6 requêtes cumulées

### Nouvelles fonctionnalités
- **Suivi d'activité** : nouvelle page `/activity` accessible depuis la navbar ("Suivi"), entre Backups et Administration.
  - Organisation par année (décroissant) → mois (janvier à décembre), chargement lazy par mois
  - Tags colorés personnalisables (SECU, INFRA, NETWORK, FW, MAIL, BACKUP, TEL, AV, ADM par défaut)
  - Compteur de notes par année et par mois
  - Filtre par tag avec dépliage automatique conditionnel
  - L'admin peut consulter le suivi de tous les utilisateurs via un sélecteur
  - Seul le propriétaire peut créer, modifier ou supprimer ses propres notes
- **Droits d'accès — section Suivi** : 3 nouvelles permissions (`activity_read`, `activity_write`, `activity_tags`)
- **Administration → Suivi d'activité** : gestion des tags (code, libellé, couleur) avec palette prédéfinie
- **Menu Administration** réorganisé avec séparateurs visuels

### Corrections
- **Timeout de session — navigateur fermé** : `dp_last_active` dans `localStorage`, vérification au retour sur l'application via `visibilitychange`
- **Droits suivi** : backend restreint DELETE et PUT au propriétaire uniquement

---

## v2026-04-22_b1.2
> Build 1 du 22 avril 2026 — 2 requêtes cumulées

### Nouvelles fonctionnalités
- **Bouton Comparer** : style cohérent avec Importer/Sauvegarde, en bleu
- **Suivi d'activité** : première implémentation (tables, endpoints, page, navbar)

---

## v2026-04-21 (builds antérieurs)

### Nouvelles fonctionnalités
- Vue hiérarchique Backups (Sites → Équipements → Versions), lazy loading, drag & drop des sites
- Épinglage de versions, boutons Sauvegarde (orange) et Importer (vert)
- Appareils déplacé dans Administration, onglet embedded avec tabs horizontaux
- Champ Type via datalist dans les Modèles
- Icônes par type d'équipement dans Backups
- Filtre par type d'équipement avec dépliage automatique
- Droits d'accès par rôle (matrice permissions × rôles dans Sécurité)
- Hook `usePerms` appliqué sur tous les boutons et onglets sensibles
- Footer bar avec version, licence AGPL-3.0
- Timeout de session configurable, alerte 60s avant expiration
- Fuseau horaire via `TZ=Europe/Paris` dans docker-compose, `nowLocal()` Node.js
- Duplication d'équipement avec unicité nom (insensible à la casse) et IP
- Autocomplétion dans le modal backup SSH

### Corrections
- Multiples corrections d'apostrophes dans les strings JavaScript
- `ConfigEmbedded` séparé de `Config` pour éviter les conflits `useSearchParams`
- Import `usePerms` manquant dans `Config.jsx` (écran blanc sur l'onglet Appareils)
- `nowLocal()` Node.js pour toutes les dates dynamiques

---

## Données de démonstration
- Sites : Paris HQ, Lyon DC
- Modèles : Cisco Catalyst 9300 (Switch), HP Aruba 2930F (Switch), Fortinet FortiGate 90G (Pare-Feu)
- Équipements : sw-paris-core-01 (10.0.1.1), sw-lyon-access-02 (10.1.1.2), FW-XH (10.10.10.1)
- Tags : SECU, INFRA, NETWORK, FW, MAIL, BACKUP, TEL, AV, ADM

## Compte par défaut
- Login : `admin` / MDP : `changeme` (changement forcé, 14 caractères minimum)
