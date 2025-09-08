import { defineConfig } from 'tsup';

export default defineConfig({
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
});
