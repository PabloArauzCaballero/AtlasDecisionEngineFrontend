import type { CreateField } from './resource.types';

/**
 * Built-in create-form field specs, kept out of resource.config.ts so that file
 * stays under the 299-line source limit. Field keys mirror the Decision Engine
 * DTOs (see /docs/openapi.json): CreateVariableDefinitionDto, CreateReasonCodeDto
 * and CreateArtifactDto. Dot-notation keys build the nested request body.
 *
 * Each field carries `help`: plain-language text shown as an info (?) tooltip next
 * to its label, so a non-technical analyst understands exactly what to enter.
 *
 * Enum-like / DB-sourced fields are `optionsEndpoint` selects fed by the
 * read-model view `/v1/views/options` (idempotent `vw_form_option`), so the UI
 * never hardcodes catalogs and avoids overfetching full entities. Each select
 * degrades to a free input when its catalog is unavailable or empty.
 */
const optionEndpoint = (group: string) => `/v1/views/options?group=${group}`;

export const variablesCreateFields: readonly CreateField[] = [
  {
    key: 'variableCode',
    label: 'Código',
    required: true,
    code: true,
    placeholder: 'INGRESO_MENSUAL',
    help: 'Identificador único y estable (MAYÚSCULAS_CON_GUION). No cambia entre versiones; es el "nombre técnico" del dato que usarán las reglas.',
  },
  {
    key: 'canonicalName',
    label: 'Nombre canónico',
    required: true,
    placeholder: 'Ingreso mensual',
    help: 'Nombre legible para personas (p. ej. «Ingreso mensual»). Es cómo se muestra la variable en la interfaz.',
  },
  {
    key: 'businessDescription',
    label: 'Descripción de negocio',
    kind: 'textarea',
    required: true,
    placeholder: 'Qué representa esta variable en el negocio.',
    help: 'Explica qué representa el dato y de dónde viene, para que otros sepan cuándo usarlo. Ej.: «Ingreso neto declarado en el extracto bancario».',
  },
  {
    key: 'dataClassification',
    label: 'Clasificación de datos',
    required: true,
    optionsEndpoint: optionEndpoint('dataClassification'),
    help: 'Nivel de confidencialidad (INTERNAL, CONFIDENTIAL…). Define los controles de acceso que el motor aplica al dato.',
  },
  {
    key: 'ownerTeam',
    label: 'Equipo responsable',
    required: true,
    optionsEndpoint: optionEndpoint('ownerTeam'),
    help: 'Equipo que mantiene esta variable y responde por su calidad.',
  },
  {
    key: 'initialVersion.dataType',
    label: 'Tipo de dato',
    required: true,
    optionsEndpoint: optionEndpoint('variableDataType'),
    help: 'NUMBER, INTEGER, STRING, BOOLEAN, DATE… Determina cómo se compara y calcula el valor en las reglas.',
  },
  {
    key: 'isSensitive',
    label: 'Dato sensible',
    kind: 'checkbox',
    defaultValue: false,
    help: 'Márcalo si contiene datos personales (PII). El motor lo trata con controles reforzados y lo enmascara en auditoría.',
  },
  {
    key: 'initialVersion.nullable',
    label: 'Admite nulos',
    kind: 'checkbox',
    defaultValue: false,
    help: 'Márcalo si el valor puede llegar vacío/nulo sin que la decisión falle.',
  },
  // --- Contrato de §1.1 en el ALTA, no sólo al crear versiones después ---
  // Sin estos campos la variable nace sin mensaje de validación, sin ejemplos y
  // sin origen esperado, y hay que volver a editarla. Todos son opcionales: el
  // alta rápida sigue siendo posible, pero el contrato completo ya cabe aquí.
  {
    key: 'initialVersion.constraints',
    label: 'Restricciones (JSON, opcional)',
    kind: 'json',
    placeholder: '{ "min": 0, "max": 100000, "scale": 2 }',
    help: 'Límites que el valor debe cumplir: min/max, minLength/maxLength, allowedValues, pattern, scale… El motor SIEMPRE las reevalúa en el servidor antes de ejecutar, así que son la regla de verdad y no una ayuda del formulario.',
  },
  {
    key: 'initialVersion.validationMessage',
    label: 'Mensaje de validación (opcional)',
    placeholder: 'El ingreso mensual debe estar entre 0 y 100.000.',
    help: 'Lo que se muestra cuando el valor incumple las restricciones. Escrito para quien lo va a leer: si lo dejas vacío, verá un mensaje genérico que no dice qué corregir.',
  },
  {
    key: 'initialVersion.exampleValid',
    label: 'Ejemplo válido (opcional)',
    kind: 'json',
    placeholder: '2500.50',
    help: 'Un valor que SÍ cumple el contrato. Se escribe con su tipo real: 2500.5 para un número, true para un booleano, texto suelto para una cadena.',
  },
  {
    key: 'initialVersion.exampleInvalid',
    label: 'Ejemplo inválido (opcional)',
    kind: 'json',
    placeholder: '-100',
    help: 'Un valor que el contrato DEBE rechazar. Sirve de prueba viva: si algún día deja de rechazarse, el contrato se aflojó sin que nadie lo notara.',
  },
  {
    key: 'initialVersion.expectedOrigin',
    label: 'Origen esperado (opcional)',
    kind: 'select',
    // Enumeración cerrada del contrato del backend (VariableVersionDto), no un
    // catálogo de base de datos: un select libre dejaría escribir un valor que
    // el backend rechaza con 422 después de rellenar todo el formulario.
    options: [
      { value: 'REQUEST', label: 'REQUEST — llega en la petición' },
      { value: 'PROVIDER', label: 'PROVIDER — la resuelve un proveedor externo' },
      { value: 'DERIVED', label: 'DERIVED — se deriva de otras variables' },
      { value: 'CALCULATED_FIELD', label: 'CALCULATED_FIELD — la produce un campo calculado' },
      { value: 'GRAPH_NODE', label: 'GRAPH_NODE — la escribe un nodo del grafo' },
    ],
    help: 'De dónde se espera que venga el valor. Cuando llega de otro sitio, el motor lo registra en la traza y la desviación se ve en auditoría.',
  },
  {
    key: 'initialVersion.unitCode',
    label: 'Unidad (opcional)',
    placeholder: 'BOB',
    help: 'Unidad en la que se expresa el valor (BOB, USD, MESES, %). Evita comparar importes de monedas distintas como si fueran el mismo número.',
  },
];

