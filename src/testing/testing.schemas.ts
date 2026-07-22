import { z } from 'zod';

const identifierSchema = z.string().min(1);
const nullableJsonSchema = z.unknown().nullable().optional();

export const environmentSchema = z
  .object({
    id: identifierSchema,
    code: z.string().min(2),
    name: z.string().min(1),
    environmentType: z.string(),
    status: z.string(),
    isProduction: z.boolean(),
  })
  .passthrough();

export const environmentsSchema = z.array(environmentSchema);

export const testCoverageSchema = z
  .object({
    id: identifierSchema.optional(),
    coverageType: z.string().min(1),
    coveredCount: z.coerce.number().nonnegative(),
    totalCount: z.coerce.number().nonnegative(),
    coveragePercentage: z.coerce.number().min(0).max(100),
    detailsJson: z
      .object({
        covered: z.array(z.string()).default([]),
        missing: z.array(z.string()).default([]),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const testAssertionSchema = z
  .object({
    id: identifierSchema.optional(),
    assertionPath: z.string(),
    operator: z.string(),
    expectedJson: nullableJsonSchema,
    actualJson: nullableJsonSchema,
    passed: z.boolean(),
  })
  .passthrough();

export const testCaseSchema = z
  .object({
    id: identifierSchema,
    caseCode: z.string().min(1),
    testName: z.string().min(1),
    inputJson: z.unknown(),
    expectedResultJson: z.unknown(),
    tagsJson: nullableJsonSchema,
    isActive: z.boolean(),
  })
  .passthrough();

export const testCaseRunSchema = z
  .object({
    id: identifierSchema,
    testCaseId: identifierSchema,
    resultStatus: z.enum(['PASS', 'FAIL', 'ERROR']),
    durationMs: z.coerce.number().nonnegative(),
    actualResultJson: nullableJsonSchema,
    errorJson: nullableJsonSchema,
    testCase: testCaseSchema.optional(),
    assertions: z.array(testAssertionSchema).default([]),
  })
  .passthrough();

const testRunSummarySchema = z
  .object({
    id: identifierSchema,
    testSuiteId: identifierSchema,
    compiledArtifactId: identifierSchema,
    triggerType: z.string(),
    status: z.enum(['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ERROR']),
    queuedAt: z.string().optional(),
    startedAt: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    durationMs: z.coerce.number().nonnegative().optional(),
    coverage: z.array(testCoverageSchema).default([]),
  })
  .passthrough();

export const queuedTestRunSchema = testRunSummarySchema.extend({
  caseRuns: z.array(testCaseRunSchema).default([]),
});

export const testRunSchema = testRunSummarySchema.extend({
  caseRuns: z.array(testCaseRunSchema).default([]),
});

export const testSuiteSchema = z
  .object({
    id: identifierSchema,
    suiteCode: z.string().min(1),
    name: z.string().min(1),
    suiteType: z.string(),
    isBlocking: z.boolean(),
    cases: z.array(testCaseSchema).default([]),
    runs: z.array(testRunSummarySchema).default([]),
  })
  .passthrough();

export const testSuitesPageSchema = z
  .object({
    items: z.array(testSuiteSchema),
    page: z.coerce.number().int().positive(),
    pageSize: z.coerce.number().int().positive(),
    total: z.coerce.number().int().nonnegative(),
    totalPages: z.coerce.number().int().nonnegative(),
    hasNextPage: z.boolean(),
  })
  .passthrough();

export const testCasesSchema = z.array(testCaseSchema);
export const importedTestCasesSchema = z.array(testCaseSchema);

const reasonCodeSchema = z
  .object({
    code: z.string().min(1),
    category: z.string().optional(),
    message: z.string().optional(),
    adverseAction: z.boolean().optional(),
    priority: z.coerce.number().optional(),
  })
  .passthrough();

export const simulationResponseSchema = z
  .object({
    simulation: z.literal(true),
    persisted: z.literal(false),
    requestId: z.string().min(1),
    status: z.string().min(1),
    outcome: z.string().min(1),
    score: z.unknown().optional(),
    riskBand: z.unknown().optional(),
    limit: z.unknown().optional(),
    output: z.record(z.unknown()).default({}),
    primaryResult: z
      .object({ code: z.string().min(1), value: z.unknown() })
      .passthrough()
      .optional(),
    reasonCodes: z.array(reasonCodeSchema).default([]),
    errors: z.array(z.unknown()).optional(),
    artifact: z
      .object({
        code: z.string(),
        versionId: identifierSchema,
        deploymentId: identifierSchema,
        environment: z.string(),
        checksum: z.string(),
      })
      .passthrough(),
    trace: z
      .object({
        nodes: z.array(z.string()),
        edges: z.array(z.string()),
        terminal: z.string().nullable().optional(),
      })
      .passthrough(),
    durationMs: z.coerce.number().nonnegative(),
  })
  .passthrough();

export type Environment = z.infer<typeof environmentSchema>;
export type TestCoverage = z.infer<typeof testCoverageSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestRun = z.infer<typeof testRunSchema>;
export type TestSuite = z.infer<typeof testSuiteSchema>;
export type SimulationResponse = z.infer<typeof simulationResponseSchema>;

export function coveragePercentage(
  coverage: readonly TestCoverage[],
  type: 'NODE' | 'EDGE' | 'TERMINAL',
): number {
  return coverage.find((item) => item.coverageType === type)?.coveragePercentage ?? 0;
}
