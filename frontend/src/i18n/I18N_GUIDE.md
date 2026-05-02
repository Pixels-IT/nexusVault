# NexusVault — Guide i18n (Internationalisation)

## Process obligatoire pour tout nouveau développement

### Règle : tout texte visible par l'utilisateur doit passer par `t()`

```jsx
// ❌ Ne pas faire
<button>Enregistrer</button>

// ✅ À faire
<button>{t('common.save')}</button>
```

### Ajouter une nouvelle clé

1. **Ajouter dans `fr.js`** (fichier de référence) :
```js
'ma.nouvelle.cle': 'Mon texte en français',
```

2. **Ajouter dans `en.js`** (minimum requis) :
```js
'ma.nouvelle.cle': 'My text in English',
```

3. **Les autres langues** : ajouter si possible, sinon le fallback sur `fr.js` s'applique automatiquement.

4. **Utiliser dans le composant** :
```jsx
import { useI18n } from '../contexts/I18nContext.jsx';
// Dans le composant :
const { t } = useI18n();
// Dans le JSX :
{t('ma.nouvelle.cle')}
// Avec variables :
{t('common.welcome', { name: user.username })}
```

### Convention de nommage des clés

| Préfixe | Usage |
|---------|-------|
| `nav.*` | Navigation (navbar) |
| `auth.*` | Authentification (login, reset MDP) |
| `dash.*` | Tableau de bord |
| `backup.*` | Page Backups |
| `activity.*` | Suivi d'activité |
| `admin.*` | Administration |
| `scripts.*` | Scripts |
| `common.*` | Éléments communs (boutons, messages) |
| `perm.*` | Libellés de permissions |
| `notif.*` | Notifications |

### État de couverture actuel (b49)

| Page | Couverture |
|------|-----------|
| Navbar | ✅ Complet |
| Dashboard | ✅ Complet |
| Login / ResetPassword | ✅ Clés principales |
| Admin | 🔲 En cours |
| Activity | 🔲 Partiel |
| Backups | 🔲 À faire |
| Config | 🔲 À faire |
| Scripts | 🔲 À faire |

### Ajouter une nouvelle langue

1. Copier `fr.js` → `<code>.js` (ex: `bg.js`)
2. Traduire les valeurs
3. Ajouter dans `LANGUAGES` dans `src/i18n/index.js` :
```js
{ code: 'bg', label: 'Български', flag: '🇧🇬' },
```
4. Ajouter le drapeau SVG dans `src/i18n/flags.js`
