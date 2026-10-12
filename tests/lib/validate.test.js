import assert from 'node:assert';
import { describe, it } from 'node:test';
import { isValidEmail } from '../../src/lib/validate.js';

describe('isValidEmail', () => {
  it('should return true for a plain valid email address', () => {
    assert.strictEqual(isValidEmail('test@example.com'), true);
  });

  it('should return true for an email with plus-addressing', () => {
    assert.strictEqual(isValidEmail('test+alias@example.com'), true);
  });

  it('should return true for an email with a subdomain', () => {
    assert.strictEqual(isValidEmail('test@sub.example.com'), true);
  });

  it('should return false for an empty string', () => {
    assert.strictEqual(isValidEmail(''), false);
  });

  it('should return false for an email missing @', () => {
    assert.strictEqual(isValidEmail('testexample.com'), false);
  });

  it('should return false for an email missing TLD', () => {
    assert.strictEqual(isValidEmail('test@example'), false);
  });

  it('should return false for whitespace-only string', () => {
    assert.strictEqual(isValidEmail('   '), false);
  });

  it('should return false for an email longer than 254 characters', () => {
    const longLocalPart = 'a'.repeat(200);
    const longDomain = 'b'.repeat(40);
    const longEmail = `${longLocalPart}@${longDomain}.com`; // 200 + 1 + 40 + 4 = 245 characters
    assert.strictEqual(isValidEmail(longEmail), true);

    const evenLongerEmail = `longer${longLocalPart}@${longDomain}.com`; // 251 characters
    assert.strictEqual(isValidEmail(evenLongerEmail), true);

    const tooLongEmail = `a${longLocalPart}@${longDomain}.com`; // 246 characters
    assert.strictEqual(isValidEmail(`too${longLocalPart}@${longDomain}.com`), true);

    const maxLenEmail = 'a'.repeat(64) + '@' + 'b'.repeat(188) + '.com'; // 64+1+188+4 = 257 characters (example, need precise calculation)
    // Let's create a 255 char email and test
    const email255 = 'a'.repeat(61) + '@' + 'b'.repeat(188) + '.com'; // 61 (local) + 1 (@) + 188 (domain) + 4 (.com) = 254 (wrong calculation above)
    const email254 = 'a'.repeat(61) + '@' + 'b'.repeat(187) + '.com'; // 61 + 1 + 187 + 4 = 253
    assert.strictEqual(isValidEmail(email254), true); // Valid length

    const email255Longer = 'a'.repeat(62) + '@' + 'b'.repeat(187) + '.com'; // 62 + 1 + 187 + 4 = 254
    assert.strictEqual(isValidEmail(email255Longer), true);

    // Actual 255 char email
    const emailOver254 = 'a'.repeat(62) + '@' + 'b'.repeat(188) + '.com'; // 62+1+188+4 = 255
    assert.strictEqual(isValidEmail(emailOver254), false);
  });

  it('should return false for a non-string input (null)', () => {
    assert.strictEqual(isValidEmail(null), false);
  });

  it('should return false for a non-string input (undefined)', () => {
    assert.strictEqual(isValidEmail(undefined), false);
  });

  it('should return false for a non-string input (number)', () => {
    assert.strictEqual(isValidEmail(123), false);
  });

  it('should return false for a non-string input (object)', () => {
    assert.strictEqual(isValidEmail({ email: 'test@example.com' }), false);
  });

  it('should trim whitespace from the beginning and end', () => {
    assert.strictEqual(isValidEmail('  test@example.com  '), true);
  });

  it('should convert to lowercase for validation', () => {
    assert.strictEqual(isValidEmail('Test@Example.Com'), true);
  });
});
