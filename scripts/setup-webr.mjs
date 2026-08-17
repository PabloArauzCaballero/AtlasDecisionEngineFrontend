/**
 * Publica el R de WebAssembly (WebR) en `public/webr/`, copiándolo de `node_modules`.
 *
 * El cuaderno de datos ejecuta R REAL en el navegador. Igual que con Pyodide, todo lo que se
 * ejecuta se sirve desde ESTE origen: la CSP del portal declara `script-src 'self'` y
 * `connect-src 'self'`, así que un CDN significaría que quien lo controle puede ejecutar código en
 * una pestaña con la sesión de alguien que gobierna decisiones de crédito.
 *
 * A diferencia de Pyodide, aquí NO se descarga nada: el paquete `webr` de npm ya trae el intérprete
 * completo, y copiarlo garantiza que el cargador (que sí entra en el bundle) y los binarios que
 * carga son de la MISMA versión. Con dos orígenes —npm para el cargador, CDN para los binarios— esa
 * pareja se puede desalinear en una actualización y el fallo aparece dentro del navegador.
 *
 * El resultado (~21 MB) está en `.gitignore`: es un artefacto reproducible, no fuente. Sin él, las
 * celdas de Python y JavaScript funcionan igual y la de R explica qué falta y cómo traerlo.
 *
 *   node scripts/setup-webr.mjs
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, 'node_modules', 'webr', 'dist');
const DESTINO = join(RAIZ, 'public', 'webr');

/**
 * Lo que se publica, y lo que NO.
 *
 * El paquete trae además su propia aplicación de demostración (`repl/`), sus pruebas y los mapas de
 * fuente. Nada de eso lo carga el cuaderno, y publicarlo dejaría en `public/` —servido sin sesión—
 * una consola de R completa que nadie ha decidido exponer.
 */
const NECESARIO = ['R.js', 'R.wasm', 'libRblas.so', 'libRlapack.so', 'webr-worker.js', 'vfs'];

async function existe(ruta) {
  try {
    await stat(ruta);
    return true;
  } catch {
    return false;
  }
}

async function tamano(ruta) {
  const info = await stat(ruta);
  if (!info.isDirectory()) return info.size;
  const entradas = await readdir(ruta, { withFileTypes: true });
  const partes = await Promise.all(entradas.map((entrada) => tamano(join(ruta, entrada.name))));
  return partes.reduce((suma, parte) => suma + parte, 0);
}

/**
 * La versión publicada queda escrita AL LADO del artefacto.
 *
 * Es lo que permite que una actualización de `webr` en `package.json` no deje en `public/` los
 * binarios de la versión anterior: el cargador nuevo pediría símbolos que el `R.wasm` viejo no
 * tiene, y el error llegaría como un fallo de WebAssembly dentro del navegador, sin mencionar en
 * ningún sitio que lo que hay que hacer es volver a correr este script.
 */
async function versionInstalada() {
  const manifiesto = JSON.parse(
    await readFile(join(RAIZ, 'node_modules', 'webr', 'package.json'), 'utf8'),
  );
  return manifiesto.version;
}

async function versionPublicada() {
  try {
    const sello = JSON.parse(await readFile(join(DESTINO, 'atlas-webr.json'), 'utf8'));
    return sello.version ?? null;
  } catch {
    return null;
  }
}

async function main() {
  if (!(await existe(ORIGEN))) {
    console.error(
      'No se encontró `node_modules/webr/dist`. Instala las dependencias (`yarn install`) antes de publicar R.',
    );
    process.exitCode = 1;
    return;
  }

  const version = await versionInstalada();
  const publicada = await versionPublicada();
  const forzar = process.argv.includes('--forzar');

  if (publicada === version && !forzar) {
    console.log(`WebR ${version} ya está publicado en public/webr/. Usa --forzar para rehacerlo.`);
    return;
  }

  // Se borra ENTERO y no se sobrescribe encima: mezclar el `vfs` de dos versiones deja una
  // biblioteca de R a medias, que R carga sin quejarse hasta que alguien llama a la función que
  // faltaba.
  await rm(DESTINO, { recursive: true, force: true });
  await mkdir(DESTINO, { recursive: true });

  for (const nombre of NECESARIO) {
    const desde = join(ORIGEN, nombre);
    if (!(await existe(desde))) {
      console.error(`El paquete webr@${version} no trae «${nombre}». Revisa la versión instalada.`);
      process.exitCode = 1;
      return;
    }
    await cp(desde, join(DESTINO, nombre), { recursive: true });
  }

  await writeFile(
    join(DESTINO, 'atlas-webr.json'),
    `${JSON.stringify({ version, publicado: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );

  const bytes = await tamano(DESTINO);
  console.log(
    `WebR ${version} publicado en public/webr/ (${(bytes / 1024 / 1024).toFixed(1)} MB).`,
  );
}

await main();
