import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LANGUAGES, initI18n, getLangFromStorage, saveLangToStorage, t as translate } from '../i18n/index.js';

const I18nCtx = createContext({});

export function I18nProvider({ children }) {
  const [lang, setLang]     = useState(getLangFromStorage());
  const [ready, setReady]   = useState(false);
  const [, setTick]         = useState(0); // force re-render

  const loadLang = useCallback(async (code) => {
    setReady(false);
    await initI18n(code);
    setReady(true);
    setTick(n => n + 1);
  }, []);

  useEffect(() => { loadLang(lang); }, [lang, loadLang]);

  function changeLang(code) {
    saveLangToStorage(code);
    setLang(code);
  }

  return (
    <I18nCtx.Provider value={{ lang, changeLang, ready, t: translate, LANGUAGES }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() { return useContext(I18nCtx); }
