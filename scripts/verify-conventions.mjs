import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

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
 *  - degradados, máscaras y filtros, donde el color suele ser una PARADA de una
 *    rampa o un `#000` que sólo sirve de opacidad, no un color de la paleta.
 *
 * `shadow` y `scrollbar` estaban en esta lista y ya no lo están. Por esa rendija
 * se colaron nueve literales de tema CLARO que ningún `[data-theme='dark']`
 * corregía, y no eran cosméticos: la cabecera anclada de las tablas dibujaba una
 * línea gris clara a media tabla oscura, y el pulgar de la barra de
 * desplazamiento quedaba casi blanco sobre el panel oscuro. Un anillo y una
 * barra SÍ son colores de la paleta —`--ring-*`, `--scrollbar-thumb`—, así que
 * la excepción sobraba. Las sombras de profundidad no se ven afectadas: usan
 * `rgba()`, y aquí sólo se persigue el hexadecimal.
 */
const COLOR_EXCEPTIONS = /--(?:node|concept)-(?:color|soft)\s*:|gradient|mask|filter/;

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
 * Ni un tamaño, peso o familia tipográfica escrito a mano.
 *
 * Es la misma regla que la de color, por el mismo motivo. Había 491
 * declaraciones de `font-size` con 63 valores distintos —`11px`, `11.5px` y
 * `0.72rem` conviviendo para decir lo mismo—, nueve pesos (incluidos 650, 750 y
 * 850) y la pila monoespaciada repetida a mano en seis hojas, tres de ellas con
 * un simple `monospace`, que en Windows es Courier New. Nada de eso se ve al
 * escribirlo: se ve al abrir dos vistas seguidas y notar que no son la misma
 * aplicación.
 *
 * Se permiten:
 *  - `typography.css`, donde vive la escala, y `foundation.css`, que declara la
 *    familia base y `--font-mono`;
 *  - `em`, que es relativo al PADRE y sirve para escalar algo DENTRO de su
 *    texto: sustituirlo por un token absoluto rompería justamente eso;
 *  - `clamp()`, la tipografía fluida de los títulos de display;
 *  - `inherit`, que es lo contrario de inventarse un valor.
 */
const TYPOGRAPHY_SHEETS = new Set(['typography.css', 'foundation.css']);

export function verifyTypographyTokens(root) {
  const failures = [];
  for (const { name, source } of styleSheets(root)) {
    if (TYPOGRAPHY_SHEETS.has(name)) continue;
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
      block.replace(/[^\n]/g, ' '),
    );
    // El valor se captura entero y se descarta en código, no con un lookahead:
    // `\s*` retrocede, así que el lookahead acababa evaluándose sobre un espacio
    // —que nunca es `var(`— y daba por bueno todo lo que pretendía rechazar.
    const offenders = [
      [/font-size:\s*([^;{}]+)/g, 'tamaño'],
      [/font-weight:\s*([^;{}]+)/g, 'peso'],
      [/font-family:\s*([^;{}]+)/g, 'familia'],
    ];
    for (const [pattern, kind] of offenders) {
      for (const match of withoutComments.matchAll(pattern)) {
        const value = match[1].trim();
        if (value.startsWith('var(') || value === 'inherit') continue;
        // `em` es relativo al padre y `clamp()` es tipografía fluida: los dos
        // dicen algo que un escalón fijo no puede decir.
        if (kind === 'tamaño' && (/[\d.]em\b/.test(value) || value.startsWith('clamp('))) continue;
        const line = withoutComments.slice(0, match.index).split('\n').length;
        failures.push(
          `${STYLE_PARTS}/${name}:${line} escribe el ${kind} tipográfico ` +
            `\`${value}\` a mano; usa la escala de typography.css`,
        );
      }
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

/**
 * El permiso de una sesión son SUS DOS listas de roles.
 *
 * El proveedor de identidad emite `roles` y `legacyRoles` por separado, y una
 * cuenta antigua puede llevar en la segunda toda su autorización. Sumarlas lo
 * hacían el guardia de ruta, el menú y el centro de tutoriales; NO lo hacía
 * ninguna comprobación de capacidad de dentro de las vistas, que leían
 * `user.roles` a secas. Resultado: quien entraba por un rol heredado pasaba el
 * guardia, veía la entrada del menú, abría la pantalla — y se encontraba todos
 * los botones apagados sin una sola explicación. Sólo les pasaba a las cuentas
 * viejas, que es donde nadie mira.
 *
 * Se arregló con `effectiveRoles()` / `useEffectiveRoles()`, y esta regla existe
 * porque el arreglo es de los que se deshacen solos: el siguiente que escriba
 * una pantalla copiará el `user.roles` del vecino. Aquí se prohíbe leerlo fuera
 * del módulo que lo normaliza.
 */
export function verifyEffectiveRoles(root) {
  const allowed = new Set([
    'src/auth/effective-roles.ts',
    'src/auth/useAuth.ts',
    'src/auth/auth.types.ts',
    'src/auth/auth.schemas.ts',
  ]);
  const failures = [];
  for (const file of sourceTree(join(root, 'src'))) {
    const path = relative(root, file).replaceAll('\\', '/');
    if (allowed.has(path) || path.endsWith('.test.ts') || path.endsWith('.test.tsx')) continue;
    const source = readFileSync(file, 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (/\buser\s*\??\.\s*(roles|legacyRoles)\b/.test(line)) {
        failures.push(
          `${path}:${index + 1} lee user.roles/legacyRoles directamente; ` +
            `usa useEffectiveRoles() (componentes) o effectiveRoles(user) (lógica pura).`,
        );
      }
    });
  }
  return failures;
}

/** Todos los `.ts`/`.tsx` bajo un directorio. */
function sourceTree(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceTree(full));
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}
