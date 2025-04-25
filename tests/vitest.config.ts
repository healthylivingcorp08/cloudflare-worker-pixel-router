import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Basic Vitest config - no pool for now
    deps: {
      optimizer: {
        ssr: {
          // Include lodash-es for SSR optimization (recommended over deprecated deps.inline)
          // This helps Vitest's Node environment handle the ESM package correctly.
          include: ['lodash-es'],
        },
      },
    },
    globals: true, // Optional: Use global APIs like describe, it, expect
    environment: 'node', // Use Node.js environment for basic unit tests
  },
});