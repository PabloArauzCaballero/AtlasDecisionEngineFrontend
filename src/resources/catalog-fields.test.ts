import { describe, expect, it } from 'vitest';
import { resources } from './resource.config';
import type { CreateField, ResourceFilter } from './resource.types';

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
      // Las casillas también: «Adverse action» o «Dato sensible» son justo las
      // que más consecuencias tienen y las que menos se explican solas.
      .filter(({ field }) => !field.help)
      .map(({ resource, field }) => `${resource}.${field.key}`);

    expect(sinAyuda).toEqual([]);
  });

  it('cada opción de dominio cerrado dice qué significa, y no repite su etiqueta', () => {
    const malas = allFields.flatMap(({ resource, field }) =>
      (field.options ?? [])
        .filter((option) => problemaDeTexto(option.description, option.label))
        .map((option) => `${resource}.${field.key}=${option.value}`),
    );
    expect(malas).toEqual([]);
  });
});

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();

/** La misma vara que `scripts/check-field-help.mjs`: 4 palabras y distinto de la etiqueta. */
function problemaDeTexto(texto: string | undefined, etiqueta: string): boolean {
  if (!texto) return true;
  if (normalizar(texto).split(' ').filter(Boolean).length < 4) return true;
  return normalizar(texto) === normalizar(etiqueta);
}

const allFilters: Array<{ resource: string; filter: ResourceFilter }> = Object.values(
  resources,
).flatMap((resource) =>
  (resource.filters ?? []).map((filter) => ({ resource: resource.key, filter })),
);

describe('filtros de los listados', () => {
  it('cada filtro —el principal y los de «Más filtros»— explica qué acota', () => {
    const sinAyuda = [
      ...allFilters
        .filter(({ filter }) => problemaDeTexto(filter.help, filter.label))
        .map(({ resource, filter }) => `${resource}.${filter.param}`),
      ...Object.values(resources)
        .filter((resource) => resource.filterParam)
        .filter((resource) => problemaDeTexto(resource.filterHelp, resource.filterLabel ?? ''))
        .map((resource) => `${resource.key}.${resource.filterParam}`),
    ];
    expect(sinAyuda).toEqual([]);
  });

  it('cada opción de un filtro cerrado dice qué significa', () => {
    const malas = allFilters.flatMap(({ resource, filter }) =>
      (filter.options ?? [])
        .filter((option) => problemaDeTexto(option.description, option.label))
        .map((option) => `${resource}.${filter.param}=${option.value}`),
    );
    expect(malas).toEqual([]);
  });
});
