/**
 * Explicación campo a campo de un contrato de variable, para la ficha del catálogo.
 *
 * `describeConstraints()` resume en un chip; esto es lo contrario: cada restricción
 * con su valor exacto, qué implica en el borde (¿el propio mínimo se acepta?) y el
 * CÓDIGO con el que el motor rechaza si no se cumple. Los códigos no son adorno:
 * son los que devuelve `constraint-engine.ts` del motor, así que quien lee un
 * rechazo en producción encuentra aquí la regla que lo produjo.
 */
import type { VariableConstraints } from './constraints';
import { dataTypeLabel, normalizeDataType, type DataType } from './data-types';

export interface ConstraintDetail {
  /** Clave estable de la restricción, tal como se guarda en el contrato. */
  key: string;
  label: string;
  value: string;
  /** Qué implica exactamente, incluidos los bordes. */
  note: string;
  /** Código con el que el motor rechaza un valor que la incumple. */
  code: string;
}

/** Qué exige cada formato semántico, en el idioma del producto. */
export const FORMAT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  EMAIL: 'Un correo: algo@dominio.ext, sin espacios y con al menos dos letras de extensión.',
  UUID: 'Un UUID en 8-4-4-4-12 dígitos hexadecimales, con guiones.',
  ISO_COUNTRY: 'Un país ISO 3166-1 alfa-2: exactamente dos letras MAYÚSCULAS (BO, ES).',
  ISO_CURRENCY: 'Una moneda ISO 4217: exactamente tres letras MAYÚSCULAS (BOB, USD).',
  URL: 'Una dirección absoluta que empieza por http:// o https:// y no lleva espacios.',
  PHONE: 'Un teléfono: dígitos con «+» opcional, guiones y espacios, de 6 a 20 caracteres.',
  IBAN: 'Un IBAN: dos letras de país, dos dígitos de control y de 10 a 30 alfanuméricos.',
};

/** Cómo llamar a lo que se mide, según el tipo: caracteres, elementos, valor. */
function unitFor(type: DataType): string {
  return type === 'LIST' ? 'elementos' : 'caracteres';
}

