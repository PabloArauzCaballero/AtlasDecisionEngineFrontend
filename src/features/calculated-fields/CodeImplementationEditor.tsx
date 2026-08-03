'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { LibrarySelector } from '../libraries/LibrarySelector';
import type { CalculatedFieldInput } from './calculated-field.types';

/**
 * Monaco pesa y toca `window`, así que se carga sólo en el cliente y bajo demanda:
 * quien nunca abre una implementación por código no paga su descarga.
 */
const MonacoCodeEditor = dynamic(
  () => import('./MonacoCodeEditor').then((module) => module.MonacoCodeEditor),
  { ssr: false, loading: () => <textarea className="code-editor" rows={6} readOnly /> },
);
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
  /** Entradas declaradas: son las ÚNICAS que el código puede leer. */
  inputs?: CalculatedFieldInput[];
  onChangeSource: (source: string) => void;
  onChangeLibraries: (ids: string[]) => void;
}

/** Ejemplo inicial de cada lenguaje. Fuera del JSX porque llevan saltos de línea. */
const PLACEHOLDERS: Record<Exclude<ImplementationKind, 'OPERATION'>, string> = {
  PYTHON:
    '# Comentario libre: no cuenta para el límite\nresult = variables["deuda"] / variables["ingreso"]',
  JAVASCRIPT:
    '// Comentario libre: no cuenta para el límite\nreturn variables.deuda / variables.ingreso;',
};

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
  inputs = [],
  onChangeSource,
  onChangeLibraries,
}: Props) {
  const lines = countExecutableLines(sourceCode, language);
  const overLimit = lines > MAX_EXECUTABLE_LINES;

  /** Cómo se referencia una entrada en cada lenguaje. */
  const reference = (id: string) =>
    language === 'PYTHON' ? `variables["${id}"]` : `variables.${id}`;

  return (
    <div className="code-implementation">
      <label className="constraint-field constraint-wide">
        <span>Código ({language === 'PYTHON' ? 'Python' : 'JavaScript'})</span>
        <MonacoCodeEditor
          language={language}
          value={sourceCode}
          placeholder={PLACEHOLDERS[language]}
          onChange={onChangeSource}
        />
      </label>

      {/* Las entradas declaradas, con el nombre EXACTO con el que se leen. Es el
          error más común: escribir `inputs.x` en vez de `variables.x`, o usar el
          código de la variable del catálogo en lugar del id de la entrada. */}
      <div className="code-variables">
        <span className="code-variables-title">Variables disponibles</span>
        {inputs.length ? (
          <ul>
            {inputs.map((input) => (
              <li key={input.id}>
                <code>{reference(input.id)}</code>
                <small>{input.dataType}</small>
              </li>
            ))}
          </ul>
        ) : (
          <small className="field-hint">
            Este campo todavía no declara entradas: añádelas arriba y aparecerán aquí con el nombre
            exacto con el que se leen.
          </small>
        )}
      </div>

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
