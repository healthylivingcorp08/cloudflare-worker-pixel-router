import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

describe('Worker /api/page-pixels Endpoint', () => {
  let worker: Unstable_DevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should return empty actions if no rules match', async () => {
    const requestBody = {
      siteId: 'drivebright',
      url: 'http://localhost:3000/unknown/page',
      affid: 'someAffId',
      c1: 'c1Value',
      campid: 'c2Value',
      ef_transaction_id: 'tx123'
    };
    
    const response = await worker.fetch('http://localhost/api/page-pixels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ actionsToExecute: [] });
  });
});