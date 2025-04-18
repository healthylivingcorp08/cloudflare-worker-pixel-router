import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Basic Vitest config - no pool for now
    globals: true, // Optional: Use global APIs like describe, it, expect
    environment: 'node', // Use Node.js environment for basic unit tests
  },
});