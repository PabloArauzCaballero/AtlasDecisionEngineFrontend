import type { OptionDescriptions } from '../contracts/option';
import {
  ARTIFACT_STATUS_HELP,
  DEPLOYMENT_STATUS_HELP,
  MANUAL_REVIEW_STATUS_HELP,
  VARIABLE_USAGE_HELP,
} from './resource-option-help';
import type { ResourceFilter } from './resource.types';

/**
 * Los filtros de «Más filtros» de cada listado, con su ayuda y con la
 * descripción de cada opción.
 *
 * Viven fuera de `resource.config.ts` por el tope de 299 líneas del
 * repositorio: explicar qué acota cada filtro y qué significa cada estado
 * ocupa, y lo que no cabía era la explicación, que es justo lo que faltaba.
 *
 * `opts` recibe primero el mapa que dice QUÉ SIGNIFICA cada valor. Sin él la
 * lista era `SUPERSEDED`, `COMPILED`… y había que elegir una para averiguar qué
 * acotaba. Un valor sin entrada en el mapa sale sin descripción y lo denuncia
 * `catalog-fields.test.ts`.
 */
const opts = (descriptions: OptionDescriptions, ...values: string[]) =>
  values.map((value) => ({ value, label: value, description: descriptions[value] }));

export const variablesFilters: readonly ResourceFilter[] = [
  {
    param: 'usage',
    label: 'Entrada / Salida',
    help: 'Acota el catálogo al papel que la variable juega en los algoritmos: lo que hay que aportar o lo que el motor devuelve.',
    options: [
      {
        value: 'INPUT',
        label: 'Entradas (datos que se aportan)',
        description: VARIABLE_USAGE_HELP.INPUT,
      },
      {
        value: 'OUTPUT',
        label: 'Salidas (resultados que devuelve)',
        description: VARIABLE_USAGE_HELP.OUTPUT,
      },
    ],
    placeholder: 'Cualquier sentido',
  },
];

export const reasonCodesFilters: readonly ResourceFilter[] = [
  {
    param: 'category',
    label: 'Categoría',
    help: 'Familia del motivo (crédito, fraude, KYC, cumplimiento). Sirve para revisar de golpe todos los de un mismo origen.',
    optionsEndpoint: '/v1/views/options?group=reasonCategory',
    placeholder: 'Categoría exacta',
  },
];

export const artifactsFilters: readonly ResourceFilter[] = [
  {
    param: 'status',
    label: 'Estado',
    help: 'Punto del ciclo de vida en que está la versión, de borrador a desplegada o archivada.',
    options: opts(
      ARTIFACT_STATUS_HELP,
      'DRAFT',
      'VALIDATION_FAILED',
      'VALIDATED',
      'COMPILED',
      'IN_REVIEW',
      'CHANGES_REQUESTED',
      'APPROVED',
      'DEPLOYED_TO_DEV',
      'DEPLOYED_TO_STAGING',
      'DEPLOYED_TO_TEST',
      'DEPLOYED_TO_PROD',
      'SUSPENDED',
      'REJECTED',
      'RETIRED',
    ),
  },
];

export const deploymentsFilters: readonly ResourceFilter[] = [
  {
    param: 'environmentCode',
    label: 'Ambiente',
    help: 'Código del ambiente donde se publicó, tal como lo nombra el motor. Ej.: PROD, STAGING, DEV.',
    placeholder: 'p. ej. PROD',
  },
  {
    param: 'status',
    label: 'Resultado',
    help: 'Cómo terminó la promoción: sirviendo, suspendida, reemplazada, revertida o fallida.',
    options: opts(
      DEPLOYMENT_STATUS_HELP,
      'PREPARING',
      'ACTIVE',
      'SUSPENDED',
      'SUPERSEDED',
      'ROLLED_BACK',
      'FAILED',
    ),
  },
];

export const manualReviewsFilters: readonly ResourceFilter[] = [
  {
    param: 'status',
    label: 'Estado',
    help: 'En qué punto está el caso: sin reclamar, reclamado o ya resuelto por una persona.',
    options: opts(
      MANUAL_REVIEW_STATUS_HELP,
      'OPEN',
      'ASSIGNED',
      'RESOLVED_APPROVED',
      'RESOLVED_DECLINED',
      'CANCELLED',
    ),
  },
  {
    param: 'assignedTo',
    label: 'Asignado a',
    help: 'Correo o usuario de quien reclamó el caso; deja ver la carga de una persona concreta.',
    placeholder: 'Usuario',
  },
];
