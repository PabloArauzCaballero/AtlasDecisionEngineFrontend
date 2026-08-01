import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLE_PARTS = 'src/styles/parts';

/**
 * Propiedades que no se declaran en CSS porque las escribe el componente en el
 * atributo `style`. Se listan a mano: la alternativa —no comprobar nada— deja
 * pasar los nombres mal escritos, que es justo lo que esta regla persigue.
 */
const RUNTIME_CUSTOM_PROPERTIES = new Set(['--row-h']);

function styleSheets(root) {
  const directory = join(root, STYLE_PARTS);
  return readdirSync(directory)
    .filter((name) => name.endsWith('.css'))
    .map((name) => ({ name, source: readFileSync(join(directory, name), 'utf8') }));
}

/**
 * Ninguna hoja puede pedir un token que nadie define.
 *
 * `var(--no-existe)` sin respaldo no es un detalle de estilo: el navegador
 * descarta la declaración COMPLETA, así que un `padding` o un `border-radius`
 * escrito con un nombre inventado simplemente no existe. Se coló así una
 * ampliación entera de vistas —espaciados y esquinas que nunca se aplicaron—,
 * y desde el navegador no se distingue de "así se diseñó".
 */
export function verifyCustomProperties(root) {
  const sheets = styleSheets(root);
  const defined = new Set(RUNTIME_CUSTOM_PROPERTIES);
  for (const { source } of sheets) {
    for (const match of source.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) defined.add(match[1]);
  }

  const failures = [];
  for (const { name, source } of sheets) {
    source.split(/\r?\n/).forEach((line, index) => {
      for (const match of line.matchAll(/var\((--[a-z0-9-]+)\s*(,)?/g)) {
        if (defined.has(match[1]) || match[2]) continue;
        failures.push(
          `${STYLE_PARTS}/${name}:${index + 1} usa var(${match[1]}), que no está definido ` +
            `en ninguna hoja: el navegador descarta la declaración entera`,
        );
      }
    });
  }
  return failures;
}

/**
 * Ningún color literal fuera de donde tiene sentido.
 *
 * Un `color: #64748b` suelto se ve bien mientras se escribe y queda ilegible al
 * conmutar el tema, porque no sigue a nadie. Los tokens de `theme.css` existen
 * justamente para eso, así que aquí sólo se permiten las tres excepciones que
 * de verdad lo son:
 *
 *  - `theme.css`, donde viven los valores, y `theme-dark-*.css`, que ajusta
 *    tonos propios del tema oscuro;
 *  - la identidad por tipo (`--node-color`, `--concept-color`): cada tipo de
 *    nodo tiene su tono y es deliberado, no deuda;
 *  - adornos donde el token no es la respuesta (degradados, máscaras, sombras,
 *    barras de desplazamiento, filtros).
 */
const COLOR_EXCEPTIONS =
  /--(?:node|concept)-(?:color|soft)\s*:|gradient|mask|shadow|scrollbar|filter/;

export function verifyColorTokens(root) {
  const failures = [];
  for (const { name, source } of styleSheets(root)) {
    if (name === 'theme.css' || name.startsWith('theme-dark')) continue;
    // Se examina por DECLARACIÓN, no por línea: un degradado repartido en
    // varias líneas dejaría sus colores huérfanos de la palabra `gradient` y se
    // denunciarían como literales sueltos.
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
      block.replace(/[^\n]/g, ' '),
    );
    for (const match of withoutComments.matchAll(/[^;{}]+/g)) {
      const declaration = match[0];
      if (COLOR_EXCEPTIONS.test(declaration)) continue;
      const literal = /#[0-9a-fA-F]{3,8}\b/.exec(declaration);
      if (!literal) continue;
      const offset = match.index + literal.index;
      const line = withoutComments.slice(0, offset).split('\n').length;
      failures.push(
        `${STYLE_PARTS}/${name}:${line} escribe el color ${literal[0]} a mano; ` +
          `usa un token de theme.css para que siga al tema`,
      );
    }
  }
  return failures;
}

/**
 * Toda ruta del portal necesita una regla de acceso.
 *
 * `requiredRolesForPath` deniega por defecto lo que no reconoce, así que una
 * vista nueva sin su patrón no da un error de permisos: desaparece. Antes esto
 * se cubría con un inventario de 26 rutas escrito a mano que llevaba tiempo sin
 * corresponderse con el disco; ahora la lista la da el propio árbol de páginas.
 */
export function verifyRouteAccess(root) {
  const source = readFileSync(join(root, 'src/auth/route-access.ts'), 'utf8');
  const rules = [...source.matchAll(/pattern:\s*(\/\^.*?\/)\s*,/g)].map((match) => {
    const literal = match[1];
    return {
      literal,
      expression: new RegExp(literal.slice(1, literal.lastIndexOf('/'))),
      matched: false,
    };
  });
  if (!rules.length) return ['No se pudo leer ninguna regla de src/auth/route-access.ts'];

  const failures = [];
  for (const route of portalRoutes(join(root, 'src/app/(portal)'))) {
    // Un parámetro dinámico se sustituye por un valor cualquiera: los patrones
    // se escriben contra la ruta ya resuelta, no contra el nombre del segmento.
    const resolved = route.replace(/\[[^\]]*\]/g, 'sample-id') || '/';
    const rule = rules.find((candidate) => candidate.expression.test(resolved));
    if (rule) rule.matched = true;
    else failures.push(`La ruta ${resolved} no tiene regla en src/auth/route-access.ts`);
  }

  for (const rule of rules.filter((candidate) => !candidate.matched)) {
    failures.push(`La regla ${rule.literal} de route-access.ts ya no protege ninguna ruta`);
  }
  return failures;
}

/** Rutas de `(portal)`, en la forma en que las ve el navegador. */
function portalRoutes(directory, prefix = '') {
  const routes = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...portalRoutes(join(directory, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === 'page.next.tsx') {
      routes.push(prefix);
    }
  }
  return routes;
}
