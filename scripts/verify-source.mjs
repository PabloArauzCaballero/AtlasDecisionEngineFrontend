import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);
const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'coverage', 'docs']);
const requiredRoutes = [
  'src/app/(auth)/login/page.next.tsx',
  'src/app/(portal)/platform-health/page.next.tsx',
  'src/app/(portal)/variables/page.next.tsx',
  'src/app/(portal)/reason-codes/page.next.tsx',
  'src/app/(portal)/artifacts/page.next.tsx',
  'src/app/(portal)/artifacts/[artifactId]/page.next.tsx',
  'src/app/(portal)/artifact-versions/[versionId]/graph/page.next.tsx',
  'src/app/(portal)/artifact-versions/[versionId]/compile/page.next.tsx',
  'src/app/(portal)/artifact-versions/[versionId]/test-suites/page.next.tsx',
  'src/app/(portal)/test-suites/[suiteId]/cases/page.next.tsx',
  'src/app/(portal)/test-runs/[runId]/page.next.tsx',
  'src/app/(portal)/test-runs/[runId]/coverage/page.next.tsx',
  'src/app/(portal)/reviews/page.next.tsx',
  'src/app/(portal)/approval-requests/[requestId]/page.next.tsx',
  'src/app/(portal)/environments/page.next.tsx',
  'src/app/(portal)/deployments/page.next.tsx',
  'src/app/(portal)/simulator/page.next.tsx',
  'src/app/(portal)/manual-reviews/page.next.tsx',
  'src/app/(portal)/manual-reviews/[caseId]/page.next.tsx',
  'src/app/(portal)/executions/page.next.tsx',
  'src/app/(portal)/executions/[executionId]/page.next.tsx',
  'src/app/(portal)/audit-events/page.next.tsx',
  'src/app/(portal)/objectives/page.next.tsx',
  'src/app/(portal)/objectives/[objectiveId]/page.next.tsx',
  'src/app/(portal)/coverage-matrix/page.next.tsx',
];

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
  });
}

const failures = [];
const sourceFiles = collectFiles(root).filter((path) => codeExtensions.has(extname(path)));

for (const route of requiredRoutes) {
  if (!existsSync(join(root, route))) failures.push(`Missing App Router route: ${route}`);
}

for (const generatedPath of ['dist', 'tsconfig.app.tsbuildinfo', 'tsconfig.node.tsbuildinfo']) {
  if (existsSync(join(root, generatedPath))) {
    failures.push(`Generated artifact is versioned: ${generatedPath}`);
  }
}

for (const file of sourceFiles) {
  const path = relative(root, file).replaceAll('\\', '/');
  const content = readFileSync(file, 'utf8');
  const lineCount = content.split(/\r?\n/).length;
  const isApplicationSource = path.startsWith('src/');

  if (lineCount >= 300) failures.push(`${path} exceeds the 299-line limit (${lineCount})`);
  if (!isApplicationSource) continue;
  if (content.includes('react-router-dom')) failures.push(`${path} still imports React Router`);
  if (content.includes("from 'vite'")) failures.push(`${path} contains an unexpected Vite import`);
  if (content.includes('fetch(') && path !== 'src/api/http-client.ts') {
    failures.push(`${path} bypasses the authorized HTTP client`);
  }
}

if (requiredRoutes.length !== 25) {
  failures.push('The required route inventory must contain exactly 25 views');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Source verification passed for ${sourceFiles.length} files and 25 routes.`);
