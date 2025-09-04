import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: {
      include: ['src/**/*ts'],
      enabled: true,
    },
  },
})
