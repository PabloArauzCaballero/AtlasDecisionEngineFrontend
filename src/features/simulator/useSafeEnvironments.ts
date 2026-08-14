'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { z } from 'zod';
import { apiRequest } from '../../api/http-client';
import { environmentsSchema } from '../../testing/testing.schemas';

/** El tipo sale del esquema: una única fuente para la forma del ambiente. */
type Environment = z.infer<typeof environmentsSchema>[number];

/** Referencia estable para el caso vacío: evita re-render por identidad nueva. */
const NONE: Environment[] = [];

/**
 * Ambientes donde se puede lanzar una ejecución de prueba.
 *
 * Salen del motor (`/v1/environments`), nunca de una lista escrita a mano: qué
 * ambientes existen es una decisión del despliegue, y una lista fija se queda
 * desfasada en silencio —ofreciendo uno que ya no existe, u ocultando el que el
 * equipo acaba de crear—.
 *
 * Se descartan producción y los ambientes inactivos: estas vistas son ensayos
 * sin persistencia y no deben poder apuntar a donde se atiende a clientes.
 *
 * El código seleccionado se corrige solo cuando no está en la lista real, así
 * que la vista arranca sin ninguno elegido y no inventa un `DEV` que quizá no
 * exista.
 */
export function useSafeEnvironments(selected: string, onSelect: (code: string) => void) {
  const query = useQuery({
    queryKey: ['safe-environments'],
    queryFn: ({ signal }) =>
      apiRequest('/v1/environments', { signal, responseSchema: environmentsSchema }),
    select: (items) =>
      items.filter(
        (environment) =>
          environment.status === 'ACTIVE' &&
          !environment.isProduction &&
          environment.code.toUpperCase() !== 'PROD',
      ),
  });
  const environments = query.data ?? NONE;

  useEffect(() => {
    if (!environments.length) return;
    if (environments.some((environment) => environment.code === selected)) return;
    onSelect(environments[0].code);
    // `onSelect` es un setState del padre y cambia de identidad en cada render;
    // incluirlo reiniciaría la selección del usuario en cada pintado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environments, selected]);

  return {
    environments,
    isPending: query.isPending,
    isError: query.isError,
    /** No hay ningún ambiente donde ensayar: la vista no puede ejecutar nada. */
    isEmpty: !query.isPending && !query.isError && environments.length === 0,
  };
}
