import { describe, expect, it } from 'vitest';
import {
  DECISION_HELP,
  DECISION_LABEL,
  REASON_LABEL,
  decisionTone,
  type IdentityDecision,
} from './identity-types';

/**
 * Los códigos que el motor puede emitir tienen que tener frase en español.
 *
 * Un código sin traducir no rompe nada: se pinta crudo, en mayúsculas, justo
 * donde alguien espera una explicación. Pasó de verdad con `NO_FACE_IN_DOCUMENT`
 * —la ficha del parecido decía «No se pudo comparar» y al lado el código en
 * bruto— y lo destapó una prueba de navegador, que es un sitio caro para
 * enterarse. Esta lista es el espejo de lo que el motor emite:
 *
 *   - motivos del motor de decisión (`identity-decision.engine.ts`)
 *   - avisos del analizador de cédula (`bolivia-ci-document.parser.ts`)
 *   - avisos de calidad de imagen (`sharp-image.adapter.ts`)
 *   - motivos de no comparación (`FaceMatchResult.notComparableReason`)
 *
 * Si el motor añade uno, esta prueba se pone roja antes que la pantalla.
 */
const CODIGOS_DEL_MOTOR = [
  // Decisión
  'LIVENESS_FAILED',
  'DOCUMENT_EXPIRED',
  'LOW_DOCUMENT_CONFIDENCE',
  'LOW_FACE_QUALITY',
  'DOCUMENT_FIELD_INCONSISTENCY',
  'DOCUMENT_EXPIRY_UNKNOWN',
  'LIVENESS_UNCERTAIN',
  'FACE_MATCH_UNAVAILABLE',
  'THRESHOLD_PROFILE_MISSING',
  'FACE_NO_MATCH',
  'AMBIGUOUS_MATCH',
  'MULTIPLE_FACES',
  // Analizadores
  'DOCUMENT_NUMBER_NOT_FOUND',
  'NAME_NOT_FOUND',
  'DATE_OF_BIRTH_NOT_FOUND',
  'DOCUMENT_EXPIRY_NOT_FOUND',
  'DATE_OF_BIRTH_UNPARSABLE',
  'DOCUMENT_EXPIRY_UNPARSABLE',
  'NAME_SPLIT_HEURISTIC',
  'DOCUMENT_SIDES_MISMATCH',
  'GENERIC_PARSER_USED',
  'MRZ_NOT_FOUND',
  // Calidad de imagen
  'LOW_RESOLUTION',
  'UNDEREXPOSED',
  'OVEREXPOSED',
  'LOW_CONTRAST',
  'POSSIBLE_BLUR',
  'QUALITY_SCORE_TOO_LOW',
  'FACE_TOO_SMALL',
  // Por qué no se pudo comparar
  'NO_FACE_IN_DOCUMENT',
  'NO_FACE_IN_SELFIE',
  'PROVIDER_REJECTED_INPUT',
] as const;

const DECISIONES: IdentityDecision[] = [
  'VERIFIED',
  'REVIEW_REQUIRED',
  'NOT_VERIFIED',
  'INCONCLUSIVE',
];

describe('contrato de la vista de verificación de identidad', () => {
  it('traduce todos los códigos que el motor puede emitir', () => {
    const sinTraducir = CODIGOS_DEL_MOTOR.filter((code) => !REASON_LABEL[code]);
    expect(sinTraducir, 'estos códigos se pintarían en bruto').toEqual([]);
  });

  it('las frases no repiten el código en mayúsculas', () => {
    // Una «traducción» que sea el propio código con espacios no explica nada y
    // deja la prueba de arriba en verde sin haber traducido.
    for (const code of CODIGOS_DEL_MOTOR) {
      expect(REASON_LABEL[code]).not.toBe(code);
      expect(REASON_LABEL[code]?.toUpperCase()).not.toBe(code.replace(/_/g, ' '));
    }
  });

  it('cada veredicto tiene nombre y explicación', () => {
    for (const decision of DECISIONES) {
      expect(DECISION_LABEL[decision]).toBeTruthy();
      expect(DECISION_HELP[decision]?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('«no concluyente» no se colorea como un rechazo', () => {
    /*
     * Es la distinción que sostiene todo el worker: «no pudimos comparar» y «es
     * otra persona» tienen consecuencias opuestas para quien se verifica.
     * Pintarlas del mismo rojo las hace indistinguibles de un vistazo, que es
     * como se leen las insignias.
     */
    expect(decisionTone('INCONCLUSIVE')).not.toBe(decisionTone('NOT_VERIFIED'));
    expect(decisionTone('VERIFIED')).toBe('PASSED');
    expect(decisionTone('NOT_VERIFIED')).toBe('FAILED');
    expect(decisionTone('REVIEW_REQUIRED')).toBe('WARNING');
  });

  it('el tono sale del vocabulario cerrado que la insignia sabe colorear', () => {
    // Un valor fuera de él cae en «neutral» sin avisar, que es el color de «no
    // pasa nada aquí» — justo lo contrario de un rechazo.
    const vocabulario = ['PASSED', 'WARNING', 'FAILED', 'INACTIVE', 'RUNNING', 'QUEUED'];
    for (const decision of DECISIONES) {
      expect(vocabulario).toContain(decisionTone(decision));
    }
  });
});
