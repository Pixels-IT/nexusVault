import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
const WARN_BEFORE_MS  = 60 * 1000;
const LAST_ACTIVE_KEY = 'dp_last_active';

export function useSessionTimeout({ onWarn, onExpire }) {
  const { user, logout } = useAuth();
  const timerRef      = useRef(null);
  const warnRef       = useRef(null);
  const timeoutMsRef  = useRef(30 * 60 * 1000);
  const loadedRef     = useRef(false);
  const onWarnRef     = useRef(onWarn);
  const onExpireRef   = useRef(onExpire);
  const logoutRef     = useRef(logout);

  useEffect(() => { onWarnRef.current  = onWarn;  }, [onWarn]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { logoutRef.current  = logout;   }, [logout]);

  const doExpire = useCallback(() => {
    // Ne déconnecter que si l'utilisateur est encore connecté
    if (!logoutRef.current) return;
    localStorage.removeItem(LAST_ACTIVE_KEY);
    onExpireRef.current?.();
    logoutRef.current?.('timeout'); // passer la source pour l'audit
  }, []);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    // Mémoriser le moment de la dernière activité pour détecter les retours
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));

    const ms = timeoutMsRef.current;
    if (ms > WARN_BEFORE_MS) {
      warnRef.current = setTimeout(() => {
        onWarnRef.current?.(Math.round(WARN_BEFORE_MS / 1000));
      }, ms - WARN_BEFORE_MS);
    }
    timerRef.current = setTimeout(doExpire, ms);
  }, [doExpire]);

  // Au chargement : vérifier si le timeout a expiré pendant l'absence
  useEffect(() => {
    if (!user || loadedRef.current) return;
    loadedRef.current = true;

    api.getPublicSettings()
      .then(s => {
        const minutes = Math.max(1, parseInt(s.session_timeout_minutes) || 30);
        timeoutMsRef.current = minutes * 60 * 1000;

        // Vérifier la dernière activité stockée
        const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
        const elapsed = Date.now() - lastActive;
        const loginTime = parseInt(localStorage.getItem('dp_login_time') || '0');
        const justLoggedIn = (Date.now() - loginTime) < 10000; // connecté depuis < 10s

        if (!justLoggedIn && lastActive > 0 && elapsed > timeoutMsRef.current) {
          // Le timeout a expiré pendant que le navigateur était fermé
          console.log(`[Session] Expiré depuis ${Math.round(elapsed/1000)}s — déconnexion`);
          doExpire();
        } else {
          // Nouvelle connexion ou session valide : réinitialiser le timer
          localStorage.removeItem(LAST_ACTIVE_KEY);
          reset();
        }
      })
      .catch(() => reset());
  }, [user, reset, doExpire]);

  // Listeners d'activité
  useEffect(() => {
    if (!user) {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      loadedRef.current = false;
      return;
    }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    // Vérification au retour sur l'onglet (visibilitychange)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
        if (lastActive > 0 && Date.now() - lastActive > timeoutMsRef.current) {
          doExpire();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, reset, doExpire]);
}
