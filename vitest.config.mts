import { defineConfig } from 'vitest/config';

// Tests cover pure modules only, so a plain Node environment is enough (no DOM).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