/** Required-but-constant parts of the variable payload (empty version arrays). */
export const variablesCreateStaticBody = {
  initialVersion: { sources: [], validationRules: [] },
};

export const reasonCodesCreateFields: readonly CreateField[] = [
  {
    key: 'reasonCode',
    label: 'Código',
    required: true,
    code: true,
    placeholder: 'FRAUDE_ALTO',
    help: 'Código único del motivo (MAYÚSCULAS). Se adjunta a cada decisión para explicarla de forma consistente.',
  },
  {
    key: 'category',
    label: 'Categoría',
    required: true,
    optionsEndpoint: optionEndpoint('reasonCategory'),
    help: 'Grupo del motivo: CREDIT, FRAUD, KYC, COMPLIANCE… Sirve para filtrar y priorizar en el análisis.',
  },
  {
    key: 'publicMessage',
    label: 'Mensaje público',
    kind: 'textarea',
    required: true,
    placeholder: 'Mensaje explicable visible para el cliente.',
    help: 'Lo que ve el CLIENTE cuando este motivo acompaña la decisión. Claro, empático y sin tecnicismos.',
  },
  {
    key: 'internalMessage',
    label: 'Mensaje interno',
    kind: 'textarea',
    required: true,
    placeholder: 'Explicación para analistas internos.',
    help: 'Explicación para el ANALISTA interno. Puede ser más técnica y detallada que la pública.',
  },
  {
    key: 'severity',
    label: 'Severidad',
    required: true,
    optionsEndpoint: optionEndpoint('reasonSeverity'),
    help: 'Qué tan grave es el motivo (INFO, LOW, MEDIUM, HIGH…). Ayuda a ordenar la revisión.',
  },
  {
    key: 'isAdverseAction',
    label: 'Adverse action',
    kind: 'checkbox',
    defaultValue: false,
    help: 'Márcalo si es una decisión adversa (p. ej. rechazo) que legalmente debe notificarse al cliente.',
  },
];

export const artifactsCreateFields: readonly CreateField[] = [
  {
    key: 'artifactCode',
    label: 'Código',
    required: true,
    code: true,
    placeholder: 'SCORING_CREDITO',
    help: 'Código único del algoritmo (MAYÚSCULAS_CON_GUION). Lo identifica en todo el sistema.',
  },
  {
    key: 'name',
    label: 'Nombre',
    required: true,
    placeholder: 'Scoring de crédito',
    help: 'Nombre legible del algoritmo (p. ej. «Scoring de crédito de consumo»).',
  },
  {
    key: 'artifactType',
    label: 'Tipo',
    required: true,
    optionsEndpoint: optionEndpoint('artifactType'),
    help: 'Tipo de artefacto de decisión (DECISION, SCORECARD, RULESET…).',
  },
  {
    key: 'ownerTeam',
    label: 'Equipo responsable',
    required: true,
    optionsEndpoint: optionEndpoint('ownerTeam'),
    help: 'Equipo dueño del algoritmo y de sus versiones.',
  },
  {
    key: 'businessPurpose',
    label: 'Propósito de negocio',
    kind: 'textarea',
    required: true,
    placeholder: 'Para qué se usará este artefacto de decisión.',
    help: 'Qué problema de negocio resuelve esta decisión y por qué existe. Ej.: «Decidir aprobación y línea de un crédito BNPL».',
  },
  {
    key: 'riskDomain',
    label: 'Dominio de riesgo',
    required: true,
    optionsEndpoint: optionEndpoint('riskDomain'),
    help: 'Área de riesgo que gobierna: CREDIT, FRAUD, COMPLIANCE…',
  },
  {
    key: 'semanticVersion',
    label: 'Versión semántica (opcional)',
    placeholder: '1.0.0',
    help: 'Versión inicial en formato X.Y.Z. Si lo dejas vacío, se usa 1.0.0.',
  },
];
