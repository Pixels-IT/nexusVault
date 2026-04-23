# NexusVault — Internationalisation (i18n)

## Ajouter une nouvelle langue

1. **Copier** `fr.js` vers `<code>.js` (ex: `bg.js` pour le bulgare)
2. **Traduire** les valeurs (les clés restent en anglais)
3. **Ajouter** la langue dans `/src/i18n/index.js` dans le tableau `LANGUAGES` :
   ```js
   { code: 'bg', label: 'Български', flag: '🇧🇬' },
   ```
4. Rebuilder l'application

## Structure d'une traduction

```js
// bg.js
export default {
  'nav.dashboard': 'Табло',
  'auth.login': 'Вход',
  // ... autres clés
};
```

## Clés manquantes

Si une clé n'est pas traduite dans votre langue, le texte **français** (`fr.js`) est utilisé automatiquement comme fallback.

## Liste des codes langue supportés

| Code | Langue | Fichier |
|------|--------|---------|
| fr | Français (référence) | fr.js |
| en | English | en.js |
| de | Deutsch | de.js |
| es | Español | es.js |
| it | Italiano | it.js |
| pt | Português | pt.js |
| nl | Nederlands | nl.js |
| pl | Polski | pl.js |
| ru | Русский | ru.js |
| ja | 日本語 | ja.js |
| zh | 中文 | zh.js |

## Contribuer

Toutes les traductions partielles sont les bienvenues !  
Les clés manquantes tombent automatiquement sur le français.
