import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/auth-flow/**/*.test.js'],
    fileParallelism: false,
    hookTimeout: 60_000
  }
});
