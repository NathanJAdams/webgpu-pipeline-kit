import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  bundle: true,
  clean: true,
  external: ['web-naga'],
  format: ['iife'],
  globalName: 'WebGPUPipelineKit',
  outDir: 'dist/bundle',
  shims: false,
  sourcemap: false,
  splitting: false,
  target: 'ES2020',
});
