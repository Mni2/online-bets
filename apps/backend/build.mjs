import esbuild from 'esbuild';

const externalNodeModulesPlugin = {
  name: 'external-node-modules',
  setup(build) {
    // Mark all bare imports (not starting with . or /) as external, EXCEPT our own @nova/* packages
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (!args.path.startsWith('@nova/')) {
        return { path: args.path, external: true };
      }
    });
  },
};

esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  plugins: [externalNodeModulesPlugin],
  sourcemap: true,
}).catch(() => process.exit(1));
