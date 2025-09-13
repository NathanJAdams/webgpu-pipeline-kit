import { defineConfig } from 'tsup';
import pkg from './package.json';

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


  outExtension({ format, options, pkgType }) {
    if (format === 'iife') {
      return {
        js: `.v${pkg.version}.js`
      };
    }
    return { js: '.js' };
  },
});
