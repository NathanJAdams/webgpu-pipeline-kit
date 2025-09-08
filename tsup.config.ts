import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      node: 'src/node/index.ts'
    },
    clean: true,
    dts: true,
    external: ['web-naga'],
    format: ['esm', 'cjs'],
    outDir: 'dist/build',
    shims: false,
    sourcemap: true,
    splitting: true,
    target: 'ES2020',
  },
  {
    entry: {
      'triangles/index': 'src/examples/triangles/index.ts'
    },
    bundle: true,
    clean: true,
    external: ['web-naga'],
    format: ['iife'],
    globalName: 'WebGPUPipelineKit',
    outDir: 'dist/examples',
    shims: false,
    sourcemap: true,
    splitting: false,
    target: 'ES2020',
  }
]);
