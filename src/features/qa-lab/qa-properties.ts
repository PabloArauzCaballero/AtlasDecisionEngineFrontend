import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord } from '../../utils/records';

/**
 * El catálogo de propiedades que QA Lab comprueba, traído DEL MOTOR.
 *
 * Estaba fijado en cliente, y la exención lo decía: «una propiedad nueva del motor no aparece
 * sola». Ése es el mismo fallo que el gate de superficie existe para detectar, sólo que una
 * capa más adentro: el motor puede ganar una comprobación —y por tanto empezar a encontrar una
 * clase entera de defectos— y el portal seguir enseñando la lista de antes, con el nombre crudo
 * del backend donde debería ir una explicación.
 *
 * El mapa local NO desaparece: se convierte en respaldo. Un catálogo remoto que no responde no
 * puede dejar la pantalla llena de `OUTPUT_TYPES_MATCH_CONTRACT`, porque entonces la caída del
 * catálogo se lee como un defecto del artefacto que se estaba revisando.
 */
export interface PropiedadQa {
  readonly code: string;
  readonly label: string;
  readonly description?: string;
}

/**
 * Respaldo local. Es la lista que estaba fijada en `QaCounterexampleList`, con el mismo texto.
 *
 * Se conserva a propósito y no como duplicado accidental: es lo que se enseña mientras el
 * catálogo viaja, y lo que queda si el motor no lo publica en este despliegue.
 */
export const PROPIEDADES_DE_RESPALDO: Record<string, string> = {
  INPUT_CONTRACT_ENFORCED: 'El contrato de entrada se impone',
  OUTPUT_CONTRACT_RESPECTED: 'La salida cumple el contrato',
  OUTPUT_TYPES_MATCH_CONTRACT: 'Los tipos de salida coinciden',
  NO_INTERMEDIATE_LEAK: 'Ninguna intermedia se filtra',
  NO_SENSITIVE_LEAK: 'Ningún dato sensible se filtra',
  DETERMINISM: 'La misma entrada da el mismo resultado',
};

/** Normaliza la respuesta del motor, que publica `{ items: [...] }` con forma abierta. */
export function leerPropiedades(payload: unknown): PropiedadQa[] {
  const items = asRecord(payload).items;
  if (!Array.isArray(items)) return [];
  const propiedades: PropiedadQa[] = [];
  for (const item of items) {
    const fila = asRecord(item);
    const code = String(fila.code ?? fila.property ?? fila.name ?? '');
    // Una fila sin código no se puede casar con nada: se descarta en silencio en vez de
    // publicar una etiqueta huérfana que no corresponde a ninguna propiedad.
    if (!code) continue;
    propiedades.push({
      code,
      // El motor puede publicar su propia etiqueta; si no, se usa la traducción local, y sólo
      // si tampoco la hay se cae al código crudo. Nunca se enseña `undefined`.
      label: String(fila.label ?? fila.title ?? PROPIEDADES_DE_RESPALDO[code] ?? code),
      ...(fila.description ? { description: String(fila.description) } : {}),
    });
  }
  return propiedades;
}

/**
 * Etiquetas por código, con el respaldo ya fusionado.
 *
 * El orden importa: lo remoto pisa a lo local. Si el motor renombra una propiedad, manda él —es
 * quien la comprueba— y el portal deja de contradecirle.
 */
export function useQaPropertyLabels(): Record<string, string> {
  const query = useQuery({
    queryKey: ['qa-lab-properties'],
    queryFn: ({ signal }) => apiRequest<unknown>('/v1/qa-lab/properties', { signal }),
    staleTime: 10 * 60 * 1000,
    // Sin reintentos: un catálogo de etiquetas no merece castigar al motor, y el respaldo
    // cubre el caso. Que falle es una degradación cosmética, no una vista rota.
    retry: false,
  });

  const remotas: Record<string, string> = {};
  for (const propiedad of leerPropiedades(query.data)) remotas[propiedad.code] = propiedad.label;
  return { ...PROPIEDADES_DE_RESPALDO, ...remotas };
}
