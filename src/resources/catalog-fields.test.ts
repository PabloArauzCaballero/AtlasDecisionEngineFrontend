import { describe, expect, it } from 'vitest';
import { resources } from './resource.config';
import type { CreateField } from './resource.types';

/**
 * Un campo de valores definidos se elige, no se escribe.
 *
 * Cuando un dato pertenece a un catálogo del motor (el equipo responsable, la
 * clasificación, el tipo, la severidad…) y el formulario lo pide como texto
 * libre, la persona tiene que adivinar la ortografía exacta y el alta falla —o,
 * peor, entra un valor que nadie más usa y el catálogo se ensucia en silencio.
 * La auditoría de cumplimiento dejaba este barrido como pendiente manual; aquí
 * queda como gate: si alguien añade un campo de catálogo sin su origen de
 * valores, esta prueba falla y nombra el campo.
 */

/**
 * Conceptos para los que el motor SÍ publica un catálogo en
 * `/v1/views/options?group=…` (vista `vw_form_option`). Pedir a mano un valor
 * que el motor ya sabe enumerar es lo que hay que impedir.
 *
 * `unitCode` queda deliberadamente fuera: el motor no publica un grupo de
 * unidades y el vocabulario es abierto (cualquier moneda o magnitud), así que
 * una lista cerrada atraparía a quien necesite una unidad poco común. Su ayuda
 * nombra las habituales (BOB, USD, MESES, %).
 */
const CATALOG_KEYS = [
  /(^|\.)dataType$/i,
  /(^|\.)dataClassification$/i,
  /(^|\.)ownerTeam$/i,
  /(^|\.)category$/i,
  /(^|\.)severity$/i,
  /(^|\.)artifactType$/i,
  /(^|\.)riskDomain$/i,
  /(^|\.)status$/i,
  /(^|\.)expectedOrigin$/i,
];

/** Un campo con valores definidos: catálogo del backend o lista cerrada local. */
function offersDefinedValues(field: CreateField): boolean {
  return (
    Boolean(field.optionsEndpoint) || Boolean(field.options?.length) || field.kind === 'select'
  );
}

const allFields: Array<{ resource: string; field: CreateField }> = Object.values(resources).flatMap(
  (resource) => (resource.createFields ?? []).map((field) => ({ resource: resource.key, field })),
);

describe('altas de catálogo', () => {
  it('hay formularios de alta que auditar', () => {
    expect(allFields.length).toBeGreaterThan(10);
  });

  it('todo campo de catálogo ofrece sus valores en vez de pedirlos a ciegas', () => {
    const escritosAMano = allFields
      .filter(({ field }) => CATALOG_KEYS.some((pattern) => pattern.test(field.key)))
      .filter(({ field }) => !offersDefinedValues(field))
      .map(({ resource, field }) => `${resource}.${field.key}`);

    expect(escritosAMano).toEqual([]);
  });

  it('cada campo explica qué poner, para quien no conoce el modelo de datos', () => {
    const sinAyuda = allFields
      .filter(({ field }) => !field.help && field.kind !== 'checkbox')
      .map(({ resource, field }) => `${resource}.${field.key}`);

    expect(sinAyuda).toEqual([]);
  });
});
