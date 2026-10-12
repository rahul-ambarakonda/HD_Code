import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import express from 'express';
import helmet from 'helmet';
import { waitlistRouter } from '../../src/routes/waitlist.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock the log function to capture output for assertions
let logOutput = [];
const mockLog = (event, fields = {}) => {
  logOutput.push({ event, ...fields });
  // Optional: originalConsoleLog(JSON.stringify({ event, ...fields }));
};

describe('POST /api/waitlist endpoint', () => {
  let app;
  let server;
  let baseUrl;
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    logOutput = []; // Clear log output before each test
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'beacon-waitlist-route-test-'));
    process.chdir(tempDir);
    await fs.mkdir('data');

    app = express();
    app.set('trust proxy', 1); // Essential for rate limiting to work correctly
    app.use(helmet());
    app.use('/api/waitlist', waitlistRouter(mockLog));

    await new Promise(resolve => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/waitlist`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should accept a valid email and return 201', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@example.com' }),
    });

    assert.strictEqual(response.status, 201);
    assert.deepStrictEqual(await response.json(), { status: 'joined' });
    assert.ok(logOutput.some(log => log.event === 'waitlist_submitted' && log.outcome === 'joined'));
  });

  it('should reject an invalid email and return 400', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' }),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'INVALID_EMAIL');
    assert.ok(logOutput.some(log => log.event === 'waitlist_submitted' && log.outcome === 'invalid'));
  });

  it('should return 409 for a duplicate email', async () => {
    await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'duplicate@example.com' }),
    });

    logOutput = []; // Clear logs before duplicate attempt

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'duplicate@example.com' }),
    });

    assert.strictEqual(response.status, 409);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'ALREADY_JOINED');
    assert.ok(logOutput.some(log => log.event === 'waitlist_submitted' && log.outcome === 'duplicate'));
  });

  it('should return 415 if Content-Type is not application/json', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'just some text',
    });

    assert.strictEqual(response.status, 415);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.ok(logOutput.some(log => log.event === 'waitlist_submitted' && log.outcome === 'invalid'));
  });

  it('should return 429 after exceeding rate limit', async () => {
    // Make 5 requests within the window
    for (let i = 0; i < 5; i++) {
      await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `rate-limit-${i}@example.com` }),
      });
    }
    logOutput = []; // Clear logs before the rate-limited attempt

    // The 6th request should be rate-limited
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'over-limit@example.com' }),
    });

    assert.strictEqual(response.status, 429);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'RATE_LIMITED');
    assert.ok(logOutput.some(log => log.event === 'waitlist_submitted' && log.outcome === 'rate_limited')));
  });

  it('should return 500 if store operations fail', async () => {
    const originalAddEntry = (await import('../../src/lib/store.js')).addEntry;
    // Mock addEntry to throw an error causing a STORE_UNAVAILABLE in the route handler
    const mockStore = await import('../../src/lib/store.js');
    mockStore.addEntry = async () => {
      throw new Error('Mocked store failure', { cause: new Error('STORE_UNAVAILABLE') });
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'error@example.com' }),
    });

    assert.strictEqual(response.status, 500);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'STORE_UNAVAILABLE');
    assert.ok(logOutput.some(log => log.event === 'waitlist_store_error' && log.message.includes('Mocked store failure')));
    mockStore.addEntry = originalAddEntry; // Restore original function
  });
});
