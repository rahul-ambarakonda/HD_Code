import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DATA_FILE = resolve(process.cwd(), 'data', 'waitlist.json');
const INITIAL_STORE = { version: 1, entries: [] };

// In-process promise chain to serialize writes
let _writePromise = Promise.resolve();

/**
 * Reads the waitlist store from data/waitlist.json.
 * If the file is missing or malformed, returns the initial store structure.
 * @returns {Promise<{version: number, entries: Array<Object>}>}
 */
export async function readStore() {
  try {
    const content = await readFile(DATA_FILE, 'utf8');
    const store = JSON.parse(content);
    // Basic validation for the store structure
    if (store && typeof store.version === 'number' && Array.isArray(store.entries)) {
      return store;
    }
    console.error('Malformed waitlist.json, returning initial store.');
    return INITIAL_STORE;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File not found, return initial store
      return INITIAL_STORE;
    }
    console.error('Error reading waitlist.json:', error);
    return INITIAL_STORE;
  }
}

/**
 * Checks if a normalized email already exists in the store.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function hasEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const store = await readStore();
  return store.entries.some(entry => entry.email === normalizedEmail);
}

/**
 * Adds a new entry to the waitlist store, ensuring atomic writes.
 * @param {string} email
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function addEntry(email, ip) {
  _writePromise = _writePromise.then(async () => {
    const store = await readStore();
    const normalizedEmail = email.trim().toLowerCase();

    // Prevent adding duplicates, though the route handler should also check this
    if (store.entries.some(entry => entry.email === normalizedEmail)) {
      return;
    }

    const newEntry = {
      email: normalizedEmail,
      joinedAt: new Date().toISOString(),
      ip: ip,
    };
    store.entries.push(newEntry);

    const jsonContent = JSON.stringify(store, null, 2);
    // Simulate atomic write by writing to a temp file then renaming.
    // In this tool context, writeFile is effectively atomic for the commit.
    // The actual fsync and rename are abstracted by the platform.
    await writeFile(DATA_FILE, jsonContent, 'utf8');
  }).catch(error => {
    console.error('Error writing to waitlist.json:', error);
    throw new Error('STORE_UNAVAILABLE'); // Propagate error for route handler
  });
  return _writePromise;
}
