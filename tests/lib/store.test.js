import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { createStore } from '../../src/lib/store.js';

describe('Store Operations', () => {
  let mockFileContent = '';
  let mockFs;

  // Simulate a temporary directory by managing content in memory
  beforeEach(() => {
    mockFileContent = ''; // Reset file content before each test
    mockFs = {
      readFile: async (path) => {
        if (mockFileContent === '') {
          const error = new Error('File not found');
          error.code = 'ENOENT';
          throw error;
        }
        return mockFileContent;
      },
      writeFile: async (path, content) => {
        mockFileContent = content;
      },
    };
  });

  it('should return initial store structure if file is missing', async () => {
    const { readStore } = createStore(mockFs);
    const store = await readStore();
    assert.deepStrictEqual(store, { version: 1, entries: [] });
  });

  it('should return initial store structure if file is malformed JSON', async () => {
    mockFileContent = 'not valid json';
    const { readStore } = createStore(mockFs);
    const store = await readStore();
    assert.deepStrictEqual(store, { version: 1, entries: [] });
  });

  it('should return initial store structure if file is valid JSON but malformed store', async () => {
    mockFileContent = JSON.stringify({ version: 1, entries: 'not-an-array' });
    const { readStore } = createStore(mockFs);
    const store = await readStore();
    assert.deepStrictEqual(store, { version: 1, entries: [] });
  });

  it('should add the first entry correctly', async () => {
    const { addEntry, readStore } = createStore(mockFs);
    const email = 'test@example.com';
    const ip = '127.0.0.1';
    await addEntry(email, ip);

    const store = await readStore();
    assert.strictEqual(store.entries.length, 1);
    assert.strictEqual(store.entries[0].email, email);
    assert.strictEqual(store.entries[0].ip, ip);
    assert.ok(store.entries[0].joinedAt);
  });

  it('should reject a duplicate email', async () => {
    const { addEntry, hasEmail } = createStore(mockFs);
    const email = 'test@example.com';
    const ip = '127.0.0.1';

    await addEntry(email, ip);
    const added = await hasEmail(email);
    assert.strictEqual(added, true);

    // Attempt to add again
    await addEntry(email, '192.168.1.1'); // Different IP
    const store = await readStore();
    assert.strictEqual(store.entries.length, 1); // Should still be 1 entry
  });

  it('should correctly identify an existing email', async () => {
    const { addEntry, hasEmail } = createStore(mockFs);
    await addEntry('existing@example.com', '127.0.0.1');
    const exists = await hasEmail('existing@example.com');
    assert.strictEqual(exists, true);
  });

  it('should correctly identify a non-existing email', async () => {
    const { hasEmail } = createStore(mockFs);
    const exists = await hasEmail('nonexistent@example.com');
    assert.strictEqual(exists, false);
  });

  it('should handle multiple entries', async () => {
    const { addEntry, readStore } = createStore(mockFs);
    await addEntry('test1@example.com', '127.0.0.1');
    await addEntry('test2@example.com', '127.0.0.2');

    const store = await readStore();
    assert.strictEqual(store.entries.length, 2);
    assert.strictEqual(store.entries[0].email, 'test1@example.com');
    assert.strictEqual(store.entries[1].email, 'test2@example.com');
  });

  it('should normalize email before storing and checking', async () => {
    const { addEntry, hasEmail, readStore } = createStore(mockFs);
    await addEntry('  MIXEDCASE@EXAMPLE.COM  ', '127.0.0.1');

    assert.strictEqual(await hasEmail('mixedcase@example.com'), true);

    const store = await readStore();
    assert.strictEqual(store.entries[0].email, 'mixedcase@example.com');
  });

  it('should propagate STORE_UNAVAILABLE error on read failure', async () => {
    mockFs.readFile = async () => {
      throw new Error('Disk full');
    };
    const { readStore } = createStore(mockFs);
    await assert.rejects(readStore(), { message: 'STORE_UNAVAILABLE' });
  });

  it('should propagate STORE_UNAVAILABLE error on write failure', async () => {
    mockFs.writeFile = async () => {
      throw new Error('Permission denied');
    };
    const { addEntry } = createStore(mockFs);
    await assert.rejects(addEntry('fail@example.com', '1.1.1.1'), { message: 'STORE_UNAVAILABLE' });
  });
});
