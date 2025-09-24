import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: {
    'orbiter/index': 'src/examples/orbiter/index.ts',
    'star/index': 'src/examples/star/index.ts',
    'triangles/index': 'src/examples/triangles/index.ts',
  },
  bundle: true,
  clean: true,
  external: ['web-naga'],
  format: ['iife'],
  globalName: 'WebGPUPipelineKit',
  outDir: 'dist/dev',
  shims: false,
  sourcemap: true,
  splitting: false,
  target: 'ES2020',
  onSuccess: async () => {
    const examples = ['orbiter', 'star', 'triangles'];
    for (const example of examples) {
      const srcHtml = `src/examples/${example}/index.html`;
      const destDir = `dist/dev/${example}`;
      const destHtml = join(destDir, 'index.html');
      mkdirSync(destDir, { recursive: true });
      copyFileSync(srcHtml, destHtml);
      console.log(`Copied ${srcHtml} -> ${destHtml}`);
    }
  },
});
