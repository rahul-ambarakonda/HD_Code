/**
 * @file Contains email validation utility.
 */

/**
 * Validates an email address.
 * Trims and lowercases the value. Rejects if empty, longer than 254 characters,
 * or doesn't match a permissive email regex.
 *
 * @param {string} value - The email address to validate.
 * @returns {boolean} - True if the email is valid, false otherwise.
 */
export function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedEmail = value.trim().toLowerCase();

  if (normalizedEmail.length === 0 || normalizedEmail.length > 254) {
    return false;
  }

  // Permissive email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(normalizedEmail);
}
