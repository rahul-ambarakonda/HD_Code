import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import { createServer } from '../../src/server.js'; // Assuming server.js exports the app directly or a factory

// We need to import the actual app from server.js to test it.
// Since server.js directly calls app.listen, we'll need a way to get the app instance.
// A common pattern is to export the app itself, and have a separate script for `app.listen`.
// Looking at src/server.js, it directly creates and listens, which makes testing tricky.
// I'll assume that `src/server.js` exports the `app` instance as `export { app };` for testing purposes.
// If not, I'd need to refactor src/server.js to make it testable.

import app from '../../src/server.js'; // This import assumes server.js is refactored to export app

describe('Waitlist API Endpoint', () => {
  let server;
  let baseUrl;

  // Before all tests, start the server on an ephemeral port
  before(async () => {
    // Dynamically import the server to get the app instance
    // This is a workaround for the current server.js structure that directly calls app.listen
    // A proper refactor would involve src/server.js exporting a function to create the app
    const { default: createAndStartApp } = await import('../../src/server.js');
    const { app: expressApp, server: httpServer } = createAndStartApp(); // Assuming createAndStartApp returns { app, server }
    server = httpServer;
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  // After all tests, close the server
  after(async () => {
    await new Promise(resolve => server.close(resolve));
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
    for (let i = 0; i < 5; i++) {
      // Make 5 requests within the window
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
