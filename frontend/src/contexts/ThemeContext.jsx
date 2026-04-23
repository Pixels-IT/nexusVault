import { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext(null);

// Clé localStorage
const STORAGE_KEY = 'dp_theme';

// Par défaut : mode sombre si jamais rien n'a été sauvegardé
function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light') return false;
  // 'dark', null, ou toute autre valeur → sombre par défaut
  return true;
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() { return useContext(ThemeCtx); }
