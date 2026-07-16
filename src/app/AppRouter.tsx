import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { LoadingScreen } from '../components/LoadingScreen';
import { AppShell } from '../layout/AppShell';
import { ResourceListPage } from '../pages/ResourceListPage';
import { resources } from '../resources/resource.config';

const page = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({
    default: (await loader())[name] as unknown as ComponentType,
  }));
const LoginPage = page(() => import('../pages/LoginPage'), 'LoginPage');
const PlatformStatusPage = page(() => import('../pages/PlatformStatusPage'), 'PlatformStatusPage');
const ArtifactDetailPage = page(() => import('../pages/ArtifactDetailPage'), 'ArtifactDetailPage');
const GraphEditorPage = page(() => import('../pages/GraphEditorPage'), 'GraphEditorPage');
const CompilePage = page(() => import('../pages/CompilePage'), 'CompilePage');
const TestSuitesPage = page(() => import('../pages/TestSuitesPage'), 'TestSuitesPage');
const TestCasesPage = page(() => import('../pages/TestCasesPage'), 'TestCasesPage');
const TestRunDetailPage = page(() => import('../pages/TestRunDetailPage'), 'TestRunDetailPage');
const GraphCoveragePage = page(() => import('../pages/GraphCoveragePage'), 'GraphCoveragePage');
const ApprovalRequestDetailPage = page(
  () => import('../pages/ApprovalRequestDetailPage'),
  'ApprovalRequestDetailPage',
);
const EnvironmentsPage = page(() => import('../pages/EnvironmentsPage'), 'EnvironmentsPage');
const SimulatorPage = page(() => import('../pages/SimulatorPage'), 'SimulatorPage');
const ManualReviewDetailPage = page(
  () => import('../pages/ManualReviewDetailPage'),
  'ManualReviewDetailPage',
);
const ExecutionDetailPage = page(
  () => import('../pages/ExecutionDetailPage'),
  'ExecutionDetailPage',
);
const ObjectiveDetailPage = page(
  () => import('../pages/ObjectiveDetailPage'),
  'ObjectiveDetailPage',
);
const CoverageMatrixPage = page(() => import('../pages/CoverageMatrixPage'), 'CoverageMatrixPage');
const NotFoundPage = page(() => import('../pages/NotFoundPage'), 'NotFoundPage');

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/platform-health" replace />} />
            <Route path="/platform-health" element={<PlatformStatusPage />} />
            <Route path="/variables" element={<ResourceListPage config={resources.variables} />} />
            <Route
              path="/reason-codes"
              element={<ResourceListPage config={resources['reason-codes']} />}
            />
            <Route path="/artifacts" element={<ResourceListPage config={resources.artifacts} />} />
            <Route path="/artifacts/:artifactId" element={<ArtifactDetailPage />} />
            <Route path="/graph-editor" element={<GraphEditorPage />} />
            <Route path="/artifact-versions/:versionId/graph" element={<GraphEditorPage />} />
            <Route path="/artifact-versions/:versionId/compile" element={<CompilePage />} />
            <Route path="/test-suites" element={<TestSuitesPage />} />
            <Route path="/artifact-versions/:versionId/test-suites" element={<TestSuitesPage />} />
            <Route path="/test-cases" element={<TestCasesPage />} />
            <Route path="/test-suites/:suiteId/cases" element={<TestCasesPage />} />
            <Route path="/test-runs/:runId" element={<TestRunDetailPage />} />
            <Route path="/graph-coverage" element={<GraphCoveragePage />} />
            <Route path="/test-runs/:runId/coverage" element={<GraphCoveragePage />} />
            <Route path="/reviews" element={<ResourceListPage config={resources.reviews} />} />
            <Route path="/approval-requests/:requestId" element={<ApprovalRequestDetailPage />} />
            <Route path="/environments" element={<EnvironmentsPage />} />
            <Route
              path="/deployments"
              element={<ResourceListPage config={resources.deployments} />}
            />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route
              path="/manual-reviews"
              element={<ResourceListPage config={resources['manual-reviews']} />}
            />
            <Route path="/manual-reviews/:caseId" element={<ManualReviewDetailPage />} />
            <Route
              path="/executions"
              element={<ResourceListPage config={resources.executions} />}
            />
            <Route path="/executions/:executionId" element={<ExecutionDetailPage />} />
            <Route
              path="/audit-events"
              element={<ResourceListPage config={resources['audit-events']} />}
            />
            <Route
              path="/objectives"
              element={<ResourceListPage config={resources.objectives} />}
            />
            <Route path="/objectives/:objectiveId" element={<ObjectiveDetailPage />} />
            <Route path="/coverage-matrix" element={<CoverageMatrixPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
