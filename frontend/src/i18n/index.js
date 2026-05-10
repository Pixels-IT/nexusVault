// ── NexusVault i18n ─────────────────────────────────────────────────────────
// Langue par défaut : anglais (en)
// Fallback : si une clé manque dans la langue sélectionnée → anglais

export const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'pt', label: 'Português',  flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
];

// Import statique synchrone — t() fonctionne dès le premier rendu
import enTranslations from './locales/en.js';

const cache = { en: enTranslations };
let currentTranslations = enTranslations; // initialisation immédiate

async function loadLocale(code) {
  if (cache[code]) return cache[code];
  try {
    const mod = await import(`./locales/${code}.js`);
    cache[code] = mod.default;
    return cache[code];
  } catch {
    if (code !== 'en') return loadLocale('en');
    return enTranslations;
  }
}

export async function initI18n(code) {
  if (code === 'en') {
    currentTranslations = enTranslations;
  } else {
    const lang = await loadLocale(code);
    currentTranslations = { ...enTranslations, ...lang };
  }
  return currentTranslations;
}

export function t(key, vars = {}) {
  let str = currentTranslations[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return str;
}

export function getLangFromStorage() {
  return localStorage.getItem('nv_lang') || 'en';
}

export function saveLangToStorage(code) {
  localStorage.setItem('nv_lang', code);
}
