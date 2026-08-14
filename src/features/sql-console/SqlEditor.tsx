'use client';

import Editor, { loader, type Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import type { CatalogDataset, QueryViolation } from './sql-console.types';
import { registerSqlCompletions } from './sql-completions';

/** Texto que otro control quiere escribir en el editor. El `token` obliga a reaplicarlo. */
export interface EditorWrite {
  text: string;
  token: number;
}

interface Props {
  /** Pestaña activa. Cambiarla remonta el editor con el texto de esa pestaña. */
  tabId: string;
  initialValue: string;
  onChange: (value: string) => void;
  /**
   * Ejecutar. Recibe el texto LEÍDO DEL EDITOR en el momento de la pulsación.
   *
   * No es un parámetro de conveniencia. Sin él, quien atendía el atajo leía la consulta del
   * estado de React, y ese estado va un paso por detrás de lo que hay escrito: entre teclear
   * y pulsar Ctrl+Enter cabe un render. En la primera carga —la lenta, la que paga la
   * descarga de Monaco— esa ventana se ensancha lo suficiente como para que el atajo
   * encuentre la consulta VACÍA y no haga nada, sin decir por qué. El editor siempre sabe
   * qué hay escrito; el estado, sólo qué había.
   */
  onRun: (statement: string) => void;
  datasets: CatalogDataset[];
  violations: QueryViolation[];
  write: EditorWrite | null;
  disabled?: boolean;
}

/**
 * El editor de la consola.
 *
 * Monaco se sirve DESDE EL BUNDLE, no desde el CDN que `@monaco-editor/react` usa por
 * omisión: la CSP del portal es `script-src 'self' 'nonce-…' 'strict-dynamic'` y un
 * `<script>` de jsdelivr quedaría bloqueado —el editor no cargaría nunca y el fallo sólo se
 * vería en la consola del navegador—. Los web workers se neutralizan por lo mismo.
 *
 * **El editor NO es un componente controlado, y ésa es la decisión importante de este
 * archivo.** Lo fue, y con `value` viajando de vuelta en cada pulsación se perdían
 * caracteres: al teclear a velocidad normal, React devolvía un valor ya rancio y Monaco lo
 * escribía encima, borrando un trozo del medio. Medido tecleando
 * `SELECT 2 FROM desenlaces.observaciones`, en pantalla quedaba `SELECT 2 FROenvaciones`.
 * Es un fallo especialmente malo porque no parece un fallo: quien escribe da por hecho que
 * se equivocó él, y lo único que se ve luego es una consulta que no compila.
 *
 * Así que el modelo de Monaco es el dueño del texto mientras se escribe, `onChange` lo
 * reporta hacia arriba, y las escrituras que vienen de FUERA —insertar una columna, reabrir
 * una consulta del historial— entran por `write`, de forma explícita y una sola vez.
 * Cambiar de pestaña remonta el editor con `key`, que es lo que carga el texto de la otra.
 */
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

function currentTheme(): 'vs' | 'vs-dark' {
  if (typeof document === 'undefined') return 'vs';
  return document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs';
}

export function SqlEditor({
  tabId,
  initialValue,
  onChange,
  onRun,
  datasets,
  violations,
  write,
  disabled,
}: Props) {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'vs' | 'vs-dark'>('vs');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // El comando de Monaco se registra una vez, así que capturaría el `onRun` del primer
  // render para siempre. La referencia lo mantiene apuntando al actual.
  const runRef = useRef(onRun);
  runRef.current = onRun;
  const appliedWrite = useRef(0);

  useEffect(() => {
    configureMonacoOnce();
    setTheme(currentTheme());
    setReady(true);
    // El conmutador de tema escribe `data-theme` en el elemento raíz; se observa ese
    // atributo en vez de exponer un contexto nuevo sólo para esto.
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Los avisos de la guardia se pintan como marcas de Monaco: subrayado en la línea exacta
  // y globo con el motivo. Enseñarlos sólo en una lista debajo obligaría a contar líneas a
  // mano para encontrar el `DROP` que sobra.
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'atlas-sql-guard',
      violations.map((violation) => ({
        severity: monaco.MarkerSeverity.Error,
        message: violation.message,
        startLineNumber: violation.line ?? 1,
        startColumn: violation.column ?? 1,
        endLineNumber: violation.line ?? 1,
        endColumn: (violation.column ?? 1) + 1,
      })),
    );
  }, [violations]);

  // Escrituras de fuera. `token` es lo que distingue «insertar la misma columna otra vez»
  // de «no ha pasado nada»: comparando sólo el texto, el segundo clic no haría nada.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !write || write.token === appliedWrite.current) return;
    appliedWrite.current = write.token;
    editor.setValue(write.text);
    editor.setPosition(
      editor.getModel()?.getFullModelRange().getEndPosition() ?? { lineNumber: 1, column: 1 },
    );
    editor.focus();
    onChange(write.text);
  }, [write, onChange]);

  /*
   * Cambiar de pestaña carga su texto SIN remontar el editor.
   *
   * Antes esto se hacía con `key={tabId}`, que es la forma corta y resultó ser la cara:
   * cada remontaje crea un editor nuevo, y con él se vuelven a registrar su acción de
   * Ctrl+Enter y su proveedor de autocompletado. Si el remontaje caía entre que alguien
   * teclea y pulsa el atajo, el atajo no hacía nada — un fallo INTERMITENTE, que es peor
   * que uno constante porque enseña a repetir el gesto en vez de a reportarlo. Se vio en
   * una corrida de diez pruebas: nueve verdes y ésa roja, y a la vuelta al revés.
   *
   * Sustituir el contenido del modelo hace lo mismo sin tirar el editor. `tabId` es la
   * única dependencia a propósito: reaccionar también a `initialValue` devolvería el texto
   * guardado encima de lo que se está escribiendo, que es el bucle que este componente ya
   * pagó una vez al ser controlado.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.getValue() === initialValue) return;
    editor.setValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  if (!ready) {
    return (
      <textarea
        className="sql-editor__fallback"
        defaultValue={initialValue}
        readOnly
        aria-label="Editor de consultas (cargando)"
      />
    );
  }

  /*
   * `addAction` y no `addCommand`, que es lo que había y no funcionaba.
   *
   * Monaco ya trae Ctrl+Enter atado a `editor.action.insertLineAfter`. Un `addCommand`
   * compite con esa atadura y pierde: el atajo que la propia pantalla anuncia debajo del
   * botón —«Ctrl+Enter»— insertaba una línea en blanco y no ejecutaba nada. Una acción se
   * registra dentro del editor, gana a la de serie y además aparece en la paleta de
   * comandos con nombre, que es donde la busca quien no se sabe el atajo.
   */
  const handleMount = (editor: monaco.editor.IStandaloneCodeEditor, instance: Monaco) => {
    editorRef.current = editor;
    editor.addAction({
      id: 'atlas.sql-console.run',
      label: 'Ejecutar la consulta',
      keybindings: [instance.KeyMod.CtrlCmd | instance.KeyCode.Enter],
      run: (instance) => runRef.current(instance.getValue()),
    });

    /*
     * Y además se intercepta la pulsación, porque la acción sola no basta.
     *
     * Con el globo de sugerencias abierto, Monaco despacha Ctrl+Enter al globo y la acción
     * no llega a correr: el atajo que la pantalla anuncia no hace NADA. Y el globo se abre
     * solo —`quickSuggestions` tiene retardo—, así que reaparece justo después de teclear,
     * que es exactamente cuando alguien pulsa el atajo. El resultado era un fallo
     * INTERMITENTE, medido: una corrida de 30 pruebas con 29 verdes y ésa roja, y a la
     * vuelta la roja en otra repetición. Un atajo que funciona cuatro de cada cinco veces
     * es peor que uno que no funciona nunca: enseña a repetir el gesto en vez de a
     * reportarlo, y quien lo reporta no consigue reproducirlo.
     *
     * `onKeyDown` ve la tecla antes de que se resuelva contra el globo; cortar aquí la
     * propagación deja el atajo con un solo significado, siempre el mismo.
     */
    editor.onKeyDown((event) => {
      if (event.keyCode !== instance.KeyCode.Enter) return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      runRef.current(editor.getValue());
    });
  };

  return (
    <div className="sql-editor">
      <Editor
        height="100%"
        language="sql"
        theme={theme}
        defaultValue={initialValue}
        onChange={(next) => onChange(next ?? '')}
        beforeMount={(instance) => registerSqlCompletions(instance, datasets)}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          readOnly: disabled,
          renderLineHighlight: 'line',
          overviewRulerLanes: 0,
          padding: { top: 12, bottom: 12 },
          suggestSelection: 'first',
          quickSuggestions: { other: true, comments: false, strings: false },
          /*
           * El autocompletado NO acepta al teclear un signo de puntuación.
           *
           * Monaco trae esto activado, y en SQL destroza lo que se escribe: al llegar al
           * punto de `desenlaces.observaciones` daba por aceptada la sugerencia resaltada y
           * sustituía lo tecleado. Aceptar con Tab o con Enter sigue funcionando, que es
           * como se acepta una sugerencia a propósito.
           */
          acceptSuggestionOnCommitCharacter: false,
        }}
      />
    </div>
  );
}
