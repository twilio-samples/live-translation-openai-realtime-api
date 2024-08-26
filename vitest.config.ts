/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsConfigPaths(),
  ],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src'],
      exclude: ['src/generated'],
      reporter: ['text', 'text-summary'],
    },
    setupFiles: [
      './tests/setupVitest.ts',
    ],
  },
});
