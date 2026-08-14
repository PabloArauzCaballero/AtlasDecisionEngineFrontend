import {
  coveragePercentage,
  queuedTestRunSchema,
  simulationResponseSchema,
  testRunSchema,
} from './testing.schemas';

describe('testing API contracts', () => {
  it('uses resultStatus and array-based coverage from the backend', () => {
    const run = testRunSchema.parse({
      id: '5',
      testSuiteId: '2',
      compiledArtifactId: '3',
      triggerType: 'MANUAL_UI',
      status: 'PASSED',
      coverage: [
        {
          coverageType: 'NODE',
          coveredCount: 4,
          totalCount: 5,
          coveragePercentage: '80',
          detailsJson: { covered: ['A'], missing: ['B'] },
        },
      ],
      caseRuns: [
        {
          id: '10',
          testCaseId: '9',
          resultStatus: 'PASS',
          durationMs: 4,
        },
      ],
    });

    expect(run.caseRuns[0]?.resultStatus).toBe('PASS');
    expect(coveragePercentage(run.coverage, 'NODE')).toBe(80);
  });

  it('accepts the immediate 202 queue response with empty evidence', () => {
    expect(
      queuedTestRunSchema.parse({
        id: '6',
        testSuiteId: '2',
        compiledArtifactId: '3',
        triggerType: 'MANUAL_UI',
        status: 'QUEUED',
      }),
    ).toMatchObject({ status: 'QUEUED', coverage: [], caseRuns: [] });
  });

  it('rejects a simulation response that claims persistence', () => {
    expect(() =>
      simulationResponseSchema.parse({
        simulation: true,
        persisted: true,
        requestId: 'request-1',
        status: 'SUCCESS',
        outcome: 'APPROVED',
        artifact: {
          code: 'POLICY',
          versionId: '1',
          deploymentId: '2',
          environment: 'DEV',
          checksum: 'abc',
        },
        trace: { nodes: [], edges: [], terminal: null },
        durationMs: 1,
      }),
    ).toThrow();
  });
});
