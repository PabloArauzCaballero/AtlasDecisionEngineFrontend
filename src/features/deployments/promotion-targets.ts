import { isProductionEnvironment, type PromotionTarget } from '../../auth/business-rules';

export interface EnvironmentOption extends PromotionTarget {
  name: string;
  status: string;
}

export interface PromotionTargets {
  /** Ambientes a los que este usuario sí puede promover. */
  allowed: EnvironmentOption[];
  /** Ambientes productivos que se le ocultan por no ser administrador. */
  withheldProduction: EnvironmentOption[];
}

/**
 * Reparte los ambientes entre los que el usuario puede elegir y los que no.
 *
 * Se separa de la vista para poder probar la regla sin montar el formulario, y
 * porque es la traducción literal del encargo: «mergear a dev» lo hace quien
 * propone el cambio, «mergear a main» sólo un administrador.
 *
 * Los ambientes inactivos no se ofrecen a nadie: promover a un ambiente apagado
 * no es una decisión de permisos, es un despliegue que va a fallar.
 */
export function splitPromotionTargets(
  environments: readonly EnvironmentOption[],
  canPromoteToProduction: boolean,
): PromotionTargets {
  const active = environments.filter(
    (environment) => environment.status.trim().toUpperCase() === 'ACTIVE',
  );
  const production = active.filter((environment) => isProductionEnvironment(environment));
  const rest = active.filter((environment) => !isProductionEnvironment(environment));

  return canPromoteToProduction
    ? { allowed: [...rest, ...production], withheldProduction: [] }
    : { allowed: rest, withheldProduction: production };
}
