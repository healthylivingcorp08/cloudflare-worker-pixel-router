# Testing Guide

## Test Structure
- Tests are located in `src/tests/`
- File naming: `*.test.ts` for test files
- Uses Vitest + Miniflare for Cloudflare Workers testing

## Running Tests
```bash
npm test  # Runs all tests
```

## Writing New Tests
1. Create a new `.test.ts` file in `src/tests/`
2. Follow this template:

```typescript
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

describe('Feature Being Tested', () => {
  let worker: Unstable_DevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should test specific behavior', async () => {
    // Test implementation
  });
});
```

## Test Types
- **Unit Tests:** Test individual functions
- **Integration Tests:** Test worker endpoints
- **KV Tests:** Test KV interactions by mocking data

## Best Practices
- Keep tests focused on one behavior
- Use descriptive test names
- Mock external dependencies
- Clean up resources in afterAll