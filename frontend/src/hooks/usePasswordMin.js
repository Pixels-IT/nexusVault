import { useState, useEffect } from 'react';

// Cache partagé pour éviter de multiples appels
let _cache = null;
let _listeners = [];

function notify() { _listeners.forEach(fn => fn(_cache)); }

async function fetchMin() {
  try {
    const r = await fetch('/api/settings/public');
    const d = await r.json();
    _cache = d.password_min_length || 14;
  } catch { _cache = 14; }
  notify();
}

export function usePasswordMin() {
  const [min, setMin] = useState(_cache || 14);
  useEffect(() => {
    _listeners.push(setMin);
    if (_cache === null) fetchMin();
    else setMin(_cache);
    return () => { _listeners = _listeners.filter(fn => fn !== setMin); };
  }, []);
  return min;
}

// Appelé après modification des settings pour invalider le cache
export function invalidatePasswordMin() {
  _cache = null;
  fetchMin();
}
