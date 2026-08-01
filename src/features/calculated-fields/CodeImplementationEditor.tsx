'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { LibrarySelector } from '../libraries/LibrarySelector';
import {
  MAX_EXECUTABLE_LINES,
  countExecutableLines,
  type ImplementationKind,
} from './calculated-field.types';

interface Props {
  language: Exclude<ImplementationKind, 'OPERATION'>;
  sourceCode: string;
  libraryIds: string[];
  environment?: string;
  onChangeSource: (source: string) => void;
  onChangeLibraries: (ids: string[]) => void;
}

const HINTS: Record<Exclude<ImplementationKind, 'OPERATION'>, string> = {
  JAVASCRIPT: 'Devuelve el resultado con `return`. Las entradas están en `variables.<id>`.',
  PYTHON: 'Asigna el resultado a `result`. Las entradas están en `variables["<id>"]`.',
};

/**
 * Implementación por código, limitada a tres líneas ejecutables (§6.2).
 *
 * El contador es visible mientras se escribe porque el límite no es un detalle: es la
 * frontera que separa un campo calculado de un artefacto. Si el cálculo no cabe, hay que
 * modelarlo como artefacto, no comprimirlo.
 */
export function CodeImplementationEditor({
  language,
  sourceCode,
  libraryIds,
  environment,
  onChangeSource,
  onChangeLibraries,
}: Props) {
  const lines = countExecutableLines(sourceCode, language);
  const overLimit = lines > MAX_EXECUTABLE_LINES;

  return (
    <div className="code-implementation">
      <label className="constraint-field constraint-wide">
        <span>Código ({language === 'PYTHON' ? 'Python' : 'JavaScript'})</span>
        <textarea
          className="code-editor"
          rows={6}
          spellCheck={false}
          value={sourceCode}
          placeholder={
            language === 'PYTHON'
              ? '# Comentario libre: no cuenta para el límite\nresult = variables["deuda"] / variables["ingreso"]'
              : '// Comentario libre: no cuenta para el límite\nreturn variables.deuda / variables.ingreso;'
          }
          onChange={(event) => onChangeSource(event.target.value)}
        />
      </label>

      <p className={`line-budget${overLimit ? ' is-over' : ''}`}>
        {overLimit ? (
          <AlertTriangle size={14} aria-hidden />
        ) : (
          <CheckCircle2 size={14} aria-hidden />
        )}
        {lines} de {MAX_EXECUTABLE_LINES} líneas ejecutables
        {overLimit
          ? ' — supera el límite: conviértelo en un artefacto con varias etapas.'
          : '. Los comentarios y las líneas en blanco no cuentan.'}
      </p>
      <small className="field-hint">{HINTS[language]}</small>
      <small className="field-hint">
        No se permiten importaciones, bucles, acceso al reloj, a la red ni al sistema de ficheros:
        el código se ejecuta aislado y con tiempo máximo.
      </small>

      <fieldset className="code-libraries">
        <legend>Librerías autorizadas</legend>
        <LibrarySelector
          language={language}
          environment={environment}
          selectedIds={libraryIds}
          onChange={onChangeLibraries}
        />
      </fieldset>
    </div>
  );
}
