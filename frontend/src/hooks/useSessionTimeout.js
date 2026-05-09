import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
const WARN_BEFORE_MS  = 60 * 1000;  // 60s avant expiration
const LAST_ACTIVE_KEY = 'dp_last_active';

export function useSessionTimeout({ onWarn, onExpire }) {
  const { user, logout } = useAuth();

  const warnRef          = useRef(null);
  const timeoutMsRef     = useRef(30 * 60 * 1000);
  const onWarnRef        = useRef(onWarn);
  const logoutRef        = useRef(logout);
  const userRef          = useRef(user);
  const initializedRef   = useRef(false);
  const warningActiveRef = useRef(false);

  onWarnRef.current = onWarn;
  logoutRef.current = logout;
  userRef.current   = user;

  useEffect(() => {
    function doExpire() {
      clearTimeout(warnRef.current);
      warningActiveRef.current = false;
      localStorage.removeItem(LAST_ACTIVE_KEY);
      logoutRef.current?.('timeout');
    }

    function scheduleTimers() {
      if (warningActiveRef.current) return;
      clearTimeout(warnRef.current);
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      const ms = timeoutMsRef.current;
      const warnDelay = Math.max(0, ms - WARN_BEFORE_MS);
      warnRef.current = setTimeout(() => {
        warningActiveRef.current = true;
        // Passer exactement WARN_BEFORE_MS secondes au composant — il gère l'expiration
        onWarnRef.current?.(Math.round(WARN_BEFORE_MS / 1000));
      }, warnDelay);
    }

    function dismissWarning() {
      warningActiveRef.current = false;
      scheduleTimers();
    }

    window.__sessionTimeoutDismiss = dismissWarning;

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
          const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
          const loginTime  = parseInt(localStorage.getItem('dp_login_time')  || '0');
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
      warningActiveRef.current = false;
      clearTimeout(warnRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      localStorage.removeItem(LAST_ACTIVE_KEY);
      delete window.__sessionTimeoutDismiss;
    }

    if (user) { init(); } else { teardown(); }
    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
}
