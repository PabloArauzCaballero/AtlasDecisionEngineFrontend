import {
  Activity,
  Braces,
  Calculator,
  ClipboardCheck,
  Database,
  FileCode2,
  FileSearch,
  FlaskConical,
  GitBranch,
  GraduationCap,
  History,
  Layers,
  Library,
  ListChecks,
  Play,
  Rocket,
  ScanSearch,
  ScrollText,
  Scale,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { accessPolicies } from '../auth/access-policies';
import { navigationTail } from './navigation-tail';
import type { NavigationSection } from './navigation-types';

export type { NavigationItem, NavigationSection } from './navigation-types';

export const navigation: readonly NavigationSection[] = [
  {
    label: 'Plataforma',
    items: [
      {
        label: 'Estado de la plataforma',
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
        label: 'Búsqueda',
        path: '/search',
        // El mismo icono que ya usa la caja de la barra superior
        // (`GlobalSearchBox`): son la misma cosa vista desde dos sitios.
        icon: Search,
        roles: accessPolicies.globalSearch,
      },
      {
        label: 'Tutoriales',
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
        label: 'Campos calculados',
        path: '/calculated-fields',
        icon: Calculator,
        roles: accessPolicies.calculatedFields,
      },
      {
        label: 'Librerías autorizadas',
        path: '/libraries',
        icon: Library,
        roles: accessPolicies.libraryRegistry,
      },
      {
        label: 'Motivos',
        path: '/reason-codes',
        icon: Braces,
        roles: accessPolicies.catalogRead,
      },
      {
        label: 'Algoritmos y versiones',
        path: '/algorithms',
        icon: Layers,
        roles: accessPolicies.artifacts,
      },
      {
        label: 'Editor del diagrama',
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
        label: 'Importar código',
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
        label: 'Suites de prueba',
        path: '/test-suites',
        icon: FlaskConical,
        roles: accessPolicies.qualityAuthoring,
      },
      {
        label: 'Casos de prueba',
        path: '/test-cases',
        icon: ListChecks,
        roles: accessPolicies.qualityAuthoring,
      },
      {
        label: 'Laboratorio de pruebas',
        path: '/qa-lab',
        icon: ScanSearch,
        roles: accessPolicies.qaLab,
      },
      {
        label: 'Cobertura del diagrama',
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
      {
        // En «Gobierno» y no en «Auditoría»: no mide lo que pasó, fija las condiciones de lo
        // que puede pasar. Auditar es mirar hacia atrás; esto es poner el marco.
        label: 'Gobierno del riesgo',
        path: '/risk-governance',
        icon: Scale,
        roles: accessPolicies.riskGovernance,
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
        label: 'Revisión manual',
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
      {
        /*
         * El motor calculaba desempeño, estabilidad e impacto adverso desde hacía tiempo y no
         * había ninguna pantalla que los pidiera: quien tiene que vigilar la degradación no
         * podía verla. Va en «Auditoría» y no en «Operación» porque no actúa sobre ninguna
         * decisión en curso — mide las que ya se tomaron.
         */
        label: 'Monitoreo del modelo',
        path: '/model-monitoring',
        icon: Activity,
        roles: accessPolicies.modelMonitoring,
      },
      // «Calidad de la decisión» y «Derechos del titular» salen del menú hasta que se rehagan:
      // hoy no enseñan nada útil (ver docs/trabajo/2026-10-06-refactor-calidad-y-titular/PLAN.md).
      // Las rutas siguen existiendo para poder rehacerlas sobre el mismo código.
    ],
  },
  ...navigationTail,
] as const;
