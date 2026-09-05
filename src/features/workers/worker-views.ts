import {
  Gauge,
  Inbox,
  Landmark,
  ListTree,
  Settings2,
  SquareTerminal,
  UserSearch,
} from 'lucide-react';
import type { WorkerCode } from './workers.api';

/**
 * Las caras de un worker, y cuáles tiene cada uno.
 *
 * Vive aparte de `WorkersPage` para poder comprobarse sin montar la página: la
 * regla de abajo es una decisión de producto —qué se le ofrece a quién— y una
 * decisión así no debería depender de que alguien abra el navegador para notar
 * que cambió.
 */

export const WORKER_VIEWS = [
  {
    id: 'panel',
    label: 'Panel de control',
    icon: Gauge,
    hint: 'Salud, latencia, cola de procesos e incidencias de este worker.',
  },
  {
    id: 'consola',
    label: 'Consola',
    icon: SquareTerminal,
    hint: 'Enviar trabajo a este worker y ver su resultado.',
  },
  {
    id: 'categorias',
    label: 'Categorías',
    icon: ListTree,
    hint: 'El árbol contra el que este worker clasifica: crearlo, corregirlo o inyectarlo desde JSON.',
  },
  {
    id: 'entidades',
    label: 'Entidades financieras',
    icon: Landmark,
    hint: 'El padrón de entidades bolivianas contra el que este worker decide de quién es un extracto.',
  },
  {
    id: 'pendientes',
    label: 'Pendientes',
    icon: Inbox,
    hint: 'Valores que el motor recibió y no pudo clasificar con confianza suficiente.',
  },
  {
    id: 'revision',
    label: 'Pendientes de revisión',
    icon: UserSearch,
    hint: 'Casos que el motor no resolvió solo porque la duda era real. Lo que claramente no era el documento esperado se rechaza y no llega aquí.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings2,
    hint: 'Qué gateway y qué modelo de lenguaje atienden este worker. Se cambia en caliente, sin desplegar.',
  },
] as const;

export type WorkerView = (typeof WORKER_VIEWS)[number];

/**
 * El generador documental ocupa una pestaña más, pero NO es un worker del motor.
 *
 * Los cuatro workers comparten catálogo (`/v1/workers/…`), métricas y mapa de
 * ejecuciones —por eso un solo panel sirve para los cuatro—; el generador vive
 * en `/pdf/*`, con su propia sonda y sin ejecuciones que seguir. Por eso su
 * código no pertenece a `WorkerCode`: meterlo ahí obligaría a que cada consulta
 * al catálogo se acordara de excluirlo, y la que se olvidara pediría al motor un
 * worker que no existe.
 *
 * Está aquí porque este módulo es el que sabe qué pestañas hay en «Procesamiento».
 */
export const GENERADOR_DOCUMENTAL = 'pdf-generator' as const;

export type TabCode = WorkerCode | typeof GENERADOR_DOCUMENTAL;

/**
 * Categorías y Pendientes son de quien CLASIFICA contra el árbol, no de quien
 * lo guarda.
 *
 * Las dos hablan del mismo catálogo: una lo edita y la otra recoge lo que no se
 * pudo clasificar contra él. El semántico es su dueño, pero no su único
 * consumidor: la consola de extractos clasifica cada movimiento contra ese
 * mismo árbol (`useStatementCategories` encadena cada glosa con el semántico,
 * porque el motor no publica una ruta «extracto → categorías»). Dárselas sólo
 * al semántico dejaba al de extractos enseñando «Sin determinar» sin ninguna
 * forma de llegar, desde ahí, ni al árbol que hay que corregir ni a la bandeja
 * donde cae lo que no encajó — que es justamente el trabajo que sigue a mirar
 * un extracto clasificado.
 *
 * Los otros dos siguen sin ellas y por el mismo criterio, no por omisión: el de
 * identidad compara dos caras y el de locución dice una frase; ninguno consulta
 * el catálogo, así que ofrecérselas prometería una relación que no existe.
 *
 * «Revisión» es la bandeja ANÁLOGA del worker de identidad, y sólo suya: sus
 * casos ambiguos no son valores sin categoría sino verificaciones cuyo parecido
 * cayó entre los dos umbrales calibrados, que el motor manda a una persona en
 * vez de resolver a la fuerza. Dársela a los demás prometería una franja de
 * revisión que sus contratos no tienen.
 *
 * Es una lista y no un `if` por pestaña porque son la misma decisión tomada una
 * vez: lo que depende del catálogo de categorías se le ofrece a quien lo usa.
 */
