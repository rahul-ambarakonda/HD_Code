import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import express from 'express';
import { router as healthRouter } from '../../src/routes/health.js';

describe('GET /healthz endpoint', () => {
  let app;
  let server;
  let baseUrl;

  beforeEach(async () => {
    app = express();
    app.use('/healthz', healthRouter);

    await new Promise(resolve => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/healthz`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it('should return 200 OK with status and uptime', async () => {
    const response = await fetch(baseUrl);
    assert.strictEqual(response.status, 200);

    const body = await response.json();
    assert.deepStrictEqual(Object.keys(body), ['status', 'uptime']);
    assert.strictEqual(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number');
    assert.ok(body.uptime >= 0); // Uptime should be a non-negative number
  });
});
