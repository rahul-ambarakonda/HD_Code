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

  it('should return true for an email of exactly 254 characters', () => {
    // A 254-character email: 61 chars local, 1 '@', 188 chars domain, 4 chars '.com'
    const email254Chars = 'a'.repeat(61) + '@' + 'b'.repeat(188) + '.com';
    assert.strictEqual(email254Chars.length, 254);
    assert.strictEqual(isValidEmail(email254Chars), true);
  });

  it('should return false for an email longer than 254 characters (255 chars)', () => {
    // A 255-character email: 62 chars local, 1 '@', 188 chars domain, 4 chars '.com'
    const email255Chars = 'a'.repeat(62) + '@' + 'b'.repeat(188) + '.com';
    assert.strictEqual(email255Chars.length, 255);
    assert.strictEqual(isValidEmail(email255Chars), false);
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
