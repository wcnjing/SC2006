import { PASSWORD_MIN_LENGTH } from './constants';

// Each validator returns an error message, or null when the value is valid.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Display name is required';
  if (trimmed.length > 50) return 'Display name must be 50 characters or fewer';
  return null;
}
