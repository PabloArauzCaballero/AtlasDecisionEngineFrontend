import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Boxes,
  Braces,
  Calculator,
  ClipboardCheck,
  Database,
  FileCode2,
  FileSearch,
  FlaskConical,
  GitBranch,
  Goal,
  GraduationCap,
  History,
  Layers,
  Library,
  ListChecks,
  Play,
  Radio,
  Rocket,
  ScanSearch,
  ScrollText,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { accessPolicies } from '../auth/access-policies';

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: readonly string[];
}

export interface NavigationSection {
  label: string;
  items: readonly NavigationItem[];
}

export const navigation: readonly NavigationSection[] = [
  {
    label: 'Plataforma',
    items: [
      {
        label: 'Platform Health',
        path: '/platform-health',
        icon: Activity,
        roles: accessPolicies.platformHealth,
      },
      {
        /*
         * La búsqueda global vivía SÓLO en la caja de la barra superior, y esa
         * caja se oculta por debajo de 820 px por falta de sitio. Resultado: en
         * un teléfono no había forma de llegar a `/search`, porque no estaba en
         * ninguna otra parte de la navegación —a diferencia de «Dashboard»,
         * «Workspaces» y «Analytics», que sí se ocultan pero apuntan a rutas que
         * el cajón ya lista—.
         *
         * Aquí no se duplica una vista, se le da el único acceso que tenía y que
         * desaparecía al estrechar la pantalla.
         */
        label: 'Búsqueda Global',
        path: '/search',
        // El mismo icono que ya usa la caja de la barra superior
        // (`GlobalSearchBox`): son la misma cosa vista desde dos sitios.
        icon: Search,
        roles: accessPolicies.globalSearch,
      },
      {
        label: 'Centro de Tutoriales',
        path: '/tutorials',
        icon: GraduationCap,
        roles: accessPolicies.tutorials,
      },
    ],
  },
  {
    label: 'Diseño',
    items: [
      {
        label: 'Variables',
        path: '/variables',
        icon: Database,
        roles: accessPolicies.catalogRead,
      },
      {
        label: 'Campos Calculados',
        path: '/calculated-fields',
        icon: Calculator,
        roles: accessPolicies.calculatedFields,
      },
      {
        label: 'Librerías Autorizadas',
        path: '/libraries',
        icon: Library,
        roles: accessPolicies.libraryRegistry,
      },
      {
        label: 'Reason Codes',
        path: '/reason-codes',
        icon: Braces,
        roles: accessPolicies.catalogRead,
      },
      {
        label: 'Artefactos',
        path: '/artifacts',
        icon: Boxes,
        roles: accessPolicies.artifacts,
      },
      {
        label: 'Algoritmos y Versiones',
        path: '/algorithms',
        icon: Layers,
        roles: accessPolicies.artifacts,
      },
      {
        label: 'Editor de Grafo',
        path: '/graph-editor',
        icon: GitBranch,
        roles: accessPolicies.graphAuthoring,
      },
      {
        label: 'Acciones',
        path: '/actions',
        icon: Zap,
        roles: accessPolicies.graphAuthoring,
      },
      {
        label: 'Importar Código',
        path: '/code-import',
        icon: FileCode2,
        roles: accessPolicies.codeImport,
      },
    ],
  },
  {
    label: 'Calidad',
    items: [
      {
        label: 'Suites de Prueba',
        path: '/test-suites',
        icon: FlaskConical,
        roles: accessPolicies.qualityAuthoring,
      },
      {
        label: 'Casos de Prueba',
        path: '/test-cases',
        icon: ListChecks,
        roles: accessPolicies.qualityAuthoring,
      },
      {
        label: 'QA Lab',
        path: '/qa-lab',
        icon: ScanSearch,
        roles: accessPolicies.qaLab,
      },
      {
        label: 'Cobertura',
        path: '/graph-coverage',
        icon: ShieldCheck,
        roles: accessPolicies.coverageRead,
      },
    ],
  },
  {
    label: 'Gobierno',
    items: [
      {
        label: 'Revisiones',
        path: '/reviews',
        icon: ClipboardCheck,
        roles: accessPolicies.governanceReview,
      },
      {
        label: 'Ambientes',
        path: '/environments',
        icon: Rocket,
        roles: accessPolicies.environments,
      },
      {
        label: 'Despliegues',
        path: '/deployments',
        icon: History,
        roles: accessPolicies.environments,
      },
    ],
  },
  {
    label: 'Operación',
    items: [
      {
        label: 'Simulador',
        path: '/simulator',
        icon: Play,
        roles: accessPolicies.simulator,
      },
      {
        label: 'Ejecución en Vivo',
        path: '/live-execution',
        icon: Radio,
        roles: accessPolicies.simulator,
      },
      {
        label: 'Revisión Manual',
        path: '/manual-reviews',
        icon: ScanSearch,
        roles: accessPolicies.manualReview,
      },
    ],
  },
  {
    label: 'Auditoría',
    items: [
      {
        label: 'Ejecuciones',
        path: '/executions',
        icon: FileSearch,
        roles: accessPolicies.executionAudit,
      },
      {
        label: 'Bitácora',
        path: '/audit-events',
        icon: ScrollText,
        roles: accessPolicies.auditEvents,
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
