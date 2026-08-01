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
  History,
  Layers,
  Library,
  ListChecks,
  Play,
  Radio,
  Rocket,
  ScanSearch,
  ScrollText,
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
