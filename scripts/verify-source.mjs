import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';
import {
  verifyColorTokens,
  verifyCustomProperties,
  verifyRouteAccess,
} from './verify-conventions.mjs';

const root = process.cwd();
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);
const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'coverage', 'docs']);
const authorizedFetchFiles = new Set([
  'src/api/http-client.ts',
  'src/server/decision-engine-proxy.ts',
]);
/**
 * Vistas cuya ausencia rompe la navegación del portal aunque nada falle al
 * compilar. La lista completa de rutas ya no se escribe a mano —la deriva
 * `verifyRouteAccess` del árbol de páginas—; aquí sólo quedan las de entrada.
 */
const requiredRoutes = [
  'src/app/(auth)/login/page.next.tsx',
  'src/app/(portal)/platform-health/page.next.tsx',
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
  if (/\bfetch\s*\(/.test(content) && !authorizedFetchFiles.has(path)) {
    failures.push(`${path} bypasses the authorized HTTP client`);
  }
}

failures.push(
  ...verifyRouteAccess(root),
  ...verifyCustomProperties(root),
  ...verifyColorTokens(root),
);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(
  `Source verification passed for ${sourceFiles.length} files: ` +
    `every portal route has an access rule and every CSS token resolves.`,
);
