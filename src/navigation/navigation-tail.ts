import { Bot, Goal, ShieldCheck } from 'lucide-react';
import { accessPolicies } from '../auth/access-policies';
import type { NavigationSection } from './navigation-types';

/**
 * Las dos últimas secciones del menú.
 *
 * Viven aparte por el tope de 299 líneas del repositorio, y el corte va por donde menos duele:
 * «Procesamiento» y «Trazabilidad» son las dos secciones que no describen el ciclo de vida de
 * una decisión —el resto sí, de Diseño a Auditoría, y partir esa secuencia por la mitad haría
 * más difícil leer el menú entero que tenerlo en dos archivos.
 */
export const navigationTail: readonly NavigationSection[] = [
  {
    /*
     * ADR-0026 — workers adicionales.
     *
     * Una sección con dos entradas, y no dos entradas sueltas en la raíz: esta
     * navegación agrupa por dominio (Diseño, Calidad, Gobierno, Operación,
     * Auditoría), y dos workers colgando del primer nivel romperían esa lectura.
     * Tampoco se meten en «Operación»: allí vive lo que actúa sobre decisiones
     * en curso, y esto procesa documentos y textos que todavía no lo son.
     */
    label: 'Procesamiento',
    items: [
      {
        /*
         * Una entrada y no una por worker. Eran dos vistas sueltas, cada una
         * con su formulario y nada más: se podía mandar trabajo pero no saber
         * si el worker estaba sano, qué tenía encolado ni con qué fallaba.
         * `/workers` las reúne como pestañas y le da a cada una su panel de
         * control; los enlaces directos a cada worker siguen existiendo.
         */
        label: 'Workers',
        path: '/workers',
        icon: Bot,
        roles: accessPolicies.workers,
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
