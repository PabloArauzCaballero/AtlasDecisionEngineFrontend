import { ARTIFACT_CREATE_ROLES, CHANGE_PROPOSAL_ROLES } from '../auth/business-rules';
import { auditResources } from './resource.config.audit';
import {
  artifactsCreateFields,
  reasonCodesCreateFields,
  variablesCreateFields,
  variablesCreateStaticBody,
} from './resource.create-fields';
import type { ResourceConfig } from './resource.types';
import {
  DATA_TYPE_LABELS,
  SENSITIVITY_LABELS,
  VARIABLE_ORIGIN_LABELS,
} from '../contracts/data-types';
import { SYSTEM_ACTOR_LABELS } from '../contracts/status-labels';
import { CASE_STATUS_LABEL } from '../features/manual-review/resolution-options';
import {
  artifactsFilters,
  deploymentsFilters,
  manualReviewsFilters,
  reasonCodesFilters,
  variablesFilters,
} from './resource.filters';

export const resources: Readonly<Record<string, ResourceConfig>> = {
  variables: {
    key: 'variables',
    eyebrow: 'Catálogo',
    title: 'Catálogo de variables',
    description: 'Definiciones versionadas utilizadas por reglas, modelos y decisiones.',
    hint: 'Catálogo de los datos (edad, ingreso, score…) que tus decisiones pueden usar. Cada variable tiene un código estable, un tipo y una versión.',
    endpoint: '/v1/variables',
    // El detalle abre el contrato completo: restricciones, ejemplos, versiones y quién
    // usa la variable. Sin él, el catálogo solo dejaba ver el resumen de una fila.
    detailPath: (row) => `/variables/${String(row.id ?? '')}`,
    filterParam: 'search',
    filterLabel: 'Buscar variables',
    filterHelp:
      'Texto que se busca en el código y en el nombre de la variable; basta una parte. Ej.: INGRESO.',
    filterPlaceholder: 'Código o nombre',
    primaryAction: 'Nueva variable',
    createFields: variablesCreateFields,
    createStaticBody: variablesCreateStaticBody,
    // El catálogo lo consulta todo el mundo; declarar una variable es definir un
    // dato que las decisiones van a usar, y eso es autoría.
    createRoles: CHANGE_PROPOSAL_ROLES,
    createDeniedHint:
      'Declarar una variable requiere el rol de analista de calidad, analista de fraude o administrador de la plataforma. Consultar el catálogo, no.',
    filters: variablesFilters,
    columns: [
      { key: 'variableCode', label: 'Código', mono: true },
      { key: 'name', label: 'Nombre' },
      {
        key: 'usage',
        label: 'Uso',
        status: true,
        hint: 'Si los algoritmos la usan como entrada (dato que hay que aportar) o como salida (resultado que el motor produce).',
      },
      { key: 'category', label: 'Categoría', code: true },
      {
        key: 'dataType',
        label: 'Tipo de dato',
        code: true,
        labels: DATA_TYPE_LABELS,
        hint: 'El tipo de dato: número, texto, sí/no, fecha…',
      },
      { key: 'source', label: 'Origen', code: true, labels: VARIABLE_ORIGIN_LABELS },
      { key: 'latestVersion', label: 'Versión' },
      {
        key: 'sensitivity',
        label: 'Sensibilidad',
        status: true,
        labels: SENSITIVITY_LABELS,
        hint: 'Si es un dato personal sensible y el motor debe tratarlo con controles reforzados.',
      },
      { key: 'status', label: 'Estado', status: true },
      { key: 'updatedAt', label: 'Actualizado' },
    ],
  },
  'reason-codes': {
    key: 'reason-codes',
    eyebrow: 'Catálogo',
    title: 'Catálogo de motivos',
    description: 'Códigos explicables para resultados de crédito, fraude y cumplimiento.',
    hint: 'Los motivos explicables que acompañan cada decisión (por qué se aprobó o rechazó). Son la base de la transparencia y de los avisos legales de decisión adversa.',
    endpoint: '/v1/reason-codes',
    filterParam: 'search',
    filterLabel: 'Buscar motivo',
    filterHelp:
      'Texto que se busca en el código y en el mensaje que se le muestra al cliente; basta una parte. Ej.: FRAUDE.',
    filterPlaceholder: 'Código o mensaje',
    primaryAction: 'Nuevo motivo',
    createFields: reasonCodesCreateFields,
    createRoles: CHANGE_PROPOSAL_ROLES,
    createDeniedHint:
      'Dar de alta un motivo requiere el rol de analista de calidad, analista de fraude o administrador de la plataforma.',
    filters: reasonCodesFilters,
    columns: [
      { key: 'reasonCode', label: 'Código', mono: true },
      { key: 'category', label: 'Categoría', code: true },
      { key: 'severity', label: 'Severidad', status: true },
      {
        key: 'publicMessage',
        label: 'Mensaje público',
        hint: 'El mensaje explicable que ve el cliente cuando este motivo acompaña una decisión.',
      },
      { key: 'internalMessage', label: 'Mensaje interno' },
      { key: 'isActive', label: 'Estado', status: true },
    ],
  },
  artifacts: {
    key: 'artifacts',
    eyebrow: 'Diseño',
    title: 'Inventario de algoritmos',
    description: 'Todos los algoritmos de decisión, su versión y su estado.',
    hint: 'Cada algoritmo de decisión con sus versiones: su diagrama, sus reglas y los datos que recibe y devuelve. Aquí ves y creas todos los del sistema.',
    endpoint: '/v1/artifacts',
    filterParam: 'search',
    filterLabel: 'Buscar algoritmo',
    filterHelp:
      'Texto que se busca en el código, el nombre y el equipo responsable del algoritmo; basta una parte.',
    filterPlaceholder: 'Código, nombre o equipo',
    primaryAction: 'Nuevo algoritmo',
    createFields: artifactsCreateFields,
    // Crear un artefacto abre una familia de versiones nueva: es la decisión que
    // el encargo reserva a la administración. Proponer cambios sobre uno que ya
    // existe es otra cosa, y ésa sí la hace el tester.
    createRoles: ARTIFACT_CREATE_ROLES,
    createDeniedHint:
      'Sólo un administrador de la plataforma crea algoritmos. Para proponer un cambio, crea una versión nueva del algoritmo existente.',
    filters: artifactsFilters,
    detailPath: (row) => `/artifacts/${String(row.id)}`,
    columns: [
      { key: 'artifactCode', label: 'Código', mono: true },
      { key: 'name', label: 'Nombre' },
      { key: 'artifactType', label: 'Tipo', code: true },
      { key: 'ownerTeam', label: 'Equipo responsable', code: true },
      { key: 'latestVersion', label: 'Versión' },
      { key: 'latestStatus', label: 'Estado', status: true },
      { key: 'environmentCode', label: 'Ambiente', code: true },
      { key: 'lastValidatedAt', label: 'Última validación' },
    ],
  },
  reviews: {
    key: 'reviews',
    eyebrow: 'Gobierno',
    title: 'Bandeja de revisiones',
    description: 'Solicitudes de aprobación pendientes para Calidad, Riesgo y Cumplimiento.',
    hint: 'Solicitudes de aprobación que deben resolverse antes de que una versión de un algoritmo pueda desplegarse.',
    endpoint: '/v1/approval-requests',
    detailPath: (row) => `/approval-requests/${String(row.id)}`,
    columns: [
      { key: 'artifactCode', label: 'Algoritmo', mono: true },
      { key: 'versionNumber', label: 'Versión' },
      { key: 'workflowCode', label: 'Tipo', code: true },
      { key: 'requestedBy', label: 'Solicitante', code: true, labels: SYSTEM_ACTOR_LABELS },
      {
        key: 'currentStep',
        label: 'Paso actual',
        hint: 'En qué paso del flujo de aprobación (Calidad, Riesgo, Cumplimiento…) está la solicitud.',
      },
      {
        key: 'slaStatus',
        label: 'Plazo',
        status: true,
        hint: 'Si la revisión va dentro del plazo acordado o ya lo incumplió.',
      },
      { key: 'createdAt', label: 'Fecha' },
    ],
  },
  deployments: {
    key: 'deployments',
    eyebrow: 'Gobierno',
    title: 'Historial de despliegues',
    description:
      'Qué versión se desplegó en cada ambiente, con qué resultado y cuándo se volvió atrás.',
    hint: 'Registro de cuándo y en qué ambiente (pruebas, preproducción, producción) se desplegó cada versión de un algoritmo, y de las vueltas a una versión anterior.',
    endpoint: '/v1/deployments',
    filterParam: 'artifactCode',
    filterLabel: 'Buscar algoritmo',
    filterHelp:
      'Código EXACTO del algoritmo cuyo historial quieres ver; aquí no vale una parte. Ej.: SCORING_CREDITO.',
    filterPlaceholder: 'Código exacto',
    primaryAction: 'Nuevo despliegue',
    filters: deploymentsFilters,
    columns: [
      {
        key: 'artifactCode',
        label: 'Algoritmo',
        mono: true,
        path: 'artifactVersion.artifact.artifactCode',
      },
      { key: 'versionNumber', label: 'Versión', path: 'artifactVersion.versionNumber' },
      {
        key: 'deploymentMode',
        label: 'Modo',
        code: true,
        hint: 'Cómo se registró el despliegue: completo, gradual o comparando la versión actual con una alternativa. Hoy es sólo un dato de registro: el motor siempre responde con la versión activa del ambiente.',
      },
      { key: 'environmentCode', label: 'Ambiente', path: 'environment.code', code: true },
      { key: 'deployedBy', label: 'Desplegado por', code: true, labels: SYSTEM_ACTOR_LABELS },
      { key: 'deployedAt', label: 'Fecha' },
      {
        key: 'deploymentStatus',
        label: 'Resultado',
        status: true,
        hint: 'Estado del despliegue: activo, suspendido, reemplazado o revertido.',
      },
    ],
  },
  'manual-reviews': {
    key: 'manual-reviews',
    eyebrow: 'Operación',
    title: 'Cola de revisión manual',
    description: 'Casos derivados por reglas que requieren una decisión humana controlada.',
    hint: 'Casos que el algoritmo no decidió automáticamente y derivó a una persona para resolverlos manualmente.',
    endpoint: '/v1/manual-reviews',
    filterParam: 'search',
    filterLabel: 'Buscar caso',
    filterHelp:
      'Texto que se busca en el número del caso y en el identificador de la decisión que lo originó; basta una parte. Ej.: MR-2026.',
    filterPlaceholder: 'N.º de caso o de solicitud',
    filters: manualReviewsFilters,
    detailPath: (row) => `/manual-reviews/${String(row.id)}`,
    columns: [
      { key: 'caseCode', label: 'N.º de caso', mono: true },
      {
        key: 'priority',
        label: 'Prioridad',
        hint: 'Qué tan urgente es el caso respecto de los demás de la cola.',
      },
      { key: 'queueCode', label: 'Cola', mono: true },
      {
        key: 'status',
        label: 'Estado',
        status: true,
        labels: CASE_STATUS_LABEL,
        hint: 'En qué punto está el caso: sin tomar, asignado a alguien o ya cerrado (aprobado, rechazado o cancelado).',
      },
      { key: 'requestId', label: 'Ejecución', mono: true, path: 'execution.requestId' },
      {
        key: 'businessOutcome',
        label: 'Resultado del motor',
        status: true,
        path: 'execution.businessOutcome',
        hint: 'El resultado de negocio de la decisión original del motor (siempre «derivado a revisión» en esta cola); lo que decidió la persona está en «Estado».',
      },
      { key: 'assignedTo', label: 'Asignado a' },
      {
        key: 'dueAt',
        label: 'Vence',
        hint: 'Fecha límite para resolver el caso sin incumplir el plazo acordado.',
      },
    ],
  },
  ...auditResources,
};
