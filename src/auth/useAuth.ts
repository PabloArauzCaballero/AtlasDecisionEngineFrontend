import { useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { effectiveRoles } from './effective-roles';

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return value;
}

/**
 * Los roles con los que se decide QUÉ PUEDE HACER quien está dentro.
 *
 * Úsalo siempre en lugar de `user.roles`: ése es sólo la mitad del permiso —el
 * proveedor de identidad emite además `legacyRoles`, y una cuenta antigua puede
 * tener ahí toda su autorización—. `verify-conventions.mjs` rechaza el acceso
 * directo a `user.roles` fuera de este módulo justamente para que no vuelva a
 * separarse.
 */
export function useEffectiveRoles(): string[] {
  const { user } = useAuth();
  return useMemo(() => effectiveRoles(user), [user]);
}
