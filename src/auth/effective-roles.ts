import type { IdentityUser } from './auth.types';

/**
 * El permiso de una sesión son SUS DOS listas de roles, siempre.
 *
 * El proveedor de identidad emite `roles` y `legacyRoles` por separado, y una
 * cuenta antigua puede tener en la segunda toda su autorización. Sumarlas era
 * algo que hacían tres sitios —el guardia de ruta, el menú lateral y el centro
 * de tutoriales— y NO hacía ninguna de las comprobaciones de capacidad de
 * dentro de las vistas, que leían `user.roles` a secas.
 *
 * El efecto era una contradicción silenciosa: quien entraba por un rol heredado
 * pasaba el guardia, veía la entrada en el menú, abría la vista… y se encontraba
 * todos los botones apagados, sin ningún mensaje que lo explicase. Sólo le
 * pasaba a las cuentas viejas, que es donde nadie mira.
 *
 * Que viva aquí y no dentro de `useAuth` es a propósito: las reglas de negocio
 * (`business-rules.ts`, `decision-policy.ts`) reciben listas de roles, no
 * componentes, y tienen que poder normalizar sin depender de React.
 */
export function effectiveRoles(user: Pick<IdentityUser, 'roles' | 'legacyRoles'> | null): string[] {
  if (!user) return [];
  return [...(user.roles ?? []), ...(user.legacyRoles ?? [])];
}
