import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    /*
     * Unit/component suite lives in src; Playwright specs in e2e/ are driven by
     * `yarn test:e2e`, never by vitest.
     *
     * `scripts/` entra también, y sólo para los gates. El emparejador de
     * `engine-surface-paths.mjs` decide qué endpoints del motor se dan por vistos: si se
     * equivoca de más, una superficie que nadie mira desaparece de la lista de deuda sin que
     * nadie la pague. Es lógica de producción disfrazada de herramienta, y hasta ahora ningún
     * gate del repositorio tenía prueba propia.
     */
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    /*
     * El presupuesto de la prueba tiene que ser HOLGADAMENTE mayor que el de una espera
     * (`asyncUtilTimeout`, 5 s en `src/test/setup.ts`). Con los dos en 5 s —el valor por
     * omisión de vitest— una prueba con dos o tres `waitFor` agota su presupuesto antes de
     * que ninguna espera llegue a rendirse, y el fallo pasa de «esto nunca apareció», que
     * señala el problema, a «la prueba tardó demasiado», que no señala nada.
     *
     * Con 60+ suites en paralelo, montar un componente y resolver su consulta simulada
     * cuesta segundos en una máquina cargada; estos plazos absorben esa varianza sin
     * ocultar un cuelgue real, que sigue fallando, sólo que unos segundos más tarde.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,

    /*
     * Cobertura MEDIDA, con suelo.
     *
     * No había ninguna: 1.092 pruebas sin saber qué tocaban. Eso no es un detalle de higiene —
     * es que nadie podía distinguir un módulo bien probado de uno que sólo tiene una prueba de
     * humo, y por tanto nadie podía decir dónde faltaba trabajo.
     *
     * Los umbrales son SUELO y no objetivo, y se fijan justo por debajo de lo medido hoy: un
     * umbral por encima de lo real deja la CI roja de forma permanente, y una CI roja
     * permanente se ignora. Cuando suba de verdad, se sube también este número.
     *
     * Se excluye lo que no es lógica: los `.tsx` de ruta de Next (`layout`, `page`, `error`)
     * son cableado que el e2e recorre entero, y contarlos aquí sólo diluye el número que sí
     * dice algo.
     */
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/app/**/{layout,page,error,loading,not-found}.next.tsx',
        'src/**/*.d.ts',
      ],
      /*
       * Medido el 13/08/2026: líneas 43,84 · ramas 78,96 · funciones 61,39.
       *
       * El suelo va JUSTO por debajo de eso. La primera versión de este bloque puso 60/60/70/60
       * a ojo, antes de medir, y la corrida se puso roja al instante — que es precisamente el
       * error contra el que advierte el comentario de arriba: un umbral por encima de lo real
       * deja la CI roja de forma permanente, y una CI roja permanente se ignora.
       *
       * Que las RAMAS (79 %) estén muy por encima de las líneas (44 %) no es una anomalía: lo
       * que está sin cubrir son módulos enteros que ninguna prueba toca, no caminos olvidados
       * dentro de lo que sí se prueba. Ahí es donde hay que mirar para subir el número.
       */
      thresholds: { lines: 43, functions: 60, branches: 78, statements: 43 },
    },
  },
});
