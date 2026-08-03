'use client';

import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect, useState } from 'react';

interface Props {
  language: 'JAVASCRIPT' | 'PYTHON';
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

/**
 * Editor de código con resaltado de sintaxis y numeración (Monaco).
 *
 * Se sirve DESDE EL BUNDLE, no desde el CDN que `@monaco-editor/react` usa por
 * defecto: la CSP del portal es `script-src 'self' 'nonce-…' 'strict-dynamic'`, y
 * un `<script>` de jsdelivr quedaría bloqueado — el editor no cargaría nunca y el
 * fallo sólo se vería en la consola del navegador.
 *
 * Los web workers de análisis se desactivan a propósito. El resaltado es
 * tokenización pura y no los necesita; lo que aportarían es autocompletado y
 * diagnósticos de TypeScript, que sobre una expresión de tres líneas no compensan
 * el peso ni la complejidad de servirlos bajo esta CSP. Sin esta línea Monaco
 * intentaría cargarlos desde una URL que no existe y volcaría errores en consola.
 */
const MONACO_LANGUAGE: Record<Props['language'], string> = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
};

let configured = false;

function configureMonacoOnce() {
  if (configured) return;
  configured = true;
  loader.config({ monaco });
  (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker: () => ({
      postMessage: () => undefined,
      terminate: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  };
}

export function MonacoCodeEditor({ language, value, placeholder, onChange }: Props) {
  // Monaco toca `window` al inicializarse, así que sólo se monta en el cliente.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    configureMonacoOnce();
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <textarea
        className="code-editor"
        rows={6}
        readOnly
        value={value}
        aria-label="Editor de código (cargando)"
      />
    );
  }

  return (
    <div className="monaco-shell">
      <Editor
        height="180px"
        language={MONACO_LANGUAGE[language]}
        theme="vs-dark"
        value={value}
        onChange={(next) => onChange(next ?? '')}
        options={{
          // Tres líneas ejecutables no necesitan minimapa ni regla vertical.
          minimap: { enabled: false },
          lineNumbers: 'on',
          fontSize: 12,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          scrollbar: { vertical: 'auto', horizontal: 'auto' },
          placeholder,
        }}
      />
    </div>
  );
}
