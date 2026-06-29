import esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

// Mark all dependencies as external EXCEPT @nova/* workspace packages
const external = Object.keys(pkg.dependencies || {}).filter(
  (dep) => !dep.startsWith('@nova/')
);

esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  external,
  sourcemap: true,
}).catch(() => process.exit(1));
