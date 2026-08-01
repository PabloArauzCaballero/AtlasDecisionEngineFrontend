import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Arranca el servidor de producción tal y como se despliega.
 *
 * `output: 'standalone'` deja en `.next/standalone` un servidor con sus
 * dependencias, pero NO copia los estáticos ni `public/`: eso lo hace la imagen
 * de despliegue. Sin ese paso el servidor arranca y sirve HTML sin una sola
 * hoja de estilos ni un solo bundle, que es la clase de fallo que se confunde
 * con "la aplicación está rota".
 *
 * Existe para poder correr las pruebas end-to-end contra el artefacto real en
 * lugar del servidor de desarrollo, que compila cada ruta la primera vez que se
 * pide y convierte cualquier barrido en una carrera contra el reloj.
 */
const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error('No hay build standalone. Ejecuta `yarn build` antes.');
  process.exit(1);
}

for (const [from, to] of [
  [join(root, '.next', 'static'), join(standalone, '.next', 'static')],
  [join(root, 'public'), join(standalone, 'public')],
]) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

const port = process.env.PORT ?? '5173';
const server = spawn(process.execPath, [join(standalone, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port, HOSTNAME: '127.0.0.1' },
});
server.on('exit', (code) => process.exit(code ?? 0));
