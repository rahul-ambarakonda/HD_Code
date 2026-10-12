import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { readStore, hasEmail, addEntry } from '../../src/lib/store.js';

// Mock console.error to prevent test logs from cluttering output
const originalConsoleError = console.error;
let consoleErrorOutput = [];

describe('Store Operations', () => {
  let tempDir;
  let storeFile;
  let tempStoreFile;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'beacon-store-test-'));
    // Change CWD to the temp directory so `path.resolve(process.cwd(), 'data')` in store.js points correctly
    process.chdir(tempDir);
    await fs.mkdir('data');

    storeFile = path.join(tempDir, 'data', 'waitlist.json');
    tempStoreFile = path.join(tempDir, 'data', 'waitlist.json.tmp');

    // Suppress console.error during tests unless explicitly needed
    consoleErrorOutput = [];
    console.error = (...args) => {
      consoleErrorOutput.push(args.join(' '));
    };
  });

  afterEach(async () => {
    // Restore original console.error
    console.error = originalConsoleError;
    // Clean up the temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    process.chdir(originalCwd);
  });

  it('should return a default empty store when file is missing', async () => {
    const store = await readStore();
    assert.deepStrictEqual(store, { version: 1, entries: [] });
  });

  it('should return a default empty store when file is malformed JSON', async () => {
    await fs.writeFile(storeFile, '{\"version\": 1, \"entries\": [}', 'utf8');
    const store = await readStore();
    assert.deepStrictEqual(store, { version: 1, entries: [] });
    assert.ok(consoleErrorOutput.some(msg => msg.includes('Failed to read or parse store file')));
  });

  it('should return a default empty store when file has invalid structure (missing entries)', async () => {
    await fs.writeFile(storeFile, '{\"version\": 1}', 'utf8');
    const store = await readStore();
    assert.deepStrictEqual(store, { version: 1, entries: [] });
    assert.ok(consoleErrorOutput.some(msg => msg.includes('Malformed store file')));
  });

  it('should add the first entry to the store', async () => {
    const email = 'test1@example.com';
    const ip = '127.0.0.1';
    await addEntry(email, ip);

    const store = await readStore();
    assert.strictEqual(store.entries.length, 1);
    assert.strictEqual(store.entries[0].email, email);
    assert.strictEqual(store.entries[0].ip, ip);
    assert.ok(store.entries[0].joinedAt);
  });

  it('should reject adding a duplicate email (case-insensitive and trimmed)', async () => {
    const email = 'test2@example.com';
    const ip = '127.0.0.1';
    await addEntry(email, ip);

    const duplicateEmail1 = 'Test2@example.com';
    const duplicateEmail2 = '  test2@example.com  ';

    // addEntry should internally check for duplicates and do nothing
    await addEntry(duplicateEmail1, ip);
    await addEntry(duplicateEmail2, ip);

    const store = await readStore();
    assert.strictEqual(store.entries.length, 1);
    assert.strictEqual(store.entries[0].email, email);
  });

  it('hasEmail should return true for an existing email', async () => {
    const email = 'existing@example.com';
    await addEntry(email, '127.0.0.1');
    assert.strictEqual(await hasEmail(email), true);
    assert.strictEqual(await hasEmail('  Existing@example.com  '), true);
  });

  it('hasEmail should return false for a non-existing email', async () => {
    assert.strictEqual(await hasEmail('nonexistent@example.com'), false);
  });

  it('should handle concurrent writes correctly through serialization', async () => {
    const emails = [
      { email: 'user1@example.com', ip: '192.168.1.1' },
      { email: 'user2@example.com', ip: '192.168.1.2' },
      { email: 'user3@example.com', ip: '192.168.1.3' },
    ];

    const writePromises = emails.map(e => addEntry(e.email, e.ip));
    await Promise.all(writePromises);

    const store = await readStore();
    assert.strictEqual(store.entries.length, emails.length);
    const storedEmails = store.entries.map(entry => entry.email).sort();
    const expectedEmails = emails.map(e => e.email).sort();
    assert.deepStrictEqual(storedEmails, expectedEmails);
  });

  it('should perform atomic writes: ensure temp file is renamed', async () => {
    const email = 'atomic@example.com';
    const ip = '127.0.0.1';
    await addEntry(email, ip);

    // Verify temp file does not exist after successful write
    let tempFileExists = true;
    try {
      await fs.access(tempStoreFile);
    } catch (error) {
      tempFileExists = false;
    }
    assert.strictEqual(tempFileExists, false, 'Temp file should not exist after atomic write.');

    // Verify main file exists and contains data
    let mainFileExists = true;
    try {
      await fs.access(storeFile);
    } catch (error) {
      mainFileExists = false;
    }
    assert.strictEqual(mainFileExists, true, 'Main store file should exist after atomic write.');
    const store = await readStore();
    assert.strictEqual(store.entries.length, 1);
  });

  it('should propagate STORE_UNAVAILABLE error when fs operations fail', async () => {
    const originalWriteFile = fs.writeFile;
    fs.writeFile = async () => {
      throw new Error('Mocked FS Error');
    };

    const email = 'fail@example.com';
    const ip = '127.0.0.1';

    let errorCaught = false;
    try {
      await addEntry(email, ip);
    } catch (error) {
      errorCaught = true;
      assert.strictEqual(error.message, 'STORE_UNAVAILABLE');
      assert.strictEqual(error.cause.message, 'Mocked FS Error');
    } finally {
      fs.writeFile = originalWriteFile; // Restore original function
    }
    assert.strictEqual(errorCaught, true, 'STORE_UNAVAILABLE error was not caught.');
    assert.ok(consoleErrorOutput.some(msg => msg.includes('Failed to add entry to store')));
  });
});
