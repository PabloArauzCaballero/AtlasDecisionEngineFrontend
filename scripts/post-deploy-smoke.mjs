#!/usr/bin/env node
/** Comprueba la versión y las rutas que sirven el portal del Motor tras el deploy. */
const base = process.env.SMOKE_BASE_URL;
const sha = process.env.TARGET_SHA;
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? '12');
if (!base || !/^https?:\/\//.test(base)) throw new Error('SMOKE_BASE_URL debe ser HTTP(S).');
if (!/^[a-f0-9]{40}$/i.test(sha ?? '')) throw new Error('TARGET_SHA inválido.');
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60)
  throw new Error('SMOKE_ATTEMPTS inválido.');
const origin = new URL(base);
if (origin.username || origin.password || origin.search || origin.hash)
  throw new Error('SMOKE_BASE_URL contiene partes no permitidas.');
const url = (path) => new URL(`${origin.pathname.replace(/\/$/, '')}${path}`, origin);

async function get(path) {
  const response = await fetch(url(path), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const version = await (await get('/version')).json();
    if (
      version.service !== 'atlas-decision-frontend' ||
      version.version === 'unknown' ||
      version.commit !== sha
    ) {
      throw new Error(`Versión publicada incorrecta: ${JSON.stringify(version)}`);
    }
    const home = await get('/');
    if (!(await home.text()).includes('<html')) throw new Error('La portada no devuelve HTML.');
    const login = await get('/login');
    const html = await login.text();
    if (!html.includes('<html')) throw new Error('Login no devuelve HTML.');
    for (const kind of ['js', 'css']) {
      const asset = [
        ...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.(?:js|css)[^" ]*)"/g),
      ]
        .map((match) => match[1])
        .find((path) => new URL(path, origin).pathname.endsWith(`.${kind}`));
      if (!asset) throw new Error(`Login no referencia un asset ${kind}.`);
      const assetResponse = await fetch(new URL(asset, origin), {
        signal: AbortSignal.timeout(10000),
      });
      if (!assetResponse.ok) throw new Error(`Asset ${kind}: HTTP ${assetResponse.status}`);
    }
    const api = await (await get('/health/ready')).json();
    if ((api.data ?? api).status !== 'ready')
      throw new Error('El proxy no llega al Decision Engine Backend.');
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
if (lastError) throw lastError;
console.log(`Smoke HTTP OK: portal del Motor, assets y proxy; commit ${sha}.`);
