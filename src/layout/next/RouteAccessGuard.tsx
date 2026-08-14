'use client';

import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { requiredRolesForPath } from '../../auth/route-access';
import { hasAnyRole } from '../../auth/roles';
import { useEffectiveRoles } from '../../auth/useAuth';
import { ForbiddenRoute } from './ForbiddenRoute';

/**
 * Applies client-side route visibility rules after session bootstrap.
 *
 * This guard improves UX but never replaces backend authorization. Every API
 * operation must still be validated by the Decision Engine.
 */
export function RouteAccessGuard({ children }: PropsWithChildren) {
  const pathname = usePathname() ?? '';

  const requiredRoles = requiredRolesForPath(pathname);
  const roles = useEffectiveRoles();

  if (requiredRoles === null) {
    return <ForbiddenRoute routeRegistered={false} />;
  }

  if (!hasAnyRole(roles, requiredRoles)) {
    return <ForbiddenRoute routeRegistered />;
  }

  return children;
}
