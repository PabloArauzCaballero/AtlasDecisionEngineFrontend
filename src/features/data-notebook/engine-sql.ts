/**
 * Las DOS únicas sentencias que el cuaderno compone para el motor, y las cinco puertas que cruzan.
 *
 * El cuaderno lee las vistas gobernadas del motor a través de `/v1/sql-console/query`, y para eso
 * hay que escribir un `SELECT`. Ese texto es el único SQL que este repositorio construye, así que
 * es también el único sitio donde podría existir una inyección — y por eso vive solo, es puro y
 * tiene pruebas: componiéndolo entre medias de una llamada de red, la regla se revisa cuando alguien
 * se acuerda, y aquí se revisa cuando cambia el archivo.
 *
 * ## Qué se admite, dicho por lo que se RECHAZA
 *
 *  1. **La relación tiene que estar en el catálogo del motor.** No basta con que tenga la forma de
 *     un identificador: `pg_catalog.pg_authid` la tiene. Se compara contra lo que el motor dijo que
 *     publica, así que lo que no descubrió no se puede nombrar. Ésta es la puerta que importa; las
 *     demás la protegen de sus propios descuidos.
 *  2. **Los identificadores se citan y se duplican las comillas internas.** No es la defensa contra
 *     la inyección —lo es la anterior— sino lo que evita que una vista llamada `order` rompa la
 *     sentencia. Una defensa que depende de que la capa anterior nunca falle no es una defensa.
 *  3. **La columna de orden tiene que ser una columna DE ESA relación.** Un identificador no admite
 *     parámetro en Postgres, así que se interpola; lo que se interpola sale del catálogo.
 *  4. **Los números son enteros acotados**, comprobados con `Number.isSafeInteger`. `pageSize` y
 *     `offset` van al texto porque el endpoint del motor no recibe parámetros, y un `NaN` o un
 *     `1e21` heredados de un cálculo se habrían escrito tal cual dentro del `LIMIT`.
 *  5. **La sentencia terminada vuelve a comprobarse contra una forma exacta.** Es redundante hoy y
 *     ésa es la idea: el día que alguien añada un filtro por aquí, esta línea falla en las pruebas
 *     antes de que el texto llegue al motor.
 *
 * Y por debajo siguen estando las del motor, que no se tocan: rol de sólo lectura, transacción
 * `READ ONLY`, guardia léxica, inspección del plan y bitácora de cada consulta, incluidas las
 * rechazadas.
 */

/** Filas por página. El techo lo impone además el motor; aquí se acota antes de escribir el texto. */
export const MAX_FILAS = 500;

/**
 * Desplazamiento máximo.
 *
 * Un `OFFSET` enorme no es un problema de seguridad sino de coste: Postgres recorre y descarta esas
 * filas antes de devolver nada. Se corta donde el paginador de la pantalla deja de tener sentido.
 */
export const MAX_DESPLAZAMIENTO = 1_000_000;

/**
 * Techo del recuento, en filas.
 *
 * Un `COUNT(*)` sin acotar sobre una vista grande cuesta lo mismo que leerla entera, y se pagaría en
 * CADA cambio de página para pintar un número al pie. Contando dentro de un `LIMIT`, el coste queda
 * acotado y el denominador sigue a la vista; pasado el techo se dice «más de N».
 */
export const TECHO_RECUENTO = 100_000;

/** Nombre de esquema o de tabla tal y como Postgres los admite sin citar. */
const IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/u;

/**
 * La forma EXACTA que puede tener una sentencia salida de aquí.
 *
 * Se comprueba sobre el resultado, no sobre las entradas. Es la única guarda que sigue valiendo si
 * mañana alguien añade un parámetro nuevo y se olvida de validarlo: el texto deja de encajar.
 */
