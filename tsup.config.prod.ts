import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    node: 'src/node/index.ts'
  },
  clean: true,
  dts: true,
  external: ['web-naga'],
  format: ['esm', 'cjs'],
  outDir: 'dist/prod',
  shims: false,
  sourcemap: true,
  splitting: true,
  target: 'ES2020',
});
