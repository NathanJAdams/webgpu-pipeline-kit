import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/mock-webgpu-constants.ts'],
    typecheck: {
      include: ['src/**/*.ts', 'tests/**/*.ts'],
      enabled: true,
    },
  },
});
