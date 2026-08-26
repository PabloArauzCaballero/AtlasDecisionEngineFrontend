'use client';

import { FileCheck2, FileWarning } from 'lucide-react';
import { asRecord, asStrings } from '../../utils/records';

/**
 * Con qué garantía llegaron estos movimientos.
 *
 * ## Por qué se enseña también cuando está limpio
 *
 * Porque la ausencia de un aviso no es una afirmación. Un panel que sólo
 * aparece cuando algo va mal deja al que revisa sin poder distinguir «el
 * contenedor se comprobó y está bien» de «esta versión del portal no comprueba
 * el contenedor», y las dos se ven igual: una pantalla sin avisos. Decirlo en
 * una línea cuesta una línea.
 *
 * ## Y por qué los códigos van en crudo
 *
 * Porque esta pantalla la mira un analista de riesgo o de fraude, no el
 * solicitante. Al cliente se le da una frase accionable y NADA del detalle
 * técnico —saber qué señal exacta lo delató es saber qué evitar la próxima
 * vez—; aquí hace falta lo contrario: el código con el que se puede buscar el
 * caso y comparar con otros.
 */
const VEREDICTOS: Record<string, { rotulo: string; tono: string; detalle: string }> = {
  AUTHENTIC: {
    rotulo: 'Contenedor sin indicios',
    tono: 'ok',
    detalle:
      'Ni herramienta de composición, ni contenido superpuesto, ni reescrituras posteriores a la emisión.',
  },
  SUSPECT: {
    rotulo: 'Contenedor con indicios',
    tono: 'warn',
    detalle:
      'El archivo muestra señales de haberse tocado después de emitirse, y ninguna es concluyente.',
  },
  TAMPERED: {
    rotulo: 'Contenedor manipulado',
    tono: 'bad',
    detalle: 'Hay evidencia positiva de composición o edición: no es el PDF que emitió el banco.',
  },
};

export function StatementAuthenticityNote({ result }: Readonly<{ result: unknown }>) {
  const authenticity = asRecord(asRecord(result).authenticity);
  if (Object.keys(authenticity).length === 0) return null;

  const veredicto = String(authenticity.verdict ?? 'AUTHENTIC');
  const info = VEREDICTOS[veredicto] ?? VEREDICTOS.SUSPECT!;
  const signals = asStrings(authenticity.signals);
  const limpio = veredicto === 'AUTHENTIC';

  return (
    <p className="autenticidad" data-tono={info.tono}>
      {limpio ? (
        <FileCheck2 size={16} aria-hidden="true" />
      ) : (
        <FileWarning size={16} aria-hidden="true" />
      )}
      <span>
        <strong>{info.rotulo}</strong> · {info.detalle}
        <small>
          Sospecha {String(authenticity.suspicionScore ?? 0)}/100
          {authenticity.producer ? ` · producido con ${String(authenticity.producer)}` : ''}
          {Number(authenticity.incrementalUpdates ?? 0) > 0
            ? ` · ${String(authenticity.incrementalUpdates)} reescritura(s) posterior(es)`
            : ''}
          {signals.length > 0 ? ` · ${signals.join(', ')}` : ''}
        </small>
      </span>
    </p>
  );
}
