'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchEngineDatasets } from './engine-datasets';
import { fetchNotebookCatalog } from './notebook.api';
import { unirDescartadas } from './omitted-datasets';

/**
 * De dónde salen los datasets del cuaderno: dos servicios, dos consultas, ninguna lista.
 *
 * Ninguno de los dos catálogos está escrito en este repositorio. AtlasBackend descubre sus vistas
 * de `read_api` contra `information_schema` y el motor las suyas contra `pg_catalog`, así que una
 * vista publicada mañana llega hasta el selector sin que nadie toque código en ninguna de las tres
 * partes. Lo único que decide este archivo es en qué orden se ofrecen y qué pasa cuando una mitad
 * no contesta.
 *
 * Van en consultas SEPARADAS y el fallo del motor no tumba el del backend: son dos servicios
 * independientes, y que el motor no conteste —o que quien mira no tenga permiso de consola SQL— no
 * puede dejar en blanco los datasets de AtlasBackend, que sí están ahí. Cada mitad aparece cuando
 * puede, y la que falte se dice en la pantalla en vez de desaparecer sin más.
 */
export function useNotebookSources() {
  const catalogo = useQuery({
    queryKey: ['data-notebook', 'catalog'],
    queryFn: ({ signal }) => fetchNotebookCatalog(signal),
  });

  const catalogoMotor = useQuery({
    queryKey: ['data-notebook', 'catalog', 'motor'],
    queryFn: ({ signal }) => fetchEngineDatasets(signal),
    // Sin reintentos: un 403 de consola SQL no mejora insistiendo, y mientras insiste la pantalla
    // no puede decir todavía que falta esa mitad.
    retry: false,
  });

  const datasets = useMemo(
    () => [...(catalogo.data?.datasets ?? []), ...(catalogoMotor.data?.datasets ?? [])],
    [catalogo.data, catalogoMotor.data],
  );

  const descartadas = useMemo(
    () => unirDescartadas(catalogo.data, catalogoMotor.data),
    [catalogo.data, catalogoMotor.data],
  );

  return { catalogo, catalogoMotor, datasets, descartadas };
}
