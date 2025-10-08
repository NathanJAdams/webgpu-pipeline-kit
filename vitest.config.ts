import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: [
      [
        'default',
        {
          'summary': false,
        },
      ],
    ],
    setupFiles: [
      'tests/setup/mock-webgpu-constants.ts',
      'tests/setup/set-log-level.ts',
    ],
    typecheck: {
      include: ['src/**/*.ts', 'tests/**/*.ts'],
      enabled: true,
    },
  },
});
