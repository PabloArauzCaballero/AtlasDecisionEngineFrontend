import { Goal, ShieldCheck, TerminalSquare } from 'lucide-react';
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
     * «Procesamiento» es donde se TRABAJA CON los datos, no donde se producen.
     *
     * La sección nació (ADR-0026) agrupando los workers, y durante un tiempo fue lo único
     * que había: procesar un documento, clasificar un texto. Con la consola SQL la sección
     * pasa a significar algo más preciso —examinar lo que el motor ya decidió— y los
     * workers dejan de encajar: un worker no examina nada, produce un insumo para una
     * decisión que todavía no se ha tomado.
     *
     * Por eso los workers se mudan a «Operación», junto al simulador y a la revisión
     * manual, que es donde vive lo que ACTÚA sobre trabajo en curso. No se borra la
     * entrada ni se esconde: cambia de sección, y las cinco vistas siguen exactamente
     * donde estaban.
     */
    label: 'Procesamiento',
    items: [
      {
        label: 'Consultas SQL',
        path: '/sql-console',
        icon: TerminalSquare,
        roles: accessPolicies.sqlConsole,
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
