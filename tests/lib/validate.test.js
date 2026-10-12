import assert from 'node:assert';
import { describe, it } from 'node:test';
import { isValidEmail } from '../../src/lib/validate.js';

describe('isValidEmail', () => {
  it('should return true for a plain valid email address', () => {
    assert.strictEqual(isValidEmail('test@example.com'), true);
  });

  it('should return true for an email with a subdomain', () => {
    assert.strictEqual(isValidEmail('test@sub.example.com'), true);
  });

  it('should return true for an email with plus-addressing', () => {
    assert.strictEqual(isValidEmail('test+alias@example.com'), true);
  });

  it('should return true for an email with a hyphen in domain', () => {
    assert.strictEqual(isValidEmail('test@example-domain.com'), true);
  });

  it('should return true for an email with a number in domain', () => {
    assert.strictEqual(isValidEmail('test@example123.com'), true);
  });

  it('should return true for an email with mixed case, after trimming and lowercasing', () => {
    assert.strictEqual(isValidEmail('  Test@Example.com  '), true);
  });

  it('should return false for an empty string', () => {
    assert.strictEqual(isValidEmail(''), false);
  });

  it('should return false for whitespace-only string', () => {
    assert.strictEqual(isValidEmail('   '), false);
  });

  it('should return false for a missing @ symbol', () => {
    assert.strictEqual(isValidEmail('testexample.com'), false);
  });

  it('should return false for a missing TLD', () => {
    assert.strictEqual(isValidEmail('test@example'), false);
  });

  it('should return false for a TLD with less than 2 characters', () => {
    assert.strictEqual(isValidEmail('test@example.c'), false);
  });

  it('should return false for an email longer than 254 characters', () => {
    const longEmail = 'a'.repeat(240) + '@' + 'b'.repeat(10) + '.com'; // 240 + 1 + 10 + 4 = 255
    assert.strictEqual(isValidEmail(longEmail), false);
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
    assert.strictEqual(isValidEmail({}), false);
  });
});
