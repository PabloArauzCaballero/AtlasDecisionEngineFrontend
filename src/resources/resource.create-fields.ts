import type { CreateField } from './resource.types';

/**
 * Built-in create-form field specs, kept out of resource.config.ts so that file
 * stays under the 299-line source limit. Field keys mirror the Decision Engine
 * DTOs (see /docs/openapi.json): CreateVariableDefinitionDto, CreateReasonCodeDto
 * and CreateArtifactDto. Dot-notation keys build the nested request body.
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
  },
  {
    key: 'canonicalName',
    label: 'Nombre canónico',
    required: true,
    placeholder: 'Ingreso mensual',
  },
  {
    key: 'businessDescription',
    label: 'Descripción de negocio',
    kind: 'textarea',
    required: true,
    placeholder: 'Qué representa esta variable en el negocio.',
  },
  {
    key: 'dataClassification',
    label: 'Clasificación de datos',
    required: true,
    optionsEndpoint: optionEndpoint('dataClassification'),
  },
  {
    key: 'ownerTeam',
    label: 'Equipo responsable',
    required: true,
    optionsEndpoint: optionEndpoint('ownerTeam'),
  },
  {
    key: 'initialVersion.dataType',
    label: 'Tipo de dato',
    required: true,
    optionsEndpoint: optionEndpoint('variableDataType'),
  },
  { key: 'isSensitive', label: 'Dato sensible', kind: 'checkbox', defaultValue: false },
  { key: 'initialVersion.nullable', label: 'Admite nulos', kind: 'checkbox', defaultValue: false },
];

/** Required-but-constant parts of the variable payload (empty version arrays). */
export const variablesCreateStaticBody = {
  initialVersion: { sources: [], validationRules: [] },
};

export const reasonCodesCreateFields: readonly CreateField[] = [
  { key: 'reasonCode', label: 'Código', required: true, code: true, placeholder: 'FRAUDE_ALTO' },
  {
    key: 'category',
    label: 'Categoría',
    required: true,
    optionsEndpoint: optionEndpoint('reasonCategory'),
  },
  {
    key: 'publicMessage',
    label: 'Mensaje público',
    kind: 'textarea',
    required: true,
    placeholder: 'Mensaje explicable visible para el cliente.',
  },
  {
    key: 'internalMessage',
    label: 'Mensaje interno',
    kind: 'textarea',
    required: true,
    placeholder: 'Explicación para analistas internos.',
  },
  {
    key: 'severity',
    label: 'Severidad',
    required: true,
    optionsEndpoint: optionEndpoint('reasonSeverity'),
  },
  { key: 'isAdverseAction', label: 'Adverse action', kind: 'checkbox', defaultValue: false },
];

export const artifactsCreateFields: readonly CreateField[] = [
  {
    key: 'artifactCode',
    label: 'Código',
    required: true,
    code: true,
    placeholder: 'SCORING_CREDITO',
  },
  { key: 'name', label: 'Nombre', required: true, placeholder: 'Scoring de crédito' },
  {
    key: 'artifactType',
    label: 'Tipo',
    required: true,
    optionsEndpoint: optionEndpoint('artifactType'),
  },
  {
    key: 'ownerTeam',
    label: 'Equipo responsable',
    required: true,
    optionsEndpoint: optionEndpoint('ownerTeam'),
  },
  {
    key: 'businessPurpose',
    label: 'Propósito de negocio',
    kind: 'textarea',
    required: true,
    placeholder: 'Para qué se usará este artefacto de decisión.',
  },
  {
    key: 'riskDomain',
    label: 'Dominio de riesgo',
    required: true,
    optionsEndpoint: optionEndpoint('riskDomain'),
  },
  { key: 'semanticVersion', label: 'Versión semántica (opcional)', placeholder: '1.0.0' },
];
