import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    /*
     * `e2e/` YA NO se ignora.
     *
     * Estaba en esta lista desde el principio, así que la suite que la CI
     * considera canónica —la que decide si se despliega— era el único código del
     * repositorio sin una sola regla aplicada: promesas sin esperar, variables
     * sin usar y comparaciones siempre ciertas pasaban sin que nadie las viera.
     * En una prueba eso no da un fallo ruidoso, da algo peor: un verde que no
     * comprobó lo que dice.
     */
    /*
     * `.next-*` con comodín, y no sólo `.next`.
     *
     * CLAUDE.md recomienda compilar a otro directorio para verificar la build
     * sin parar el servidor de desarrollo (`NEXT_DIST_DIR=.next-audit`). Quien
     * siga esa instrucción se encontraba con que el gate de lint pasaba a
     * recorrer la build entera: 39 000 errores en código generado que nadie
     * escribió, y el lint dejando de informar de nada.
     */
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      '.next',
      '.next-*',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
        afterEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        vi: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  /*
   * Reglas que necesitan el verificador de tipos.
   *
   * `tseslint.configs.recommended` no las trae: sólo mira el árbol sintáctico,
   * así que no puede saber que una expresión devuelve una promesa. En una base
   * de código donde casi todo manejador es `async` —y donde `void` delante de
   * una llamada es un modismo establecido para decir «esto se lanza y no se
   * espera a propósito»— esa ceguera es cara: una promesa olvidada no falla,
   * simplemente deja de ocurrir, y el rechazo se pierde sin que nadie lo vea.
   *
   * Alcance: `src/**` y nada más. `e2e/` y `scripts/` no están en el `tsconfig`
   * del proyecto, y pedir reglas con tipos sobre un archivo que el servicio de
   * proyecto no conoce no da un aviso: da un error de análisis que tapa TODAS
   * las demás reglas de ese archivo. `e2e/` sigue linteado sin tipos, que ya es
   * infinitamente más que la nada que tenía.
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // Un `onClick={async () => …}` es correcto y omnipresente en React: lo
        // que importa es que no se pase una promesa donde se espera un booleano
        // o una condición, que sí es siempre un error.
        { checksVoidReturn: false },
      ],
      '@typescript-eslint/await-thenable': 'error',
      /*
       * `require-await` queda FUERA a propósito. Marca `async () => ({…})`, que
       * en estas pruebas es la forma deliberada de fabricar un thenable para
       * simular una respuesta: sesenta avisos que no describen ningún defecto.
       * Una regla que obliga a leer sesenta falsos positivos para encontrar cero
       * fallos es la que consigue que se desactive el bloque entero.
       */
    },
  },
);
