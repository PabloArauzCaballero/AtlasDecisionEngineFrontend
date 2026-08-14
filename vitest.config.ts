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
  },
});
