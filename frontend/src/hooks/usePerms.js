import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

const DEFAULT_ROLE_PERMS = {
  admin:    { backup_read: true,  backup_import: true,  backup_write: true,  config_read: true,  config_write: true,  audit_access: true,  security_access: true,  activity_read: true,  activity_write: true,  activity_tags: true,  audit_archive: true  },
  operator: { backup_read: true,  backup_import: false, backup_write: true,  config_read: true,  config_write: false, audit_access: false, security_access: false, activity_read: true,  activity_write: true,  activity_tags: false, audit_archive: false },
  viewer:   { backup_read: true,  backup_import: false, backup_write: false, config_read: true,  config_write: false, audit_access: false, security_access: false, activity_read: true,  activity_write: false, activity_tags: false, audit_archive: false },
};

let cachedRolePerms = null;

export function usePerms() {
  const { user } = useAuth();
  const [rolePerms, setRolePerms] = useState(cachedRolePerms || DEFAULT_ROLE_PERMS);

  useEffect(() => {
    if (cachedRolePerms) return;
    fetch('/api/role-permissions/public')
      .then(r => r.json())
      .then(data => { cachedRolePerms = data; setRolePerms(data); })
      .catch(() => {});
  }, []);

  const can = useCallback((perm) => {
    if (!user) return false;
    // Admin a toujours tout
    if (user.role === 'admin') return true;
    // Lire les droits du rôle
    const permsForRole = rolePerms[user.role] || {};
    return !!permsForRole[perm];
  }, [user, rolePerms]);

  return { can };
}

// Invalider le cache (appelé quand les droits sont modifiés)
export function invalidatePermsCache() {
  cachedRolePerms = null;
}
