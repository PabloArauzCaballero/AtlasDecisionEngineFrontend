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
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 'v0.28.3';
const CDN = `https://cdn.jsdelivr.net/pyodide/${VERSION}/full`;
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'public', 'pyodide');

/**
 * Núcleo: el cargador, el intérprete y la biblioteca estándar, con su SHA-256 FIJADO (MOT-12).
 *
 * Esto se descarga de un CDN durante el build y después se sirve como código del propio origen, así
 * que un CDN comprometido o un intermediario en la red del build metería código en el cuaderno sin
 * que nada lo notara. Las sumas se fijan aquí, en el repositorio, y el build FALLA si una no cuadra.
 *
 * Se obtuvieron de dos fuentes independientes que coinciden byte a byte: `cdn.jsdelivr.net` y el
 * paquete `pyodide@0.28.3` de npm (2026-10-09). Cambiar `VERSION` obliga a recalcularlas:
 *   npm pack pyodide@<versión> && tar xzf pyodide-*.tgz && shasum -a 256 package/<fichero>
 *
 * Las ruedas (`.whl`) no se enumeran aquí: su suma viene en `pyodide-lock.json`, que a su vez está
 * fijado, así que la cadena de confianza llega hasta la última rueda sin repetir cuarenta sumas.
 */
const NUCLEO = {
  'pyodide.js': '24a458425dcb4ea9836eb5ce26701d18cb769374e2b79247602ba605bf093278',
  'pyodide.mjs': '635a6da3218fe4e5668da595acfe8b5ce77453d597d602f19a423dd250653441',
  'pyodide.asm.js': 'b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56',
  'pyodide.asm.wasm': '5effb6a1a6cc4a1a85bec4622701aa797c031e1de923cbbaf2ad47abdc4ab325',
  'python_stdlib.zip': '71fee17f88a6260ec8c9c7c063533ee59c021fdc88a1ce76247378d3c4a35f4c',
  'pyodide-lock.json': 'f6e6f42f451f42affbbcddb00e8c9a3278dcbf399f57aab9f3f568839a7ff4a6',
};

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

function sha256(contenido) {
  return createHash('sha256').update(contenido).digest('hex');
}

/**
 * Descarga (o reutiliza) un fichero y comprueba su SHA-256 contra `esperado`.
 *
 * Lo que ya estaba en disco también se comprueba: el script es idempotente y en Docker el contexto
 * puede traer `public/pyodide` de otra máquina, así que «ya estaba» no es lo mismo que «es bueno».
 * Si no cuadra, el fichero se BORRA —para que el siguiente intento no lo dé por bueno— y se lanza.
 */
async function descargar(nombre, esperado) {
  const destino = join(DESTINO, nombre);
  let estado = 'ya estaba';
  let contenido;

  if (await existe(destino)) {
    contenido = await readFile(destino);
  } else {
    const respuesta = await fetch(`${CDN}/${nombre}`);
    if (!respuesta.ok) {
      throw new Error(`No se pudo descargar ${nombre}: HTTP ${respuesta.status}`);
    }
    contenido = Buffer.from(await respuesta.arrayBuffer());
    estado = 'descargado';
  }

  const obtenido = sha256(contenido);
  if (obtenido !== esperado) {
    await rm(destino, { force: true });
    throw new Error(
      `SHA-256 de ${nombre} no coincide (esperado ${esperado}, obtenido ${obtenido}). ` +
        'Se aborta: el fichero no se sirve.',
    );
  }

  if (estado === 'descargado') {
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
  }
  return { nombre, estado };
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
    if (!/^[0-9a-f]{64}$/.test(paquete.sha256 ?? '')) {
      throw new Error(`«${nombre}» no trae sha256 en pyodide-lock.json: no se puede verificar.`);
    }
    archivos.push({ fichero: paquete.file_name, sha256: paquete.sha256 });
    pendientes.push(...(paquete.depends ?? []));
  }

  return archivos;
}

async function main() {
  console.log(`Pyodide ${VERSION} -> public/pyodide/`);
  await mkdir(DESTINO, { recursive: true });

  for (const [nombre, esperado] of Object.entries(NUCLEO)) {
    const { estado } = await descargar(nombre, esperado);
    console.log(`  ${nombre}: ${estado}`);
  }

  const indice = JSON.parse(await readFile(join(DESTINO, 'pyodide-lock.json'), 'utf8'));
  const ruedas = cierre(indice, PAQUETES);
  console.log(`  ${ruedas.length} ruedas para ${PAQUETES.join(', ')}`);

  for (const { fichero, sha256: esperado } of ruedas) {
    const { estado } = await descargar(fichero, esperado);
    if (estado !== 'ya estaba') console.log(`  ${fichero}: ${estado}`);
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
  console.error('El build se detiene: un intérprete sin verificar no se sirve.');
  process.exitCode = 1;
});
