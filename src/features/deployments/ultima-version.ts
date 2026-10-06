import { asRecord, display, type UnknownRecord } from '../../utils/records';

/** Una fila de «Última versión de cada algoritmo». */
export interface FilaUltimaVersion extends Record<string, unknown> {
  artifactCode: string;
  artifactName: string;
  /** La versión más reciente del algoritmo, sea cual sea su estado. */
  ultimaVersionId: string;
  ultimaVersion: string;
  ultimaEstado: string;
  /** Qué versión está activa en cada ambiente, en texto: «STAGING v2.0.0». Vacío si ninguna. */
  activa: string;
  /** Qué hacer con la última versión: lo que la persona tiene que leer para saber si le toca algo. */
  siguiente: string;
  /** La última versión está aprobada y todavía no está activa en ningún ambiente: se puede desplegar ya. */
  desplegable: boolean;
}

/** Estados en los que una versión puede promoverse a un ambiente. */
const DESPLEGABLES = new Set(['APPROVED']);
const ESPERANDO_FIRMAS = new Set(['IN_REVIEW', 'PENDING_APPROVAL', 'SUBMITTED']);

/**
 * Para cada algoritmo, su última versión y lo que está activo en cada ambiente.
 *
 * ## Por qué hacía falta
 *
 * La pantalla de despliegues era sólo un HISTORIAL: enseñaba lo que ya se había desplegado. Una
 * versión firmada por las dos personas y lista para salir no aparecía en ninguna tabla, así que al
 * filtrar por su algoritmo parecía que no existía (medido en TEST el 2026-10-06: el crédito v2.0.1 y
 * el riesgo v1.0.1 estaban APROBADOS y nadie encontraba cómo desplegarlos). La única entrada era el
 * selector de «Nuevo despliegue», que no se ve hasta que se abre.
 *
 * ## Qué es «última»
 *
 * La de mayor `versionNumber` del algoritmo — el número que el motor asigna al crear cada versión, que
 * no se reutiliza —. No la semántica: `2.0.1` y `2.1.0` pueden convivir con números que no ordenan
 * como texto.
 */
export function ultimaVersionPorAlgoritmo(
  versiones: readonly UnknownRecord[],
  despliegues: readonly UnknownRecord[],
): FilaUltimaVersion[] {
  // Lo activo por versión: un despliegue vivo es ACTIVE y además `isActive` (una ventana de vigencia
  // vencida lo deja ACTIVE pero ya no resuelve decisiones).
  const activoPorVersion = new Map<string, string[]>();
  for (const d of despliegues) {
    const vivo = display(d, 'deploymentStatus') === 'ACTIVE' && d.isActive !== false;
    if (!vivo) continue;
    const versionId = display(d, 'artifactVersionId');
    const ambiente = display(asRecord(d.environment), 'code');
    activoPorVersion.set(versionId, [...(activoPorVersion.get(versionId) ?? []), ambiente]);
  }

  const porAlgoritmo = new Map<string, UnknownRecord[]>();
  for (const v of versiones) {
    const code = display(v, 'artifactCode');
    if (code === '—') continue;
    porAlgoritmo.set(code, [...(porAlgoritmo.get(code) ?? []), v]);
  }

  const filas: FilaUltimaVersion[] = [];
  for (const [artifactCode, lista] of porAlgoritmo) {
    const ordenadas = [...lista].sort(
      (a, b) => Number(b.versionNumber ?? 0) - Number(a.versionNumber ?? 0),
    );
    const ultima = ordenadas[0]!;
    const ultimaVersionId = display(ultima, 'id');
    const ultimaEstado = display(ultima, 'status');
    const activas = ordenadas.flatMap((v) =>
      (activoPorVersion.get(display(v, 'id')) ?? []).map(
        (amb) => `${amb} v${display(v, 'semanticVersion')}`,
      ),
    );
    const ultimaActiva = (activoPorVersion.get(ultimaVersionId) ?? []).length > 0;
    const desplegable = DESPLEGABLES.has(ultimaEstado) && !ultimaActiva;
    filas.push({
      artifactCode,
      artifactName: display(ultima, 'artifactName'),
      ultimaVersionId,
      ultimaVersion: `v${display(ultima, 'semanticVersion')}`,
      ultimaEstado,
      activa: activas.length ? activas.join(' · ') : 'Ninguna',
      siguiente: siguientePaso(ultimaEstado, ultimaActiva),
      desplegable,
    });
  }
  // Primero lo que espera una acción: así lo pendiente no queda escondido al final de la tabla.
  return filas.sort(
    (a, b) =>
      Number(b.desplegable) - Number(a.desplegable) || a.artifactCode.localeCompare(b.artifactCode),
  );
}

function siguientePaso(estado: string, activa: boolean): string {
  if (activa) return 'Al día: la última versión ya está activa.';
  if (DESPLEGABLES.has(estado)) return 'Aprobada y sin desplegar: lista para desplegar.';
  if (ESPERANDO_FIRMAS.has(estado)) return 'Esperando las dos firmas en Gobierno → Revisiones.';
  if (estado.startsWith('DEPLOYED')) return 'Desplegada, pero no activa en ningún ambiente ahora.';
  return 'En preparación: todavía no se envió a revisión.';
}
