import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: {
    entry: 'src/index.ts',
  },
  entry: {
    'index': 'src/index.ts',
    'node':'src/node/index.ts'
  },
  external: ['tree-sitter', 'tree-sitter-wgsl', 'web-naga'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  splitting: false,
  target: 'ES2020',
});
