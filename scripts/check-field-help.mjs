#!/usr/bin/env node
/**
 * Guardián: ningún campo sin «qué poner», ninguna opción sin «qué significa».
 *
 * Hasta el 2026-09-15 el portal del motor tenía 116 `<select>` nativos y ~160 campos con la
 * etiqueta a secas: un `<option>` no admite explicación y `title=` no se pinta en Safari ni lo lee
 * un lector de pantalla. Lo que significaba cada opción vivía en mapas `*_HELP` pintados aparte o en
 * comentarios del código. Esto impide que vuelva.
 *
 * Falla (salida 1, con `ruta:línea` y motivo) si en `src/`:
 *   1. un `<Field`, `<FieldRow`, `<CheckField` o `<FieldLabel` no lleva `tooltip=`;
 *   2. una opción de un catálogo (`{ value, label }`) no lleva `description`;
 *   3. un tooltip o una descripción repite la etiqueta (normalizada, sin tildes ni mayúsculas) o
 *      tiene menos de cuatro palabras;
 *   4. aparece un `<select>` o un `<option>` nativos, que no admiten descripción por fila;
 *   5. aparece un `<label>` suelto fuera de `FieldLabel`: la etiqueta de un campo se pinta con
 *      `FieldLabel` o `Field`, que además colocan el ⓘ FUERA del `<label>` (si queda dentro, su
 *      nombre entra en el nombre accesible del campo y rompe los `getByLabel` de los E2E).
 *
 * Excepción legítima: `// sin-ayuda: <motivo>` en la línea del hallazgo o en la de encima. Es para
 * catálogos de nombres propios (ciudades, bancos) y para opciones derivadas de los datos sin mapa
 * de dominio, donde inventar un significado sería peor que no ponerlo.
 *
 * Modo aviso mientras se rellena una pantalla: `AYUDA_AVISO=1`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = (process.env.AYUDA_DIRS ?? 'src').split(',');
const EXCEPCION = /(\/\/|\/\*)\s*sin-ayuda:/;
const ATOMOS = /<(Field|FieldRow|CheckField|FieldLabel)\b/g;
/** Los únicos archivos que pueden pintar la etiqueta y el desplegable a mano: los definen. */
const DEFINE_ETIQUETA = /src\/components\/(Field|FieldLabel|FieldRow)\.tsx$/;
const DEFINE_SELECT = /src\/components\/(OptionSelect|OptionSelectList)\.tsx$/;
/** Los envoltorios que reciben el tooltip de quien los usa. */
const ENVUELVE_SELECT = /src\/components\/(Field|FieldRow|PickerSelect|FilterSelect)\.tsx$/;

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function archivos(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(tsx?|jsx?)$/.test(entrada) && !/\.(test|spec)\.[jt]sx?$/.test(entrada))
      salida.push(ruta);
  }
  return salida;
}

/** El bloque equilibrado que empieza en `inicio` (un `{…}` o un `[…]`). */
function bloqueDesde(texto, inicio, abre = '{', cierra = '}') {
  let profundidad = 0;
  let enCadena = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) {
      if (c === '\\') i += 1;
      else if (c === enCadena) enCadena = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      enCadena = c;
      continue;
    }
    if (c === abre) profundidad += 1;
    else if (c === cierra) {
      profundidad -= 1;
      if (profundidad <= 0) return [texto.slice(inicio, i + 1), i + 1];
    }
  }
  return [texto.slice(inicio), texto.length];
}

/**
 * Dónde vive un catálogo de opciones.
 *
 * Sólo se miran los sitios DECLARADOS como `Option` —el tipo único del repo— o el `options=` de un
 * `OptionSelect`. Un `{ label, value }` cualquiera no es una opción: las fichas de datos
 * (`KeyValueGrid`) y las barras de los gráficos usan ese mismo par para PINTAR un dato ya medido,
 * y exigirles una descripción sería pedir texto inventado sobre una cifra.
 */
