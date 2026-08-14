import { Gauge, Inbox, ListTree, SquareTerminal, UserSearch } from 'lucide-react';
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
    id: 'pendientes',
    label: 'Pendientes',
    icon: Inbox,
    hint: 'Valores que el motor recibió y no pudo clasificar con confianza suficiente.',
  },
  {
    id: 'revision',
    label: 'Revisión',
    icon: UserSearch,
    hint: 'Verificaciones que el motor no resolvió solo: el parecido quedó en la franja ambigua y una persona tiene que decidir.',
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

/**
 * El cuaderno de datos tampoco es un worker del motor.
 *
 * Ni siquiera lee del motor: sus datos vienen de la superficie `read_api` de AtlasBackend, y su
 * Python y su JavaScript corren en la propia pestaña. Está aquí porque «Procesamiento» es donde
 * se busca una herramienta que trabaja sobre los datos, no porque comparta nada con los cuatro
 * workers: no tiene catálogo, ni cola, ni ejecuciones que seguir.
 */
export const CUADERNO_DATOS = 'data-notebook' as const;

export type TabCode = WorkerCode | typeof GENERADOR_DOCUMENTAL | typeof CUADERNO_DATOS;

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

/** El único con franja de revisión humana entre sus dos umbrales. */
const REVISAN: readonly TabCode[] = ['identity-verification'];

/**
 * Los que no tienen panel porque no hay nada que vigilar.
 *
 * El panel responde «¿está sano el worker?» leyendo su salud, su latencia y su cola en el motor.
 * El cuaderno no tiene ninguna de las tres: no hay servicio que se caiga ni trabajos que se
 * acumulen. Enseñarle un panel obligaría a inventar un estado —y un panel siempre en verde sobre
 * algo que no se mide es peor que no tenerlo, porque se lee como una comprobación hecha.
 */
const SOLO_CONSOLA: readonly TabCode[] = [CUADERNO_DATOS];

export function viewsFor(worker: TabCode): readonly WorkerView[] {
  return WORKER_VIEWS.filter((view) => {
    if (SOLO_CONSOLA.includes(worker)) return view.id === 'consola';
    if (VISTAS_DEL_CATALOGO.includes(view.id)) return CLASIFICAN.includes(worker);
    if (view.id === 'revision') return REVISAN.includes(worker);
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
