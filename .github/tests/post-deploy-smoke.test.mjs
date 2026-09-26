import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import process from 'node:process';

const sha = 'a'.repeat(40);

async function scenario({ commit = sha, proxy = true, css = true } = {}) {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push(request.url);
    const path = request.url;
    if (path === '/version') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ service: 'atlas-decision-frontend', version: '3.0.0', commit }),
      );
    } else if (path === '/') {
      response.end('<html>home</html>');
    } else if (path === '/login') {
      response.end(
        '<html><script src="/_next/static/chunks/app.js"></script><link href="/_next/static/css/app.css" rel="stylesheet"></html>',
      );
    } else if (path === '/_next/static/chunks/app.js') {
      response.end('console.log("ok")');
    } else if (path === '/_next/static/css/app.css') {
      response.statusCode = css ? 200 : 404;
      response.end('body{}');
    } else if (path === '/health/ready') {
      response.statusCode = proxy ? 200 : 502;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ status: 'ready' }));
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = server.address().port;
    const child = spawn(process.execPath, ['scripts/post-deploy-smoke.mjs'], {
      env: {
        ...process.env,
        SMOKE_BASE_URL: `http://127.0.0.1:${port}`,
        TARGET_SHA: sha,
        SMOKE_ATTEMPTS: '1',
      },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const [status] = await once(child, 'close');
    return { status, stderr, seen };
  } finally {
    server.close();
  }
}

test('comprueba ruta pública, login, JS, CSS, proxy y SHA servido', async () => {
  const result = await scenario();
  assert.equal(result.status, 0, result.stderr);
  for (const path of [
    '/',
    '/login',
    '/_next/static/chunks/app.js',
    '/_next/static/css/app.css',
    '/health/ready',
  ]) {
    assert.ok(result.seen.includes(path), path);
  }
});

test('rechaza un SHA anterior', async () => {
  const result = await scenario({ commit: 'b'.repeat(40) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Versión publicada incorrecta/);
});

test('rechaza proxy caído y asset faltante', async () => {
  assert.notEqual((await scenario({ proxy: false })).status, 0);
  assert.notEqual((await scenario({ css: false })).status, 0);
});