function catalogos(texto) {
  const regiones = [];
  const inicios = [
    [/:\s*(?:readonly\s+)?Option\[\]\s*=\s*\[/g, '[', ']'],
    [/\)\s*:\s*Option\[\]\s*\{/g, '{', '}'],
    [/\boptions=\{\[/g, '[', ']'],
  ];
  for (const [patron, abre, cierra] of inicios) {
    for (const m of texto.matchAll(patron)) {
      /* El delimitador que abre es el último carácter de la coincidencia: buscarlo desde el
         principio encontraría el `[` de `Option[]`. */
      const inicio = m.index + m[0].length - 1;
      const [, fin] = bloqueDesde(texto, inicio, abre, cierra);
      regiones.push([inicio, fin]);
    }
  }
  return regiones;
}

/** El cierre de una etiqueta JSX: el `>` que no está dentro de `{…}` ni de una cadena. */
function etiquetaDesde(texto, inicio) {
  let llaves = 0;
  let enCadena = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) {
      if (c === enCadena) enCadena = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      enCadena = c;
      continue;
    }
    if (c === '{') llaves += 1;
    else if (c === '}') llaves -= 1;
    else if (c === '>' && llaves === 0) return texto.slice(inicio, i + 1);
  }
  return texto.slice(inicio);
}

const lineaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;

/** El valor de `clave` cuando es una cadena literal; `null` si es dinámico o no está. */
const textoDe = (bloque, clave) => {
  const m = bloque.match(new RegExp(`\\b${clave}[=:]\\s*\\{?\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`));
  return m ? m[2] : null;
};

function malRedactado(texto, etiqueta) {
  /* Una plantilla con `${…}` es texto dinámico: su contenido real no se puede medir aquí. */
  if (texto === null || texto.includes('${')) return null;
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  if (palabras.length < 4) return 'tiene menos de cuatro palabras';
  if (etiqueta && normalizar(texto) === normalizar(etiqueta)) return 'repite la etiqueta';
  return null;
}

/** Una coincidencia dentro de un comentario (`//`, `/*` o una línea de JSDoc) no es código. */
function enComentario(lineas, linea, columna) {
  const texto = lineas[linea - 1] ?? '';
  const antes = texto.slice(0, columna);
  if (/(^\s*\*)|\/\/|\/\*/.test(antes)) return true;
  /* Dentro de un bloque `/* … *\/` que empezó en otra línea (los `{/* … *\/}` de JSX). */
  const previo = lineas.slice(0, linea - 1).join('\n') + '\n' + antes;
  return previo.lastIndexOf('/*') > previo.lastIndexOf('*/');
}

const hallazgos = [];
let camposRevisados = 0;
let opcionesRevisadas = 0;
for (const carpeta of CARPETAS) {
  let lista = [];
  try {
    lista = archivos(join(RAIZ, carpeta));
  } catch {
    continue;
  }
  for (const archivo of lista) {
    const texto = readFileSync(archivo, 'utf8');
    const lineas = texto.split('\n');
    const rel = relative(RAIZ, archivo);
    const exenta = (linea) =>
      EXCEPCION.test(lineas[linea - 1] ?? '') || EXCEPCION.test(lineas[linea - 2] ?? '');
    const columnaDe = (indice) => indice - texto.lastIndexOf('\n', indice - 1) - 1;

    // 4 y 5. elementos nativos que no admiten ayuda por fila.
    const nativos = [
      [
        /<select(?=[\s>/])/g,
        '<select> nativo: un <option> no admite descripción; usa OptionSelect',
      ],
      [
        /<option(?=[\s>/])/g,
        '<option> nativo: su texto no puede llevar descripción; usa OptionSelect',
      ],
      [
        /<label(?=[\s>/])/g,
        '<label> suelto: usa FieldLabel o Field, que dejan el ⓘ fuera de la etiqueta',
      ],
    ];
    for (const [patron, motivo] of nativos) {
      if (motivo.startsWith('<label') && DEFINE_ETIQUETA.test(rel)) continue;
      if (!motivo.startsWith('<label') && DEFINE_SELECT.test(rel)) continue;
      for (const m of texto.matchAll(patron)) {
        const linea = lineaDe(texto, m.index);
        if (enComentario(lineas, linea, columnaDe(m.index))) continue;
        if (exenta(linea)) continue;
        /* La excepción puede quedar dentro de la etiqueta de apertura: Prettier la baja de línea. */
        if (EXCEPCION.test(etiquetaDesde(texto, m.index))) continue;
        if (motivo.startsWith('<label')) {
          /* Una casilla o un radio van DENTRO de su <label>: es el patrón correcto y no hay ⓘ que
             contaminar el nombre accesible. */
          const cierre = texto.indexOf('</label>', m.index);
          const cuerpo = texto.slice(m.index, cierre === -1 ? m.index + 400 : cierre);
          if (/type=["'{](checkbox|radio)/.test(cuerpo) || /type="(checkbox|radio)"/.test(cuerpo))
            continue;
        }
        if (motivo.startsWith('<option')) {
          /* Las sugerencias de un <datalist> no son un desplegable: no hay fila que describir. */
          const abre = texto.lastIndexOf('<datalist', m.index);
          const cierra = texto.lastIndexOf('</datalist>', m.index);
          if (abre !== -1 && abre > cierra) continue;
        }
        hallazgos.push(`${rel}:${linea}  ${motivo}`);
      }
    }

    // 1 y 3. los átomos de campo en JSX.
    for (const m of texto.matchAll(ATOMOS)) {
      const linea = lineaDe(texto, m.index);
      if (enComentario(lineas, linea, columnaDe(m.index))) continue;
      if (exenta(linea)) continue;
      if (m[1] === 'OptionSelect' && ENVUELVE_SELECT.test(rel)) continue;
      const etiqueta = etiquetaDesde(texto, m.index);
      if (EXCEPCION.test(etiqueta)) continue;
      camposRevisados += 1;
      const nombre = textoDe(etiqueta, 'label') ?? textoDe(etiqueta, 'name') ?? '?';
      if (!/\btooltip=/.test(etiqueta)) {
        hallazgos.push(
          `${rel}:${linea}  <${m[1]}> «${nombre}» sin tooltip: di qué poner y por qué importa`,
        );
        continue;
      }
      const motivo = malRedactado(textoDe(etiqueta, 'tooltip'), nombre);
      if (motivo) {
        hallazgos.push(`${rel}:${linea}  el tooltip de «${nombre}» ${motivo}`);
      }
    }

    // 2 y 3. las opciones de un catálogo, en cualquiera de los dos órdenes.
    const opciones = [
      /\{\s*value:\s*(?:(['"`])(?:\\.|(?!\1).)*\1|[A-Za-z_$][\w$.]*)\s*,\s*label:/g,
      /\{\s*label:\s*(['"`])(?:\\.|(?!\1).)*\1\s*,\s*value:/g,
    ];
    const regiones = catalogos(texto);
    const enCatalogo = (indice) =>
      regiones.some(([desde, hasta]) => indice >= desde && indice < hasta);
    const vistas = new Set();
    for (const patron of opciones) {
      for (const m of texto.matchAll(patron)) {
        if (vistas.has(m.index) || !enCatalogo(m.index)) continue;
        vistas.add(m.index);
        const linea = lineaDe(texto, m.index);
        if (exenta(linea)) continue;
        const [objeto] = bloqueDesde(texto, m.index);
        if (EXCEPCION.test(objeto)) continue;
        opcionesRevisadas += 1;
        const etiqueta = textoDe(objeto, 'label');
        const nombre = etiqueta ?? textoDe(objeto, 'value') ?? '?';
        const descripcion = textoDe(objeto, 'description');
        if (descripcion === null && !/\bdescription:/.test(objeto)) {
          hallazgos.push(
            `${rel}:${linea}  la opción «${nombre}» no tiene description: di qué significa y cuándo elegirla`,
          );
          continue;
        }
        const motivo = malRedactado(descripcion, etiqueta);
        if (motivo) {
          hallazgos.push(`${rel}:${linea}  la description de «${nombre}» ${motivo}`);
        }
      }
    }
  }
}

if (hallazgos.length) {
  const aviso = process.env.AYUDA_AVISO === '1';
  const salida = aviso ? console.warn : console.error;
  salida(
    `check-field-help: ${hallazgos.length} campo(s) u opción(es) sin explicar${aviso ? ' (modo aviso)' : ''}:\n`,
  );
  for (const hallazgo of hallazgos) salida(`  ${hallazgo}`);
  salida(
    '\nVer la cabecera de scripts/check-field-help.mjs para el arreglo o la excepción `// sin-ayuda: <motivo>`.',
  );
  if (!aviso) process.exit(1);
} else {
  console.log(
    `check-field-help: ${camposRevisados} campos dicen qué poner y ${opcionesRevisadas} opciones qué significan.`,
  );
}
