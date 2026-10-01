import { EXECUTION_OUTCOME_HELP } from './resource-option-help';
import type { ResourceConfig } from './resource.types';
import { SYSTEM_ACTOR_LABELS } from '../contracts/status-labels';

/** Auditoría y trazabilidad de negocio (F6–F7). Se fusionan en `resources`. */
export const auditResources: Readonly<Record<string, ResourceConfig>> = {
  executions: {
    key: 'executions',
    eyebrow: 'Auditoría',
    title: 'Buscador de ejecuciones',
    description: 'Cada decisión tomada: qué entró, qué salió, cuánto tardó y por qué.',
    hint: 'Cada decisión que el motor ya tomó, con sus entradas, resultado y tiempos. Sirve para auditar y reproducir exactamente por qué se decidió algo.',
    endpoint: '/v1/audit/executions',
    filterParam: 'artifactCode',
    filterLabel: 'Algoritmo',
    filterHelp:
      'Algoritmo cuyas decisiones quieres auditar; sin elegir ninguno se listan las de todos.',
    filterPlaceholder: 'Todos los algoritmos',
    filterPicker: {
      endpoint: '/v1/views/pickers/artifacts',
      valueKey: 'artifactCode',
      labelKeys: ['artifactCode', 'name'],
    },
    filters: [
      {
        param: 'outcome',
        label: 'Resultado',
        help: 'Cómo terminó la decisión: resuelta por el motor a favor o en contra, o derivada a una persona.',
        options: [
          { value: 'APPROVED', label: 'Aprobado', description: EXECUTION_OUTCOME_HELP.APPROVED },
          { value: 'DECLINED', label: 'Rechazado', description: EXECUTION_OUTCOME_HELP.DECLINED },
          {
            value: 'MANUAL_REVIEW',
            label: 'Revisión manual',
            description: EXECUTION_OUTCOME_HELP.MANUAL_REVIEW,
          },
        ],
      },
      {
        param: 'requestId',
        label: 'Identificador de la solicitud',
        help: 'Identificador que quien llamó al motor puso a la petición; sirve para cruzar esta decisión con sus registros. Ej.: req_8f21c.',
        placeholder: 'req_...',
      },
      {
        param: 'from',
        label: 'Desde',
        help: 'Primer día que entra en la búsqueda, inclusive. Sin él se busca desde la primera ejecución registrada.',
        inputType: 'date',
      },
      {
        param: 'to',
        label: 'Hasta',
        help: 'Último día que entra en la búsqueda, inclusive. Sin él se busca hasta hoy.',
        inputType: 'date',
      },
    ],
    detailPath: (row) => `/executions/${String(row.id)}`,
    columns: [
      { key: 'executedAt', label: 'Fecha / Hora' },
      { key: 'requestId', label: 'Identificador de la solicitud', mono: true },
      {
        key: 'artifactCode',
        label: 'Algoritmo',
        mono: true,
        path: 'artifactVersion.artifact.artifactCode',
      },
      {
        key: 'environmentCode',
        label: 'Ambiente',
        path: 'deployment.environment.code',
        code: true,
      },
      {
        key: 'businessOutcome',
        label: 'Resultado',
        status: true,
        hint: 'El resultado de la decisión: aprobado, rechazado o derivado a una persona.',
      },
      {
        key: 'durationMs',
        label: 'Duración (ms)',
        hint: 'Cuánto tardó el motor en tomar la decisión, en milisegundos.',
      },
    ],
  },
  'audit-events': {
    key: 'audit-events',
    eyebrow: 'Auditoría',
    title: 'Bitácora de auditoría',
    description: 'Todo lo que pasó en la plataforma, en una cadena que no se puede alterar.',
    hint: 'Registro inalterable de todo lo que pasó en la plataforma (quién hizo qué y cuándo). Cada evento lleva un sello unido al anterior para probar que nadie lo modificó.',
    endpoint: '/v1/audit/events',
    filterParam: 'search',
    filterLabel: 'Buscar evento',
    filterHelp:
      'Texto que se busca en el tipo de evento, en el tipo e identificador del objeto afectado, en quién actuó y en el identificador de la solicitud; basta una parte y no distingue mayúsculas. Ej.: DEPLOY.',
    filterPlaceholder: 'Evento, objeto, persona o solicitud',
    filters: [
      {
        param: 'actorId',
        label: 'Quién actuó',
        help: 'Quién provocó el evento: la persona o el sistema que actuó. Ej.: usr_204.',
        placeholder: 'Identificador de la persona',
      },
      {
        param: 'aggregateType',
        label: 'Tipo de objeto',
        help: 'Sobre qué clase de objeto se produjo el evento. Ej.: Artifact (algoritmo), Deployment (publicación).',
        placeholder: 'p. ej. Artifact',
      },
    ],
    columns: [
      // Las claves son las que devuelve el motor (`DecisionAuditEvent`): `occurredAt` y `eventHash`.
      // Se leían `createdAt`, `ipAddress` y `currentHash`, que no existen, y salían «—». La IP no se
      // guarda en el registro, así que no hay columna que enseñar.
      { key: 'occurredAt', label: 'Fecha / Hora' },
      { key: 'eventType', label: 'Evento', code: true },
      { key: 'actorId', label: 'Quién actuó', code: true, labels: SYSTEM_ACTOR_LABELS },
      { key: 'previousHash', label: 'Sello anterior', mono: true },
      {
        key: 'eventHash',
        label: 'Sello actual',
        mono: true,
        hint: 'Sello de este evento; se calcula con el del anterior, así que cualquier cambio rompe la cadena.',
      },
    ],
  },
  objectives: {
    key: 'objectives',
    eyebrow: 'Trazabilidad',
    title: 'Objetivos de negocio',
    description: 'Métricas, políticas, artefactos y pruebas conectados de extremo a extremo.',
    hint: 'Los objetivos de negocio (p. ej. reducir la morosidad) conectados con las políticas, algoritmos y pruebas que los cumplen, para trazar todo de punta a punta.',
    endpoint: '/v1/traceability/objectives',
    primaryAction: 'Nuevo objetivo',
    detailPath: (row) => `/objectives/${String(row.id)}`,
    columns: [
      { key: 'objectiveCode', label: 'Código', mono: true },
      { key: 'name', label: 'Objetivo' },
      { key: 'metric', label: 'Métrica / Meta' },
      { key: 'ownerTeam', label: 'Equipo responsable', code: true },
      { key: 'policyCount', label: 'Políticas' },
      { key: 'artifactCount', label: 'Algoritmos' },
      { key: 'testCount', label: 'Pruebas' },
      { key: 'status', label: 'Estado', status: true },
    ],
  },
};
