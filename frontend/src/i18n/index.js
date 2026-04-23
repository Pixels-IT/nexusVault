// ── NexusVault i18n ─────────────────────────────────────────────────────────
// Pour ajouter une langue :
//   1. Créer /src/i18n/locales/<code>.js (copier fr.js comme base)
//   2. L'ajouter dans LANGUAGES ci-dessous
//   3. Traduire les clés — les clés manquantes tombent automatiquement sur fr

export const LANGUAGES = [
  { code: 'fr', label: 'Français',           flag: '🇫🇷' },
  { code: 'en', label: 'English',             flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',             flag: '🇩🇪' },
  { code: 'es', label: 'Español',             flag: '🇪🇸' },
  { code: 'it', label: 'Italiano',            flag: '🇮🇹' },
  { code: 'pt', label: 'Português (Europeu)', flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands',          flag: '🇳🇱' },
  { code: 'pl', label: 'Polski',              flag: '🇵🇱' },
  { code: 'ru', label: 'Русский',             flag: '🇷🇺' },
  { code: 'ja', label: '日本語',               flag: '🇯🇵' },
  { code: 'zh', label: '中文',                 flag: '🇨🇳' },
];

// Chargement dynamique des traductions
const cache = {};

async function loadLocale(code) {
  if (cache[code]) return cache[code];
  try {
    const mod = await import(`./locales/${code}.js`);
    cache[code] = mod.default;
    return cache[code];
  } catch {
    // Fallback sur fr
    if (code !== 'fr') return loadLocale('fr');
    return {};
  }
}

// Langue courante (réactive via Context)
let currentTranslations = {};

export async function initI18n(code) {
  const fr = await loadLocale('fr');
  if (code === 'fr') {
    currentTranslations = fr;
  } else {
    const lang = await loadLocale(code);
    // Merge : les clés manquantes utilisent le français
    currentTranslations = { ...fr, ...lang };
  }
  return currentTranslations;
}

export function t(key, vars = {}) {
  let str = currentTranslations[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return str;
}

export function getLangFromStorage() {
  return localStorage.getItem('nv_lang') || navigator.language?.slice(0, 2) || 'fr';
}

export function saveLangToStorage(code) {
  localStorage.setItem('nv_lang', code);
}
