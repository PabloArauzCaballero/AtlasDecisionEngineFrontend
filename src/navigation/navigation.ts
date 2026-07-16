import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Boxes,
  Braces,
  ClipboardCheck,
  Database,
  FileSearch,
  FlaskConical,
  GitBranch,
  Goal,
  History,
  ListChecks,
  Play,
  Rocket,
  ScanSearch,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';

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
    items: [{ label: 'Platform Health', path: '/platform-health', icon: Activity, roles: [] }],
  },
  {
    label: 'Diseño',
    items: [
      {
        label: 'Variables',
        path: '/variables',
        icon: Database,
        roles: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'],
      },
      {
        label: 'Reason Codes',
        path: '/reason-codes',
        icon: Braces,
        roles: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'],
      },
      {
        label: 'Artefactos',
        path: '/artifacts',
        icon: Boxes,
        roles: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST', 'AUDITOR'],
      },
      {
        label: 'Editor de Grafo',
        path: '/graph-editor',
        icon: GitBranch,
        roles: ['RISK_ANALYST', 'FRAUD_ANALYST'],
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
        roles: ['QA_ANALYST', 'RISK_ANALYST', 'FRAUD_ANALYST'],
      },
      {
        label: 'Casos de Prueba',
        path: '/test-cases',
        icon: ListChecks,
        roles: ['QA_ANALYST', 'RISK_ANALYST', 'FRAUD_ANALYST'],
      },
      {
        label: 'Cobertura',
        path: '/graph-coverage',
        icon: ShieldCheck,
        roles: ['QA_ANALYST', 'RISK_ANALYST', 'AUDITOR'],
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
        roles: ['QA_ANALYST', 'RISK_APPROVER', 'COMPLIANCE', 'AUDITOR'],
      },
      {
        label: 'Ambientes',
        path: '/environments',
        icon: Rocket,
        roles: ['PLATFORM_ADMIN', 'RISK_ANALYST', 'QA_ANALYST', 'AUDITOR'],
      },
      {
        label: 'Despliegues',
        path: '/deployments',
        icon: History,
        roles: ['PLATFORM_ADMIN', 'RISK_ANALYST', 'QA_ANALYST', 'AUDITOR'],
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
        roles: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST'],
      },
      {
        label: 'Revisión Manual',
        path: '/manual-reviews',
        icon: ScanSearch,
        roles: ['OPERATIONS', 'RISK_ANALYST', 'FRAUD_ANALYST'],
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
        roles: ['AUDITOR', 'COMPLIANCE', 'RISK_ANALYST', 'OPERATIONS'],
      },
      {
        label: 'Bitácora',
        path: '/audit-events',
        icon: ScrollText,
        roles: ['AUDITOR', 'COMPLIANCE', 'RISK_ANALYST'],
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
        roles: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'],
      },
      {
        label: 'Matriz de Cobertura',
        path: '/coverage-matrix',
        icon: ShieldCheck,
        roles: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'],
      },
    ],
  },
] as const;
