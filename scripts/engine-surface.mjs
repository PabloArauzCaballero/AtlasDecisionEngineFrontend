/**
 * Ningún endpoint del motor puede quedar invisible en el portal sin que alguien
 * lo decida por escrito.
 *
 * Este gate existe por un fallo concreto y medido: el motor publicaba desde
 * hacía meses `v1/model-monitoring/*` (cinco operaciones: desenlaces, atributos
 * de sesgo, desempeño, estabilidad de población e impacto adverso) y
 * `v1/data-subject-requests` (dos), y el portal **no llamaba a ninguna**. La
 * capacidad existía, nadie la veía, nadie la usaba y ninguna prueba de extremo a
 * extremo pasaba por ahí — así que tampoco se habría notado si se rompía. Una
 * capacidad invisible se atrofia, y el repositorio no tenía forma de darse
 * cuenta.
 *
 * La regla, entonces: cada operación del OpenAPI del motor está **consumida**
 * por el portal, o **exenta** en `docs/superficie-no-consumida.md` con motivo y
 * responsable. Una exención es una deuda anotada; la ausencia de una exención
 * era una deuda invisible.
 *
 * Dos decisiones de diseño que conviene entender antes de tocar esto:
 *
 * 1. **La cobertura se mide por RUTA, no por método.** Detectar el verbo desde
 *    el código exigiría atar cada literal a su `{ method: 'POST' }`, que vive
 *    unas líneas más abajo y a veces en otra función. Sería frágil y su ruido
 *    haría que nadie mirase el gate. La unidad que de verdad importa aquí es
 *    «¿esta superficie asoma en alguna pantalla?», y esa es la ruta.
 * 2. **El inventario se versiona** (`docs/superficie-motor.json`) en vez de
 *    leerse del repositorio vecino. La CI del portal no tiene el motor al lado;
 *    cuando SÍ lo tiene, `--generar` lo regenera.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumedPaths, isConsumed, normalizePath } from './engine-surface-paths.mjs';

const INVENTORY = 'docs/superficie-motor.json';
const EXEMPTIONS = 'docs/superficie-no-consumida.md';
const DEFAULT_OPENAPI = '../AtlasDecisionEngine/openapi/openapi.json';

/** Métodos que describen superficie consumible; `options`/`head` no lo son. */
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/** Operaciones del OpenAPI del motor, ordenadas para que el diff sea legible. */
export function buildInventory(openapiPath) {
  const document = JSON.parse(readFileSync(openapiPath, 'utf8'));
  const operations = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!METHODS.has(method)) continue;
      operations.push({
        method: method.toUpperCase(),
        path: normalizePath(path),
        operationId: operation.operationId ?? null,
        tag: (operation.tags ?? [])[0] ?? 'sin etiqueta',
      });
    }
  }
  operations.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
  return { title: document.info?.title ?? 'motor', operations };
}

/**
 * Exenciones declaradas, indexadas por `MÉTODO /ruta`.
 *
 * Se leen de una tabla markdown y no de un JSON a propósito: quien añade una
 * exención escribe un motivo que otra persona va a leer, y un formato que se lee
 * en el navegador de GitHub invita a escribirlo en castellano.
 */
export function readExemptions(root) {
  let source;
  try {
    source = readFileSync(join(root, EXEMPTIONS), 'utf8');
  } catch {
    return new Map();
  }
  const exemptions = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const key = /^`([A-Z]+ \/[^`]+)`$/.exec(cells[0])?.[1];
    if (!key) continue;
    const [method, path] = key.split(/\s+/, 2);
    exemptions.set(`${method} ${normalizePath(path)}`, { reason: cells[1], owner: cells[2] });
  }
  return exemptions;
}

/**
 * El gate.
 *
 * Falla en cuatro casos, y los cuatro son deuda real:
 *  - una operación no está consumida ni exenta (superficie invisible nueva);
 *  - una exención sin motivo o sin responsable (una exención anónima no es una
 *    decisión, es un encogimiento de hombros);
 *  - una exención de algo que YA se consume (la deuda se pagó, quítala de la
 *    lista o la lista deja de significar nada);
 *  - una exención de una operación que el motor ya no publica (basura que hace
 *    parecer la deuda mayor de lo que es).
 */
export function verifyEngineSurface(root) {
  let inventory;
  try {
    inventory = JSON.parse(readFileSync(join(root, INVENTORY), 'utf8'));
  } catch {
    return [
      `No existe ${INVENTORY}. Genera el inventario con ` +
        `\`node scripts/engine-surface.mjs --generar\` con el motor al lado.`,
    ];
  }

  const consumed = consumedPaths(root);
  const exemptions = readExemptions(root);
  const failures = [];
  const live = new Set();

  for (const operation of inventory.operations) {
    const key = `${operation.method} ${operation.path}`;
    live.add(key);
    const covered = isConsumed(operation.path, consumed);
    const exemption = exemptions.get(key);

    if (covered && exemption) {
      failures.push(
        `${key} ya se consume en el portal: quita su fila de ${EXEMPTIONS} ` +
          `(una lista con deuda saldada deja de leerse).`,
      );
    } else if (covered) {
      continue;
    } else if (!exemption) {
      failures.push(
        `${key} (${operation.tag}) no lo consume ninguna vista del portal ` +
          `y no está exento en ${EXEMPTIONS}. Añade la pantalla que lo use, ` +
          `o la fila que explique por qué no la hay.`,
      );
    } else if (!exemption.reason || !exemption.owner) {
      failures.push(`${key} está exento sin motivo o sin responsable en ${EXEMPTIONS}.`);
    }
  }

  for (const key of exemptions.keys()) {
    if (live.has(key)) continue;
    failures.push(`${key} está exento en ${EXEMPTIONS} pero el motor ya no publica esa operación.`);
  }

  return failures;
}

/**
 * `--generar` regenera el inventario versionado desde el OpenAPI del motor.
 * `--informe` lista lo no consumido sin fallar, que es como se redacta la
 * primera línea base sin tener que adivinarla.
 */
function main(argv) {
  const root = process.cwd();
  if (argv.includes('--generar')) {
    const flagIndex = argv.indexOf('--openapi');
    const openapiPath = flagIndex === -1 ? DEFAULT_OPENAPI : argv[flagIndex + 1];
    const inventory = buildInventory(openapiPath);
    writeFileSync(join(root, INVENTORY), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    console.log(`${INVENTORY}: ${inventory.operations.length} operaciones desde ${openapiPath}`);
    return;
  }
  if (argv.includes('--informe')) {
    const inventory = JSON.parse(readFileSync(join(root, INVENTORY), 'utf8'));
    const consumed = consumedPaths(root);
    const missing = inventory.operations.filter(
      (operation) => !isConsumed(operation.path, consumed),
    );
    for (const operation of missing) {
      console.log(`| \`${operation.method} ${operation.path}\` | | | ${operation.tag} |`);
    }
    console.log(`\n${missing.length} de ${inventory.operations.length} sin consumir.`);
    return;
  }
  const failures = verifyEngineSurface(root);
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join('\n'));
    process.exit(1);
  }
  console.log('Superficie del motor: toda operación está consumida o exenta con motivo.');
}

if (process.argv[1]?.endsWith('engine-surface.mjs')) main(process.argv.slice(2));