export function explainConstraints(
  rawDataType: unknown,
  constraints: VariableConstraints,
): ConstraintDetail[] {
  const type = normalizeDataType(rawDataType);
  const details: ConstraintDetail[] = [];
  const add = (key: string, label: string, value: string, note: string, code: string) =>
    details.push({ key, label, value, note, code });

  if (constraints.min !== undefined) {
    add(
      'min',
      'Valor mínimo',
      String(constraints.min),
      `El propio ${constraints.min} SÍ se acepta; por debajo se rechaza.`,
      'BELOW_MINIMUM',
    );
  }
  if (constraints.exclusiveMin !== undefined) {
    add(
      'exclusiveMin',
      'Estrictamente mayor que',
      String(constraints.exclusiveMin),
      `El propio ${constraints.exclusiveMin} NO se acepta: hay que superarlo.`,
      'BELOW_MINIMUM',
    );
  }
  if (constraints.max !== undefined) {
    add(
      'max',
      'Valor máximo',
      String(constraints.max),
      `El propio ${constraints.max} SÍ se acepta; por encima se rechaza.`,
      'ABOVE_MAXIMUM',
    );
  }
  if (constraints.exclusiveMax !== undefined) {
    add(
      'exclusiveMax',
      'Estrictamente menor que',
      String(constraints.exclusiveMax),
      `El propio ${constraints.exclusiveMax} NO se acepta: hay que quedarse por debajo.`,
      'ABOVE_MAXIMUM',
    );
  }
  if (constraints.scale !== undefined) {
    add(
      'scale',
      'Decimales',
      `${constraints.scale} como máximo`,
      'Se cuentan los dígitos tras la coma. No se redondea: un valor con más decimales se rechaza.',
      'SCALE_EXCEEDED',
    );
  }
  if (constraints.precision !== undefined) {
    add(
      'precision',
      'Dígitos significativos',
      `${constraints.precision} como máximo`,
      'Cuenta los dígitos del número entero y decimal juntos, sin el signo ni los ceros a la izquierda.',
      'PRECISION_EXCEEDED',
    );
  }
  if (constraints.minLength !== undefined) {
    add(
      'minLength',
      'Longitud mínima',
      `${constraints.minLength} ${unitFor(type)}`,
      'Se cuentan todos los caracteres, espacios incluidos.',
      'TOO_SHORT',
    );
  }
  if (constraints.maxLength !== undefined) {
    add(
      'maxLength',
      'Longitud máxima',
      `${constraints.maxLength} ${unitFor(type)}`,
      'Un texto más largo se rechaza entero: el motor NO lo recorta.',
      'TOO_LONG',
    );
  }
  if (constraints.minItems !== undefined) {
    add(
      'minItems',
      'Mínimo de elementos',
      String(constraints.minItems),
      'Una lista con menos elementos se rechaza; una lista vacía también cuenta como 0.',
      'TOO_FEW_ITEMS',
    );
  }
  if (constraints.maxItems !== undefined) {
    add(
      'maxItems',
      'Máximo de elementos',
      String(constraints.maxItems),
      'Una lista con más elementos se rechaza entera.',
      'TOO_MANY_ITEMS',
    );
  }
  if (constraints.unique) {
    add(
      'unique',
      'Elementos distintos',
      'obligatorio',
      'Dos elementos iguales invalidan la lista; la igualdad se compara por contenido.',
      'DUPLICATE_ITEMS',
    );
  }
  if (constraints.itemType) {
    add(
      'itemType',
      'Tipo de cada elemento',
      dataTypeLabel(constraints.itemType),
      'La lista es homogénea: basta un elemento de otro tipo para rechazarla.',
      'ITEM_TYPE_MISMATCH',
    );
  }
  if (constraints.pattern) {
    add(
      'pattern',
      'Expresión regular',
      constraints.pattern,
      constraints.pattern.startsWith('^') && constraints.pattern.endsWith('$')
        ? 'Anclada: la expresión tiene que casar el texto COMPLETO.'
        : 'Sin anclar (^…$): basta con que la expresión case una PARTE del texto.',
      'PATTERN_MISMATCH',
    );
  }
  if (constraints.format) {
    add(
      'format',
      'Formato',
      constraints.format.toLowerCase(),
      FORMAT_DESCRIPTIONS[constraints.format] ??
        'Formato que el motor comprueba con su propia expresión.',
      'FORMAT_INVALID',
    );
  }
  if (constraints.dependsOn?.length) {
    add(
      'dependsOn',
      'Depende de',
      constraints.dependsOn.join(', '),
      'Esta variable solo es válida si esos otros campos llegan con valor en la misma petición.',
      'DEPENDENCY_MISSING',
    );
  }
  return details;
}

/** Qué acepta el tipo por sí solo, antes de cualquier restricción declarada. */
export function describeTypeShape(rawDataType: unknown): string {
  const type = normalizeDataType(rawDataType);
  const shapes: Partial<Record<DataType, string>> = {
    // Los textuales se nombran uno a uno: el respaldo genérico repetía la etiqueta que ya
    // estaba al lado y la ficha decía «Texto — Texto libre (texto)».
    STRING: 'Cualquier texto.',
    LONG_TEXT: 'Un texto largo.',
    IDENTIFIER: 'Un identificador, en texto.',
    CODE: 'Un código, en texto.',
    ENUM: 'Uno de los valores permitidos que se listan abajo.',
    INTEGER: 'Un número sin decimales.',
    DECIMAL: 'Un número, con decimales o sin ellos.',
    CURRENCY: 'Un importe numérico; la moneda va en la unidad, no en el valor.',
    PERCENTAGE: 'Un número entre 0 y 100 (el motor lo exige aunque no haya rango declarado).',
    BOOLEAN: 'Sí o no; ni «1»/«0» ni «true» como texto.',
    DATE: 'Una fecha en formato AAAA-MM-DD.',
    DATETIME: 'Una fecha y hora ISO 8601.',
    TIME: 'Una hora HH:MM o HH:MM:SS.',
    LIST: 'Una lista de valores.',
    OBJECT: 'Un objeto con sus propios campos.',
    STRUCTURED_RESULT: 'Un objeto de resultado con la forma que declare el artefacto.',
  };
  return shapes[type] ?? `Texto libre (${dataTypeLabel(type).toLowerCase()}).`;
}
