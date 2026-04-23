import { createContext, useContext, useState, useEffect } from 'react';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dp_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) setUser(payload);
        else localStorage.removeItem('dp_token');
      } catch { localStorage.removeItem('dp_token'); }
    }
    setLoading(false);
  }, []);

  const login = (token) => {
    localStorage.setItem('dp_token', token);
    const payload = JSON.parse(atob(token.split('.')[1]));
    setUser(payload);
    return payload;
  };

  const logout = () => {
    localStorage.removeItem('dp_token');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout, loading }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
