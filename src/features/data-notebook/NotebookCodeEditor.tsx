'use client';

import Editor, { loader, type Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import type { NotebookLanguage } from './notebook-types';
import type { SimboloNotebook } from './notebook-symbols';

interface NotebookCodeEditorProps {
  language: NotebookLanguage;
  value: string;
  placeholder: string;
  ariaLabel: string;
  /** Lo que esta celda puede nombrar: API, columnas y memoria de variables. */
  simbolos: readonly SimboloNotebook[];
  onChange: (value: string) => void;
  onRun: () => void;
}

/**
 * El editor de una celda de código.
 *
 * ## Por qué Monaco y no el `textarea` de antes
 *
 * Un cuaderno se escribe mirando el código, y sin colores todo pesa igual: una cadena, un nombre de
 * variable y una palabra reservada se leen con el mismo esfuerzo. Monaco ya estaba en el portal
 * —consola SQL y campos calculados—, así que esto no añade ni una dependencia.
 *
 * ## La altura la manda el contenido
 *
 * Monaco necesita una altura explícita; con una fija, una celda de tres líneas deja un hueco y una
 * de cuarenta obliga a desplazar DENTRO del editor mientras la página también se desplaza — dos
 * barras compitiendo por la misma rueda, que es de lo más incómodo que puede hacer un cuaderno.
 * Aquí la altura se ata al contenido real y el editor nunca tiene barra propia.
 *
 * ## Ctrl+Enter ejecuta
 *
 * Monaco se queda con las teclas antes que el DOM, así que el atajo del cuaderno se registra en el
 * editor. Sin esto, el atajo funcionaba en el `textarea` y dejaba de funcionar aquí: una función
 * que desaparece sin decirlo.
 */

const MONACO_LANGUAGE: Record<NotebookLanguage, string> = {
  python: 'python',
  javascript: 'javascript',
  // Monaco registra R de serie (`vs/languages/definitions/r/register.js`, que `editor.main`
  // importa), así que el resaltado llega sin añadir nada: es la misma pieza que colorea el SQL de
  // la consola.
  r: 'r',
};

const ALTURA_MINIMA = 76;
const ALTURA_MAXIMA = 720;

let configurado = false;

/**
 * Se sirve DESDE EL BUNDLE, no del CDN que `@monaco-editor/react` usa por defecto: la CSP del
 * portal es `script-src 'self' 'nonce-…' 'strict-dynamic'` y un `<script>` de jsdelivr quedaría
 * bloqueado — el editor no cargaría y el fallo sólo se vería en la consola del navegador.
 *
 * Los workers de análisis se anulan por la misma razón que en `MonacoCodeEditor`: aquí el
 * autocompletado lo sirve este módulo, que sabe del cuaderno; el de TypeScript no sabría nada de
 * `df` ni de las columnas del dataset, y a cambio pesa.
 */
function configurarMonacoUnaVez() {
  if (configurado) return;
  configurado = true;
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

const ICONO: Record<SimboloNotebook['origen'], monaco.languages.CompletionItemKind> = {
  variable: monaco.languages.CompletionItemKind.Variable,
  funcion: monaco.languages.CompletionItemKind.Function,
  modulo: monaco.languages.CompletionItemKind.Module,
  columna: monaco.languages.CompletionItemKind.Field,
  api: monaco.languages.CompletionItemKind.Constant,
};

/**
 * El orden en que aparecen las sugerencias, y no es cosmético.
 *
 * Monaco ordena por `sortText` alfabético, así que el prefijo decide. Primero lo que la persona
 * definió —es lo que está buscando—, luego la API del cuaderno, y al final las columnas, que suelen
 * ser muchas y ahogarían al resto si fueran delante.
 */
const PESO: Record<SimboloNotebook['origen'], string> = {
  variable: '1',
  funcion: '1',
  modulo: '2',
  api: '3',
  columna: '4',
};

/**
 * Una columna con espacios o acentos no es un identificador: se ofrece citada, y con la cita que
 * cada lenguaje entiende.
 *
 * En R son ACENTOS GRAVES y no comillas: `df$"total gasto"` es un error de sintaxis, mientras que
 * ``df$`total gasto` `` funciona. Ofrecer la comilla de Python aquí produciría una sugerencia que
 * rompe la celda de quien la acepta, que es la peor clase de autocompletado.
 */
function insercionDe(simbolo: SimboloNotebook, language: NotebookLanguage): string {
  if (simbolo.origen !== 'columna') return simbolo.nombre;
  if (/^[A-Za-z_]\w*$/u.test(simbolo.nombre)) return simbolo.nombre;
  if (language === 'python') return `"${simbolo.nombre}"`;
  if (language === 'r') return `\`${simbolo.nombre}\``;
  return `'${simbolo.nombre}'`;
}

export function NotebookCodeEditor({
  language,
  value,
  placeholder,
  ariaLabel,
  simbolos,
  onChange,
  onRun,
}: NotebookCodeEditorProps) {
  const [listo, setListo] = useState(false);
  const [altura, setAltura] = useState(ALTURA_MINIMA);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  /*
   * Los símbolos y el atajo viven en una `ref` además de en las propiedades.
   *
   * El proveedor de sugerencias se registra UNA vez por lenguaje y su clausura se queda con lo que
   * hubiera en ese momento: leyendo las propiedades directamente, el autocompletado seguiría
   * ofreciendo para siempre las variables que existían al montar la primera celda. La `ref` es lo
   * que hace que la memoria de variables esté viva.
   */
  const simbolosRef = useRef(simbolos);
  simbolosRef.current = simbolos;
  const ejecutarRef = useRef(onRun);
  ejecutarRef.current = onRun;

  useEffect(() => {
    configurarMonacoUnaVez();
    setListo(true);
  }, []);

  const alMontar = (editor: monaco.editor.IStandaloneCodeEditor, instancia: Monaco) => {
    editorRef.current = editor;

    const ajustar = () => {
      const contenido = editor.getContentHeight();
      setAltura(Math.min(Math.max(contenido, ALTURA_MINIMA), ALTURA_MAXIMA));
    };
    ajustar();
    editor.onDidContentSizeChange(ajustar);

    editor.addCommand(instancia.KeyMod.CtrlCmd | instancia.KeyCode.Enter, () => {
      ejecutarRef.current();
    });

    registrarSugerencias(instancia, language, () => simbolosRef.current);
  };

  if (!listo) {
    // Mientras Monaco no está, un área editable de verdad: un `readOnly` haría perder lo que se
    // escriba en ese instante, y un hueco en blanco parecería que la celda no cargó.
    return (
      <textarea
        className="notebook-cell__code"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(evento) => onChange(evento.target.value)}
      />
    );
  }

  return (
    <div className="notebook-cell__editor" style={{ height: `${altura}px` }}>
      <Editor
        height={`${altura}px`}
        language={MONACO_LANGUAGE[language]}
        theme="vs-dark"
        value={value}
        onChange={(siguiente) => onChange(siguiente ?? '')}
        onMount={alMontar}
        options={{
          minimap: { enabled: false },
          lineNumbers: 'on',
          fontSize: 13,
          // Sin desplazamiento interno: la altura ya sigue al contenido, y dejarlo activo permite
          // arrastrar el contenido dentro de un editor que no tiene nada más que enseñar.
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 4,
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          folding: false,
          scrollbar: { alwaysConsumeMouseWheel: false, vertical: 'hidden' },
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          placeholder,
          ariaLabel,
        }}
      />
    </div>
  );
}

/**
 * Registra el proveedor de sugerencias UNA vez por lenguaje, para todo el cuaderno.
 *
 * Monaco los acumula: registrarlo por celda haría que un cuaderno de quince celdas ofreciera cada
 * nombre quince veces. El proveedor lee los símbolos por función, no por valor, de modo que uno
 * solo sirve a todas las celdas y cada una recibe los suyos.
 */
const registrados = new Set<string>();

function registrarSugerencias(
  instancia: Monaco,
  language: NotebookLanguage,
  leerSimbolos: () => readonly SimboloNotebook[],
) {
  if (registrados.has(language)) return;
  registrados.add(language);

  instancia.languages.registerCompletionItemProvider(MONACO_LANGUAGE[language], {
    provideCompletionItems: (modelo: monaco.editor.ITextModel, posicion: monaco.Position) => {
      const palabra = modelo.getWordUntilPosition(posicion);
      const rango = {
        startLineNumber: posicion.lineNumber,
        endLineNumber: posicion.lineNumber,
        startColumn: palabra.startColumn,
        endColumn: palabra.endColumn,
      };

      return {
        suggestions: leerSimbolos().map((simbolo) => ({
          label: simbolo.nombre,
          kind: ICONO[simbolo.origen],
          detail: simbolo.detalle,
          documentation: simbolo.documentacion,
          insertText: insercionDe(simbolo, language),
          sortText: `${PESO[simbolo.origen]}${simbolo.nombre}`,
          range: rango,
        })),
      };
    },
  });
}
