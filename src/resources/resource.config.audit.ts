import { EXECUTION_OUTCOME_HELP } from './resource-option-help';
import type { ResourceConfig } from './resource.types';

/** Auditoría y trazabilidad de negocio (F6–F7). Se fusionan en `resources`. */
export const auditResources: Readonly<Record<string, ResourceConfig>> = {
  executions: {
    key: 'executions',
    eyebrow: 'F6-01 · Auditoría',
    title: 'Buscador de Ejecuciones',
    description: 'Consulta reproducible de solicitudes, resultados, tiempos y trazas.',
    hint: 'Cada decisión que el motor ya tomó, con sus entradas, resultado y tiempos. Sirve para auditar y reproducir exactamente por qué se decidió algo.',
    endpoint: '/v1/audit/executions',
    filterParam: 'artifactCode',
    filterLabel: 'Artefacto',
    filterHelp:
      'Algoritmo cuyas decisiones quieres auditar; sin elegir ninguno se listan las de todos.',
    filterPlaceholder: 'Todos los artefactos',
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
        label: 'Request ID',
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
      { key: 'requestId', label: 'Request ID', mono: true },
      {
        key: 'artifactCode',
        label: 'Artefacto',
        mono: true,
        path: 'artifactVersion.artifact.artifactCode',
      },
      { key: 'environmentCode', label: 'Ambiente', path: 'deployment.environment.code' },
      {
        key: 'businessOutcome',
        label: 'Outcome',
        status: true,
        hint: 'El resultado de negocio de la decisión (p. ej. APROBADO, RECHAZADO, DERIVADO).',
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
    eyebrow: 'F6-05 · Auditoría',
    title: 'Bitácora de Auditoría',
    description: 'Cadena inmutable de eventos administrativos y operativos.',
    hint: 'Registro inalterable de todo lo que pasó en la plataforma (quién hizo qué y cuándo). Cada evento se encadena con un hash para probar que nadie lo modificó.',
    endpoint: '/v1/audit/events',
    filterParam: 'eventType',
    filterLabel: 'Buscar evento',
    filterHelp:
      'Texto que se busca en el tipo de evento y en el agregado afectado; basta una parte. Ej.: DEPLOY.',
    filterPlaceholder: 'Evento, actor o IP',
    filters: [
      {
        param: 'actorId',
        label: 'Actor',
        help: 'Quién provocó el evento: identificador de la persona o del servicio que actuó. Ej.: usr_204.',
        placeholder: 'ID del actor',
      },
      {
        param: 'aggregateType',
        label: 'Tipo de agregado',
        help: 'Sobre qué clase de objeto se produjo el evento, tal como lo nombra el motor. Ej.: Artifact, Deployment.',
        placeholder: 'p. ej. Artifact',
      },
    ],
    columns: [
      { key: 'createdAt', label: 'Fecha / Hora' },
      { key: 'eventType', label: 'Evento', mono: true },
      { key: 'actorId', label: 'Actor', mono: true },
      { key: 'ipAddress', label: 'IP Origen', mono: true },
      { key: 'previousHash', label: 'Hash Anterior', mono: true },
      {
        key: 'currentHash',
        label: 'Hash Actual',
        mono: true,
        hint: 'Huella criptográfica de este evento; enlaza con la del anterior para formar una cadena a prueba de manipulación.',
      },
    ],
  },
  objectives: {
    key: 'objectives',
    eyebrow: 'F7-01 · Business Traceability',
    title: 'Objetivos de Negocio',
    description: 'Métricas, políticas, artefactos y pruebas conectados de extremo a extremo.',
    hint: 'Los objetivos de negocio (p. ej. reducir la morosidad) conectados con las políticas, algoritmos y pruebas que los cumplen, para trazar todo de punta a punta.',
    endpoint: '/v1/traceability/objectives',
    primaryAction: 'Nuevo Objetivo',
    detailPath: (row) => `/objectives/${String(row.id)}`,
    columns: [
      { key: 'objectiveCode', label: 'Código', mono: true },
      { key: 'name', label: 'Objetivo' },
      { key: 'metric', label: 'Métrica / Meta' },
      { key: 'ownerTeam', label: 'Propietario' },
      { key: 'policyCount', label: 'Políticas' },
      { key: 'artifactCount', label: 'Artefactos' },
      { key: 'testCount', label: 'Pruebas' },
      { key: 'status', label: 'Estado', status: true },
    ],
  },
};
