import { Bot, Goal, NotebookPen, ShieldCheck, TerminalSquare } from 'lucide-react';
import { accessPolicies } from '../auth/access-policies';
import { WORKER_MENU } from '../features/workers/worker-menu';
import type { NavigationSection } from './navigation-types';

/**
 * Las dos últimas secciones del menú.
 *
 * Viven aparte por el tope de 299 líneas del repositorio, y el corte va por donde menos
 * duele: «Procesamiento» y «Trazabilidad» son las dos secciones que no describen el ciclo
 * de vida de una decisión —el resto sí, de Diseño a Auditoría, y partir esa secuencia por
 * la mitad haría más difícil leer el menú entero que tenerlo en dos archivos.
 */
export const navigationTail: readonly NavigationSection[] = [
  {
    /*
     * «Procesamiento» es donde se TRABAJA CON los datos: las herramientas, juntas.
     *
     * La sección nació (ADR-0026) agrupando los workers. Con la consola SQL se intentó
     * afinarla a «examinar lo ya decidido» y los workers se mudaron a «Operación», por el
     * argumento de que un worker no examina nada sino que produce un insumo. La distinción
     * es cierta y aun así el menú salió peor: quien viene a trabajar sobre datos —consultar,
     * analizar, procesar un documento— tenía que saber de antemano que unas herramientas
     * estaban aquí y otras dos secciones más arriba. Se revierte esa mudanza a petición
     * explícita: el criterio de esta sección es la HERRAMIENTA, no la fase de la decisión.
     *
     * El cuaderno de datos tiene entrada Y RUTA propias (`/data-notebook`). No es lo que ADR-0026
     * evitaba —una entrada por worker—: el cuaderno no es un worker. No lee del motor, no tiene
     * catálogo ni cola, sus datos salen de AtlasBackend y de las vistas gobernadas del motor, y su
     * código corre en la pestaña. Como pestaña de `/workers` era la única sin panel de salud, que
     * es la forma en que una pantalla dice «yo no soy de esta familia».
     */
    label: 'Procesamiento',
    items: [
      {
        label: 'Consultas SQL',
        path: '/sql-console',
        icon: TerminalSquare,
        roles: accessPolicies.sqlConsole,
      },
      {
        /*
         * Una entrada que se DESPLIEGA en los cinco workers.
         *
         * Nació como entrada única (ADR-0026) contra el riesgo de que cada worker nuevo
         * añadiera una línea suelta al menú, y el concentrador resolvía eso con una fila de
         * pestañas dentro de la página. El precio salió más caro que el problema: elegir
         * worker es lo PRIMERO que se hace al entrar, y estaba a un nivel más abajo que
         * elegir qué mirar de él —panel, consola, categorías—, de modo que la pantalla
         * abría dos filas de pestañas seguidas sin decir cuál mandaba sobre cuál.
         *
         * Desplegándolos aquí el menú vuelve a decir la verdad: los cinco son destinos, no
         * estados internos de una pantalla. El riesgo original sigue cubierto —el grupo se
         * pliega y ocupa una línea— y las rutas de cada worker no cambian: ya existían.
         */
        label: 'Workers',
        path: '/workers',
        icon: Bot,
        roles: accessPolicies.workers,
        children: WORKER_MENU.map((worker) => ({
          label: worker.short,
          path: worker.path,
          icon: worker.icon,
          // El mismo permiso que el grupo, y a propósito: `route-access.ts` ya da a las
          // cinco rutas `accessPolicies.workers`. Que el menú pidiera otra cosa enseñaría
          // enlaces que llevan a un «no autorizado», o escondería páginas que sí se pueden
          // abrir escribiendo la dirección.
          roles: accessPolicies.workers,
        })),
      },
      {
        label: 'Cuaderno de datos',
        path: '/data-notebook',
        icon: NotebookPen,
        roles: accessPolicies.dataNotebook,
      },
    ],
  },
  {
    label: 'Trazabilidad',
    items: [
      {
        label: 'Objetivos',
        path: '/objectives',
        icon: Goal,
        roles: accessPolicies.traceability,
      },
      {
        label: 'Matriz de Cobertura',
        path: '/coverage-matrix',
        icon: ShieldCheck,
        roles: accessPolicies.traceability,
      },
    ],
  },
] as const;
