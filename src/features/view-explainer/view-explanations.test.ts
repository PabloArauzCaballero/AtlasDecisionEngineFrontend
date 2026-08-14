import { describe, expect, it } from 'vitest';
import { navigation } from '../../navigation/navigation';
import { resolveExplanation } from './view-explanations';
import { viewExamples } from './view-examples';

/**
 * El explicador falta en SILENCIO.
 *
 * `ViewExplainer` se monta en el armazón y devuelve `null` cuando la ruta no tiene entrada,
 * así que una pantalla sin explicación no da error, ni hueco, ni aviso: simplemente se abre
 * sin decir qué pregunta contesta. Cuatro de las seis pantallas de «Auditoría»
 * —calidad de la decisión, monitoreo del modelo, gobierno del riesgo y derechos del
 * titular— llevaban así desde que se entregaron, y en las dos que sí lo tenían el panel se
 * veía perfectamente, con lo que la ausencia parecía una decisión.
 *
 * La lista sale del MENÚ y no de un inventario a mano: si mañana se añade una entrada a la
 * sección, hereda la exigencia sin que nadie se acuerde de venir aquí.
 */
const auditItems = navigation.find((section) => section.label === 'Auditoría')?.items ?? [];

/** `/audit-events` → `audit-events`: el explicador resuelve por el primer segmento. */
const sectionKey = (path: string) => path.split('/').filter(Boolean)[0] ?? '';

describe('explicador de las pantallas de Auditoría', () => {
  it('el menú de Auditoría no está vacío', () => {
    // Si el rótulo de la sección cambia, este archivo dejaría de comprobar nada y las
    // demás pruebas pasarían por vacuidad.
    expect(auditItems.length).toBeGreaterThan(0);
  });

  it('cada pantalla explica qué es, en negocio y en sistemas', () => {
    const missing = auditItems
      .filter((item) => !resolveExplanation(item.path))
      .map((item) => `${item.label} → ${item.path}`);

    expect(missing, `Pantallas de Auditoría sin explicador:\n${missing.join('\n')}`).toEqual([]);
  });

  it('cada pantalla trae además un ejemplo concreto', () => {
    // La explicación dice PARA QUÉ sirve la vista; el ejemplo, qué harías hoy con ella.
    // Sin él, quien no conoce el dominio se queda con una definición que no sabe aplicar.
    const missing = auditItems
      .filter((item) => !viewExamples[sectionKey(item.path)])
      .map((item) => `${item.label} → ${item.path}`);

    expect(missing, `Pantallas de Auditoría sin ejemplo:\n${missing.join('\n')}`).toEqual([]);
  });
});
