import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
const WARN_BEFORE_MS  = 60 * 1000;
const LAST_ACTIVE_KEY = 'dp_last_active';

export function useSessionTimeout({ onWarn, onExpire }) {
  const { user, logout } = useAuth();

  // Toutes les valeurs dynamiques passent par des refs → jamais de dépendances instables
  const timerRef     = useRef(null);
  const warnRef      = useRef(null);
  const timeoutMsRef = useRef(30 * 60 * 1000);
  const onWarnRef    = useRef(onWarn);
  const onExpireRef  = useRef(onExpire);
  const logoutRef    = useRef(logout);
  const userRef      = useRef(user);
  const initializedRef = useRef(false);

  // Mettre à jour les refs quand les valeurs changent — sans déclencher d'effets
  onWarnRef.current  = onWarn;
  onExpireRef.current = onExpire;
  logoutRef.current  = logout;
  userRef.current    = user;

  // Effet unique monté une seule fois — gère tout le cycle de vie
  useEffect(() => {
    function doExpire() {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      localStorage.removeItem(LAST_ACTIVE_KEY);
      onExpireRef.current?.();
      logoutRef.current?.('timeout');
    }

    function scheduleTimers() {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      const ms = timeoutMsRef.current;
      if (ms > WARN_BEFORE_MS) {
        warnRef.current = setTimeout(() => {
          onWarnRef.current?.(Math.round(WARN_BEFORE_MS / 1000));
        }, ms - WARN_BEFORE_MS);
      }
      timerRef.current = setTimeout(doExpire, ms);
    }

    function onActivity() {
      if (!userRef.current) return;
      scheduleTimers();
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
      if (lastActive > 0 && Date.now() - lastActive > timeoutMsRef.current) {
        doExpire();
      }
    }

    function init() {
      if (initializedRef.current) return;
      initializedRef.current = true;

      api.getPublicSettings()
        .then(s => {
          const minutes = Math.max(1, parseInt(s.session_timeout_minutes) || 30);
          timeoutMsRef.current = minutes * 60 * 1000;

          const lastActive  = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
          const loginTime   = parseInt(localStorage.getItem('dp_login_time')  || '0');
          const justLoggedIn = (Date.now() - loginTime) < 10000;

          if (!justLoggedIn && lastActive > 0 && (Date.now() - lastActive) > timeoutMsRef.current) {
            doExpire();
          } else {
            localStorage.removeItem(LAST_ACTIVE_KEY);
            scheduleTimers();
          }
        })
        .catch(() => scheduleTimers());

      ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
      document.addEventListener('visibilitychange', onVisible);
    }

    function teardown() {
      initializedRef.current = false;
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }

    if (user) {
      init();
    } else {
      teardown();
    }

    return teardown;
  // user est la seule vraie dépendance : init au login, teardown au logout
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
}
