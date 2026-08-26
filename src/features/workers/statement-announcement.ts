import type { NotificationInput } from '../../notifications/notification.types';
import { REJECTION_ADVICE, type StatementRejectionReason } from './statement-review';
import type { WorkerRun } from './worker-types';

/**
 * Qué se le dice al usuario cuando su extracto llega a un desenlace.
 *
 * Función pura y aparte de la consola por dos motivos. El primero es que se
 * puede probar: el defecto de un aviso es que dice algo que no pasó, y eso no lo
 * detecta ninguna prueba de render. El segundo es que aquí está escrita la regla
 * que se pedía y que un `if` disperso pierde: **cada desenlace tiene su mensaje,
 * y ninguno es «no se pudo procesar»**. Ese texto y «documento pendiente»
 * describen el estado del sistema en vez de lo que hay que hacer, y sobre un
 * rechazo con evidencia suficiente son además falsos — el sistema sí supo qué
 * pasaba, sólo que no lo contaba.
 *
 * Devuelve `null` para los estados que aún no son un desenlace: anunciar «en
 * cola» cada vez que el sondeo responde llenaría la pantalla de avisos que no
 * dicen nada nuevo.
 */
export function runAnnouncement(run: WorkerRun): NotificationInput | null {
  if (run.status === 'PDF_INVALID') {
    return {
      // Advertencia y no error: no ha fallado nada. El sistema hizo su trabajo y
      // el archivo no era el que hacía falta, que es algo que quien lo subió
      // puede corregir en diez segundos.
      tone: 'warning',
      title: 'PDF no válido',
      description:
        REJECTION_ADVICE[(run.rejectionReason ?? 'NOT_BANK_STATEMENT') as StatementRejectionReason],
    };
  }

  if (run.status === 'PENDING_REVIEW' || run.status === 'IN_REVIEW') {
    return {
      tone: 'warning',
      title: run.reviewReason === 'TIMEOUT' ? 'Enviado a revisión' : 'Documento enviado a revisión',
      description: reviewDescription(run.reviewReason),
    };
  }

  if (run.status === 'SUCCEEDED') {
    return {
      tone: 'success',
      title: 'Extracto procesado',
      description: 'Los movimientos están abajo, listos para revisar o descargar.',
    };
  }

  if (run.status === 'SUCCEEDED_WITH_WARNINGS') {
    return {
      tone: 'warning',
      title: 'Procesado con advertencias',
      description:
        'Hay resultado y es utilizable, pero algo quedó sin resolver del todo. Conviene mirarlo antes de darlo por bueno.',
    };
  }

  if (run.status === 'FAILED') {
    return {
      tone: 'error',
      title: 'La conversión falló',
      description: run.errorMessage ?? 'El motor no pudo completar la conversión.',
    };
  }

  return null;
}

/**
 * Por qué está en revisión, en una frase.
 *
 * Los tres primeros son los que el encargo pide literalmente. Los demás existen
 * porque un aviso genérico sobre una causa concreta enseña a ignorar el aviso:
 * si «banco no reconocido» y «los saldos no cuadran» dicen lo mismo, el texto
 * deja de leerse.
 */
function reviewDescription(reason: WorkerRun['reviewReason']): string {
  switch (reason) {
    case 'TIMEOUT':
      return 'El procesamiento está tomando más tiempo de lo esperado. Lo enviamos automáticamente a revisión para no hacerte esperar.';
    case 'LOW_CONFIDENCE':
      return 'El documento parece válido, pero algunos datos no pudieron determinarse con suficiente seguridad.';
    case 'AMBIGUOUS_DATA':
      return 'Se leyeron los movimientos, pero los saldos o totales del documento no cuadran con ellos. Lo revisa una persona.';
    case 'UNKNOWN_BANK':
      return 'Es un extracto, pero no reconocimos la entidad ni su formato. Lo revisa una persona.';
    case 'OCR_ERROR':
      return 'El documento no tiene texto legible: parece un escaneo o una foto. Lo revisa una persona.';
    case 'PARTIAL_EXTRACTION':
      return 'Reconocimos el documento pero no obtuvimos movimientos utilizables. Lo revisa una persona.';
    case 'DOUBTFUL_DOCUMENT':
      return 'El documento se parece a un extracto y no pudimos confirmarlo. Lo revisa una persona.';
    case 'SUSPECTED_TAMPERING':
      /*
       * No se dice QUÉ señal lo delató, ni siquiera aquí. Esta pantalla la mira quien opera el
       * worker, pero el mismo texto acaba delante de quien subió el archivo, y contarle la señal es
       * enseñarle qué evitar. El detalle está en la ejecución, para quien audita.
       */
      return 'El archivo tiene indicios de haberse modificado después de emitirse. Lo revisa una persona; volver a descargarlo del banco y subirlo sin abrirlo lo resuelve antes.';
    default:
      return 'No pudimos determinar el resultado con suficiente seguridad. El documento fue enviado a revisión y puedes continuar trabajando.';
  }
}

/**
 * Rechazos que ocurren en la PUERTA, antes de que exista ninguna ejecución.
 *
 * El motor los contesta con un código y sin fila, así que no hay estado que
 * sondear: el aviso tiene que salir del fallo de la petición. Se traducen al
 * mismo vocabulario que los del análisis para que el usuario reciba el mismo
 * mensaje viniera el rechazo de donde viniera — que es lo único que le importa.
 */
const REJECTION_BY_UPLOAD_CODE: Record<string, StatementRejectionReason> = {
  BANK_STATEMENT_FILE_REQUIRED: 'EMPTY_DOCUMENT',
  BANK_STATEMENT_FILE_EMPTY: 'EMPTY_DOCUMENT',
  BANK_STATEMENT_FILE_TOO_LARGE: 'UNSUPPORTED_FILE',
  BANK_STATEMENT_FILE_NOT_PDF: 'UNSUPPORTED_FILE',
  BANK_STATEMENT_FILE_NAME_INVALID: 'UNSUPPORTED_FILE',
};

/** El aviso de un rechazo en la puerta, o `null` si el fallo fue otra cosa. */
export function uploadRejectionAnnouncement(code: string | undefined): NotificationInput | null {
  const reason = code ? REJECTION_BY_UPLOAD_CODE[code] : undefined;
  if (!reason) return null;
  return {
    tone: 'warning',
    title: 'PDF no válido',
    description: REJECTION_ADVICE[reason],
  };
}
