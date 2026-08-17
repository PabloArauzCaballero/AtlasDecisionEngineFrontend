/**
 * Descarga Pyodide y las ruedas de `pandas` a `public/pyodide/`.
 *
 * El cuaderno de datos ejecuta Python REAL en el navegador (CPython compilado a WebAssembly).
 * Podría cargarse del CDN de Pyodide en dos líneas, y no se hace: la CSP del portal declara
 * `script-src 'self'` y `connect-src 'self'`, así que todo lo que se ejecuta se sirve desde este
 * mismo origen. Abrirle la mano a un CDN para esto significaría que quien controle ese CDN puede
 * ejecutar código en una pestaña con la sesión de alguien que gobierna decisiones de crédito, y
 * además filtraría a un tercero la IP de cada persona que abre el cuaderno.
 *
 * El resultado (~21 MB) está en `.gitignore`: es un artefacto reproducible, no fuente. Sin él la
 * pestaña de JavaScript funciona igual y la de Python explica exactamente qué falta y cómo
 * traerlo, en vez de fallar con un 404 del navegador.
 *
 *   node scripts/setup-pyodide.mjs
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const VERSION = 'v0.28.3';
const CDN = `https://cdn.jsdelivr.net/pyodide/${VERSION}/full`;
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'public', 'pyodide');

/** Núcleo: el cargador, el intérprete y la biblioteca estándar. */
const NUCLEO = [
  'pyodide.js',
  'pyodide.mjs',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

/**
 * Lo que el cuaderno promete que se puede importar. El resto de ruedas no se trae.
 *
 * `matplotlib` entra porque un cuaderno de análisis sin gráfico obliga a exportar a CSV y abrir
 * otra herramienta, que es justo el viaje que esta pantalla existe para evitar. Cuesta lo suyo en
 * disco —arrastra `fonttools`, `pillow`, `kiwisolver`, `pyparsing` y `cycler`— y por eso el
 * cargador lee el manifiesto en vez de asumir: un artefacto traído antes de esta línea sigue
 * sirviendo pandas, y la pantalla dice que el gráfico no está disponible en lugar de romperse.
 */
const PAQUETES = ['numpy', 'pandas', 'matplotlib'];

async function existe(ruta) {
  try {
    const info = await stat(ruta);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function descargar(nombre) {
  const destino = join(DESTINO, nombre);
  if (await existe(destino)) return { nombre, estado: 'ya estaba' };

  const respuesta = await fetch(`${CDN}/${nombre}`);
  if (!respuesta.ok) {
    if (respuesta.status === 404) return { nombre, estado: 'no existe en esta versión' };
    throw new Error(`No se pudo descargar ${nombre}: HTTP ${respuesta.status}`);
  }

  await mkdir(dirname(destino), { recursive: true });
  await pipeline(respuesta.body, createWriteStream(destino));
  return { nombre, estado: 'descargado' };
}

/**
 * Cierre de dependencias de un paquete según el propio `pyodide-lock.json`.
 *
 * Resolverlo desde el índice y no con una lista escrita a mano es lo que evita el fallo clásico:
 * traer `pandas` sin `python-dateutil` deja un `import pandas` que muere con un ModuleNotFound
 * dentro del intérprete, ya en el navegador y sin pista de qué falta.
 */
function cierre(indice, nombres) {
  const pendientes = [...nombres];
  const vistos = new Set();
  const archivos = [];

  while (pendientes.length > 0) {
    const nombre = pendientes.shift();
    const clave = nombre.toLowerCase().replace(/_/g, '-');
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const paquete = indice.packages[clave] ?? indice.packages[nombre];
    if (!paquete) {
      console.warn(`  aviso: «${nombre}» no está en el índice de ${VERSION}; se omite.`);
      continue;
    }
    archivos.push(paquete.file_name);
    pendientes.push(...(paquete.depends ?? []));
  }

  return archivos;
}

async function main() {
  console.log(`Pyodide ${VERSION} -> public/pyodide/`);
  await mkdir(DESTINO, { recursive: true });

  for (const nombre of NUCLEO) {
    const { estado } = await descargar(nombre);
    console.log(`  ${nombre}: ${estado}`);
  }

  const indice = JSON.parse(await readFile(join(DESTINO, 'pyodide-lock.json'), 'utf8'));
  const ruedas = cierre(indice, PAQUETES);
  console.log(`  ${ruedas.length} ruedas para ${PAQUETES.join(', ')}`);

  for (const rueda of ruedas) {
    const { estado } = await descargar(rueda);
    if (estado !== 'ya estaba') console.log(`  ${rueda}: ${estado}`);
  }

  // Marca lo que quedó realmente en disco: la pantalla la lee para no prometer un `import pandas`
  // que el intérprete no va a poder cumplir.
  await writeFile(
    join(DESTINO, 'atlas-manifest.json'),
    `${JSON.stringify({ version: VERSION, packages: PAQUETES }, null, 2)}\n`,
    'utf8',
  );

  console.log('Listo. El cuaderno ya puede ejecutar Python desde el propio origen.');
}

main().catch((error) => {
  console.error(`\nFalló la preparación de Pyodide: ${error.message}`);
  console.error('El cuaderno seguirá funcionando en JavaScript; la pestaña de Python lo dirá.');
  process.exitCode = 1;
});