const FORMA_PAGINA =
  /^SELECT \* FROM "[^"]+"\."[^"]+"( ORDER BY "[^"]+" (?:ASC|DESC))? LIMIT \d+ OFFSET \d+$/u;
const FORMA_RECUENTO =
  /^SELECT count\(\*\) AS total FROM \(SELECT 1 FROM "[^"]+"\."[^"]+" LIMIT \d+\) t$/u;

export interface PeticionPagina {
  /** `esquema.tabla`, tal como lo publica el catálogo del motor. */
  relacion: string;
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/** Lo que el motor publica: por relación, sus columnas. Es la lista blanca de este módulo. */
export type CatalogoMotor = ReadonlyMap<string, ReadonlySet<string>>;

export class RelacionNoPermitida extends Error {}

/**
 * Cita un identificador ya verificado, duplicando la comilla interna como manda Postgres.
 *
 * Se aplica aunque el nombre venga del catálogo: ver la puerta 2 de la cabecera.
 */
function citar(valor: string): string {
  return `"${valor.replace(/"/gu, '""')}"`;
}

function entero(valor: number, minimo: number, maximo: number, campo: string): number {
  if (!Number.isSafeInteger(valor)) {
    throw new RelacionNoPermitida(`El valor de «${campo}» no es un entero utilizable.`);
  }
  return Math.min(Math.max(valor, minimo), maximo);
}

/**
 * Resuelve la relación contra el catálogo y devuelve sus dos partes ya verificadas.
 *
 * La comparación es en minúsculas porque así las publica el motor y así se escriben; la relación
 * que se cita es la del CATÁLOGO, no la que llegó — de modo que ni siquiera una diferencia de
 * mayúsculas puede colar un nombre distinto del comprobado.
 */
export function resolverRelacion(relacion: string, catalogo: CatalogoMotor): [string, string] {
  const clave = relacion.trim().toLowerCase();
  if (!catalogo.has(clave)) {
    throw new RelacionNoPermitida(
      `El motor no publica la relación «${relacion}». Es posible que el cuaderno apunte a una vista que ya no existe: elige otro dataset en el panel de la izquierda.`,
    );
  }
  const [esquema, tabla] = clave.split('.');
  if (!IDENTIFICADOR.test(esquema ?? '') || !IDENTIFICADOR.test(tabla ?? '')) {
    // El catálogo del motor no debería publicar algo así; si lo hace, no se consulta.
    throw new RelacionNoPermitida(`El nombre «${relacion}» no es una relación consultable.`);
  }
  return [esquema, tabla];
}

/**
 * `ORDER BY`, o nada.
 *
 * La columna se BUSCA en el catálogo y lo que se escribe es la que estaba allí, no la que llegó:
 * así ni una diferencia de mayúsculas puede colar un texto distinto del comprobado. Un identificador
 * no admite parámetro en Postgres, de modo que interpolarlo es inevitable — lo que sí es evitable es
 * interpolar algo que no salga de una lista cerrada.
 */
function clausulaDeOrden(peticion: PeticionPagina, clave: string, catalogo: CatalogoMotor): string {
  if (!peticion.orderBy) return '';
  const pedida = peticion.orderBy.trim().toLowerCase();
  if (!catalogo.get(clave)?.has(pedida)) {
    throw new RelacionNoPermitida(
      `«${peticion.orderBy}» no es una columna de ${clave}, así que no se puede ordenar por ella.`,
    );
  }
  // Una de dos constantes, elegida por comparación: nunca la cadena que llegó.
  const direccion = peticion.orderDirection === 'ASC' ? 'ASC' : 'DESC';
  return ` ORDER BY ${citar(pedida)} ${direccion}`;
}

/**
 * Las dos sentencias de una página: las filas y el recuento acotado.
 *
 * Se devuelven juntas porque se piden juntas y comparten la relación ya verificada. Componerlas por
 * separado abriría la puerta a que una de las dos se construyera sin pasar por aquí, que es
 * exactamente cómo aparecen estos fallos.
 */
export function sentenciasDePagina(
  peticion: PeticionPagina,
  catalogo: CatalogoMotor,
): { pagina: string; recuento: string } {
  const [esquema, tabla] = resolverRelacion(peticion.relacion, catalogo);
  const clave = `${esquema}.${tabla}`;
  const citada = `${citar(esquema)}.${citar(tabla)}`;

  const filas = entero(peticion.pageSize, 1, MAX_FILAS, 'pageSize');
  const pagina = entero(peticion.page, 1, Number.MAX_SAFE_INTEGER, 'page');
  const desplazamiento = entero((pagina - 1) * filas, 0, MAX_DESPLAZAMIENTO, 'offset');
  const orden = clausulaDeOrden(peticion, clave, catalogo);

  const consulta = `SELECT * FROM ${citada}${orden} LIMIT ${filas} OFFSET ${desplazamiento}`;
  const recuento = `SELECT count(*) AS total FROM (SELECT 1 FROM ${citada} LIMIT ${TECHO_RECUENTO}) t`;

  if (!FORMA_PAGINA.test(consulta) || !FORMA_RECUENTO.test(recuento)) {
    throw new RelacionNoPermitida(
      'La consulta compuesta no tiene la forma admitida y no se envía. Es un defecto del cuaderno, no de los datos.',
    );
  }

  return { pagina: consulta, recuento };
}
