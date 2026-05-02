import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api.js';

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
    localStorage.setItem('dp_login_time', String(Date.now())); // pour useSessionTimeout
    const payload = JSON.parse(atob(token.split('.')[1]));
    setUser(payload);
    return payload;
  };

  const logout = (source = 'manual') => {
    // Capturer le token AVANT de le supprimer (authMiddleware en a besoin)
    const token = localStorage.getItem('dp_token');
    if (token) {
      // keepalive:true garantit que la requête part même si la page se décharge
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ source }),
        keepalive: true,
      }).catch(() => {});
    }
    localStorage.removeItem('dp_token');
    localStorage.removeItem('dp_login_time');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout, loading }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
