import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'node:fs/promises';
import { resolve as nodeResolve } from 'node:path';

const DATA_FILE = nodeResolve(process.cwd(), 'data', 'waitlist.json');
const INITIAL_STORE = { version: 1, entries: [] };

// Factory function to create store operations, allowing dependency injection for testing
export function createStore(fs = { readFile: nodeReadFile, writeFile: nodeWriteFile }) {
  let _writePromise = Promise.resolve(); // In-process promise chain to serialize writes

  /**
   * Reads the waitlist store from data/waitlist.json.
   * If the file is missing or malformed, returns the initial store structure.
   * @returns {Promise<{version: number, entries: Array<Object>}>}
   */
  async function readStore() {
    try {
      const content = await fs.readFile(DATA_FILE, 'utf8');
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
      throw new Error('STORE_UNAVAILABLE'); // Propagate error for route handler to catch
    }
  }

  /**
   * Checks if a normalized email already exists in the store.
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async function hasEmail(email) {
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
  async function addEntry(email, ip) {
    _writePromise = _writePromise.then(async () => {
      const store = await readStore();
      const normalizedEmail = email.trim().toLowerCase();

      // Prevent adding duplicates, though the route handler should also check this
      if (store.entries.some(entry => entry.email === normalizedEmail)) {
        return; // Silently return if duplicate, as hasEmail check is done by router
      }

      const newEntry = {
        email: normalizedEmail,
        joinedAt: new Date().toISOString(),
        ip: ip,
      };
      store.entries.push(newEntry);

      const jsonContent = JSON.stringify(store, null, 2);
      await fs.writeFile(DATA_FILE, jsonContent, 'utf8');
    }).catch(error => {
      console.error('Error writing to waitlist.json:', error);
      throw new Error('STORE_UNAVAILABLE'); // Propagate error for route handler
    });
    return _writePromise;
  }

  return { readStore, hasEmail, addEntry };
}

// Default export for direct use in application code
export const { readStore, hasEmail, addEntry } = createStore();
