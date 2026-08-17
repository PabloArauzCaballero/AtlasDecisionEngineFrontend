import { Bot, Goal, NotebookPen, ShieldCheck, TerminalSquare } from 'lucide-react';
import { accessPolicies } from '../auth/access-policies';
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
         * UNA entrada y no una por worker: `/workers` es el concentrador con las pestañas y
         * el panel de control de cada una; los enlaces directos a cada worker no cambian.
         */
        label: 'Workers',
        path: '/workers',
        icon: Bot,
        roles: accessPolicies.workers,
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
