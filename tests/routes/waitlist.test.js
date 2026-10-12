import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import { createApp } from '../../src/server.js';

describe('Waitlist API Endpoint', () => {
  let server;
  let baseUrl;

  // Before all tests, start the server on an ephemeral port
  before(async () => {
    const app = createApp();
    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s)); // Listen on ephemeral port
    });
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  // After all tests, close the server
  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('should return 201 for a valid email', async () => {
    const response = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@example.com' }),
    });
    assert.strictEqual(response.status, 201);
    const body = await response.json();
    assert.deepStrictEqual(body, { status: 'joined' });
  });

  it('should return 400 for an invalid email', async () => {
    const response = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' }),
    });
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.deepStrictEqual(body, { error: { code: 'INVALID_EMAIL', message: 'That does not look like an email address.' } });
  });

  it('should return 409 for a duplicate email', async () => {
    // First valid submission
    await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'duplicate@example.com' }),
    });

    // Second submission with the same email
    const response = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'duplicate@example.com' }),
    });
    assert.strictEqual(response.status, 409);
    const body = await response.json();
    assert.deepStrictEqual(body, { error: { code: 'ALREADY_JOINED', message: 'You are already on the list.' } });
  });

  it('should return 415 for unsupported media type', async () => {
    const response = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'email=test@example.com',
    });
    assert.strictEqual(response.status, 415);
    const body = await response.json();
    assert.deepStrictEqual(body, { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' } });
  });

  it('should return 429 for rate limited requests', async () => {
    const emailBase = 'ratelimit';
    // Make 5 requests within the window. Use different emails for each to avoid duplicate error.
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${emailBase}${i}@example.com` }),
      });
    }

    // The 6th request should be rate-limited
    const response = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${emailBase}6@example.com` }),
    });
    assert.strictEqual(response.status, 429);
    const body = await response.json();
    assert.deepStrictEqual(body, { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a minute.' } });
  });

  it('should return 400 if email is missing from body', async () => {
    const response = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notAnEmail: 'test' }),
    });
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.deepStrictEqual(body, { error: { code: 'INVALID_EMAIL', message: 'That does not look like an email address.' } });
  });
});