const VISTAS_DEL_CATALOGO: readonly string[] = ['categorias', 'pendientes'];

/** Los que clasifican contra el catálogo de categorías. */
const CLASIFICAN: readonly TabCode[] = ['semantic-analysis', 'bank-statement'];

/**
 * Los que tienen franja de revisión humana, y la tienen por el mismo motivo con
 * dos formas distintas.
 *
 * En identidad la franja está entre los dos umbrales de parecido; en extractos,
 * entre los dos umbrales de clasificación del documento —y además cubre el
 * timeout, la baja confianza de extracción y el descuadre contable—. Lo que
 * comparten es la regla que hace que la bandeja sirva de algo: **sólo entra lo
 * ambiguo**. Lo que el motor sabe rechazar, lo rechaza, y quien lo subió se
 * entera en el momento en vez de esperar a que una persona mire una factura.
 *
 * Los otros dos siguen sin ella, y por criterio: locución y clasificación
 * semántica no tienen una franja donde el motor se niegue a decidir —el
 * semántico tiene «Pendientes», que es otra cosa: valores sin categoría, no
 * documentos sin veredicto—.
 */
const REVISAN: readonly TabCode[] = ['identity-verification', 'bank-statement'];

/**
 * El padrón de entidades es SÓLO del worker de extractos, y no por omisión.
 *
 * Es la lista contra la que ese worker decide de quién es un documento: un
 * extracto que no se atribuye a ninguna entidad con licencia de ASFI no se
 * procesa. Ningún otro worker tiene esa pregunta —el semántico clasifica texto,
 * identidad compara dos caras, locución dice una frase—, así que ofrecérsela
 * prometería una relación que no existe.
 *
 * Está junto a «Categorías» y no en una sección de ajustes por el mismo motivo
 * que aquélla: es donde se descubre que hace falta. El motor rechaza un extracto
 * por emisor no reconocido, y el arreglo está a una pestaña de distancia.
 */
const ADMINISTRAN_PADRON: readonly TabCode[] = ['bank-statement'];

/**
 * La configuración del modelo es SÓLO del semántico, y no por omisión.
 *
 * Es el único worker que habla con un modelo de lenguaje: identidad compara
 * caras con Tesseract y Human en local, locución tiene su propio proveedor de
 * voz, y extractos no llama a ningún modelo por su cuenta —cada glosa se la
 * manda al semántico—. Ofrecer «qué modelo usar» en los demás prometería una
 * palanca que sus contratos no tienen. Y el de extractos, que sí depende del
 * modelo, tampoco la tiene aquí: la elección es del worker dueño, y dos
 * pestañas que escriben la misma fila desde dos sitios es una forma de que
 * alguien la cambie sin saber desde dónde.
 */
const CONFIGURAN_MODELO: readonly TabCode[] = ['semantic-analysis'];

export function viewsFor(worker: TabCode): readonly WorkerView[] {
  return WORKER_VIEWS.filter((view) => {
    if (VISTAS_DEL_CATALOGO.includes(view.id)) return CLASIFICAN.includes(worker);
    if (view.id === 'entidades') return ADMINISTRAN_PADRON.includes(worker);
    if (view.id === 'revision') return REVISAN.includes(worker);
    if (view.id === 'configuracion') return CONFIGURAN_MODELO.includes(worker);
    return true;
  });
}

/**
 * La pestaña en la que hay que estar.
 *
 * Quien esté en «Categorías» o «Pendientes» y cambie a otro worker no puede
 * quedarse en una pestaña que ahí no existe: cae al panel, que es lo que todos
 * tienen.
 */
export function resolveView(worker: TabCode, requested: string): string {
  const disponibles = viewsFor(worker);
  if (disponibles.some((view) => view.id === requested)) return requested;
  // Cae a la PRIMERA vista que ese worker tenga, no a «panel»: el cuaderno no tiene panel, y
  // devolver un identificador que no está en su lista dejaba la pestaña vacía sin explicación.
  return disponibles[0]?.id ?? 'panel';
}
