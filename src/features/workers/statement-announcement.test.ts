import { describe, expect, it } from 'vitest';
import { runAnnouncement, uploadRejectionAnnouncement } from './statement-announcement';
import type { WorkerRun } from './worker-types';

/**
 * Lo que se le dice al usuario en cada desenlace.
 *
 * El defecto de un aviso es que dice algo que no pasó, y eso no lo detecta
 * ninguna prueba de render: la pantalla pinta el toast igual de bien con el texto
 * correcto y con el equivocado. Aquí se fija la regla del encargo —cada desenlace
 * con su mensaje, y ninguno ambiguo— sobre la función que la decide.
 */

function ejecucion(parche: Partial<WorkerRun>): WorkerRun {
  return {
    requestId: 'req-1',
    status: 'SUCCEEDED',
    progress: 100,
    inputSource: 'UPLOAD',
    attemptCount: 1,
    queuedAt: '2026-08-16T08:00:00.000Z',
    requestedBy: 'analista@example.test',
    correlationId: 'corr-1',
    ...parche,
  };
}

/** Los textos prohibidos: describen el sistema, no lo que hay que hacer. */
const AMBIGUOS = [/no se pudo procesar/i, /documento pendiente/i];

describe('runAnnouncement', () => {
  it('anuncia el PDF no válido con un mensaje accionable, no con «no se pudo procesar»', () => {
    const aviso = runAnnouncement(
      ejecucion({ status: 'PDF_INVALID', rejectionReason: 'NOT_BANK_STATEMENT' }),
    );
    expect(aviso?.title).toBe('PDF no válido');
    expect(aviso?.description).toMatch(/no parece corresponder a un extracto bancario/i);
    for (const prohibido of AMBIGUOS) expect(aviso?.description).not.toMatch(prohibido);
  });

  it('distingue los motivos del rechazo en vez de dar el mismo texto a todos', () => {
    const corrupto = runAnnouncement(
      ejecucion({ status: 'PDF_INVALID', rejectionReason: 'CORRUPTED_PDF' }),
    );
    const protegido = runAnnouncement(
      ejecucion({ status: 'PDF_INVALID', rejectionReason: 'UNREADABLE_DOCUMENT' }),
    );
    expect(corrupto?.description).not.toBe(protegido?.description);
    expect(protegido?.description).toMatch(/contraseña/i);
  });

  /*
   * Un rechazo NO es un error del sistema. Pintarlo en rojo junto a los fallos
   * reales manda a reintentar algo que no hay que reintentar y esconde lo único
   * accionable: que el archivo era otro.
   */
  it('no pinta el rechazo como un fallo del motor', () => {
    const rechazo = runAnnouncement(ejecucion({ status: 'PDF_INVALID' }));
    const fallo = runAnnouncement(
      ejecucion({ status: 'FAILED', errorMessage: 'Se cayó la base.' }),
    );
    expect(rechazo?.tone).toBe('warning');
    expect(fallo?.tone).toBe('error');
  });

  it('anuncia el timeout diciendo por qué no se hizo esperar a nadie', () => {
    const aviso = runAnnouncement(ejecucion({ status: 'PENDING_REVIEW', reviewReason: 'TIMEOUT' }));
    expect(aviso?.title).toBe('Enviado a revisión');
    expect(aviso?.description).toMatch(/más tiempo de lo esperado/i);
    expect(aviso?.description).toMatch(/para no hacerte esperar/i);
  });

  it('anuncia la baja confianza sin decir que el documento esté mal', () => {
    const aviso = runAnnouncement(
      ejecucion({ status: 'PENDING_REVIEW', reviewReason: 'LOW_CONFIDENCE' }),
    );
    expect(aviso?.description).toMatch(/parece válido/i);
    expect(aviso?.description).toMatch(/suficiente seguridad/i);
  });

  /*
   * Si dos causas distintas dicen lo mismo, el texto deja de leerse. Es la razón
   * de que haya una frase por motivo y no un genérico.
   */
  it('da un texto distinto a cada motivo de revisión', () => {
    const motivos = [
      'TIMEOUT',
      'LOW_CONFIDENCE',
      'AMBIGUOUS_DATA',
      'UNKNOWN_BANK',
      'OCR_ERROR',
      'PARTIAL_EXTRACTION',
      'DOUBTFUL_DOCUMENT',
    ] as const;
    const textos = motivos.map(
      (reviewReason) =>
        runAnnouncement(ejecucion({ status: 'PENDING_REVIEW', reviewReason }))?.description,
    );
    expect(new Set(textos).size).toBe(motivos.length);
  });

  it('sin motivo declarado cae al texto genérico, que sigue siendo accionable', () => {
    const aviso = runAnnouncement(ejecucion({ status: 'PENDING_REVIEW' }));
    expect(aviso?.description).toMatch(/puedes continuar trabajando/i);
    for (const prohibido of AMBIGUOS) expect(aviso?.description).not.toMatch(prohibido);
  });

  it('no anuncia nada mientras la ejecución sigue viva', () => {
    expect(runAnnouncement(ejecucion({ status: 'QUEUED' }))).toBeNull();
    expect(runAnnouncement(ejecucion({ status: 'RUNNING' }))).toBeNull();
  });

  it('separa el éxito limpio del que hay que mirar', () => {
    expect(runAnnouncement(ejecucion({ status: 'SUCCEEDED' }))?.tone).toBe('success');
    expect(runAnnouncement(ejecucion({ status: 'SUCCEEDED_WITH_WARNINGS' }))?.tone).toBe('warning');
  });
});

describe('uploadRejectionAnnouncement', () => {
  /*
   * El rechazo en la puerta y el del análisis tienen que decir lo mismo: a quien
   * sube el archivo le da igual en qué etapa se decidió que no servía.
   */
  it('traduce los códigos de la puerta al mismo mensaje que el análisis', () => {
    expect(uploadRejectionAnnouncement('BANK_STATEMENT_FILE_NOT_PDF')?.title).toBe('PDF no válido');
    expect(uploadRejectionAnnouncement('BANK_STATEMENT_FILE_EMPTY')?.description).toMatch(/vacío/i);
  });

  it('no se apropia de un fallo que no es un rechazo de archivo', () => {
    expect(uploadRejectionAnnouncement('BANK_STATEMENT_RUN_NOT_FOUND')).toBeNull();
    expect(uploadRejectionAnnouncement(undefined)).toBeNull();
  });
});
