/**
 * @file Manages the waitlist data stored in data/waitlist.json.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'waitlist.json');
const TEMP_STORE_FILE = path.join(DATA_DIR, 'waitlist.json.tmp');

let writePromise = Promise.resolve();

/**
 * Ensures the data directory exists.
 * @returns {Promise<void>}
 */
async function ensureDataDirectory() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Reads the waitlist store from data/waitlist.json.
 * If the file is missing, returns a default empty store structure.
 * Handles malformed JSON gracefully.
 *
 * @returns {Promise<{ version: number, entries: Array<{ email: string, joinedAt: string, ip: string }> }>}
 */
export async function readStore() {
  await ensureDataDirectory();
  try {
    const content = await fs.readFile(STORE_FILE, 'utf8');
    const store = JSON.parse(content);
    if (!store.version || !Array.isArray(store.entries)) {
      console.error('log(): WARN: Malformed store file, returning empty structure.');
      return { version: 1, entries: [] };
    }
    return store;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File does not exist, return default empty store
      return { version: 1, entries: [] };
    }
    console.error(`log(): ERROR: Failed to read or parse store file: ${error.message}`);
    // For any other error, return empty structure to prevent crashes
    return { version: 1, entries: [] };
  }
}

/**
 * Checks if a normalized email already exists in the store.
 *
 * @param {string} email - The email to check (will be normalized).
 * @returns {Promise<boolean>}
 */
export async function hasEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const store = await readStore();
  return store.entries.some(entry => entry.email === normalizedEmail);
}

/**
 * Adds a new entry to the waitlist store with atomic writes.
 * Serializes writes using an in-process promise chain.
 *
 * @param {string} email - The email address to add.
 * @param {string} ip - The IP address of the requester.
 * @returns {Promise<void>}
 */
export async function addEntry(email, ip) {
  writePromise = writePromise.then(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const newEntry = {
      email: normalizedEmail,
      joinedAt: new Date().toISOString(),
      ip: ip,
    };

    const store = await readStore();
    // Check for duplicates again to prevent race conditions during concurrent writes
    if (store.entries.some(entry => entry.email === normalizedEmail)) {
      return; // Already exists, do nothing
    }

    store.entries.push(newEntry);

    const jsonContent = JSON.stringify(store, null, 2);

    await fs.writeFile(TEMP_STORE_FILE, jsonContent, 'utf8');
    await fs.fsync(await fs.open(TEMP_STORE_FILE, 'r')); // fsync the temp file
    await fs.rename(TEMP_STORE_FILE, STORE_FILE);
  }).catch(error => {
    console.error(`log(): ERROR: Failed to add entry to store: ${error.message}`);
    // Rethrow to propagate the error to the caller, if necessary.
    // Or handle specifically for STORE_UNAVAILABLE in the caller.
    throw new Error('STORE_UNAVAILABLE', { cause: error });
  });

  return writePromise;
}
