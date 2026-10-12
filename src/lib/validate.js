
export function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }
  if (trimmedValue.length > 254) {
    return false;
  }
  // This regex is deliberately permissive as per API Contract -> Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\\.[^\s@]{2,}$/;
  return emailRegex.test(trimmedValue);
}
