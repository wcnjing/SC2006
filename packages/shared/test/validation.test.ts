import { describe, expect, it } from 'vitest';
import { validateDisplayName, validateEmail, validatePassword } from '../src/validation';

describe('validateEmail', () => {
  it('accepts a normal address', () => {
    expect(validateEmail('resident@example.com')).toBeNull();
  });
  it('rejects empty and malformed addresses', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address');
  });
});

describe('validatePassword', () => {
  it('requires 8+ characters with a letter and a number', () => {
    expect(validatePassword('abc12345')).toBeNull();
    expect(validatePassword('abc123')).toMatch(/at least 8/);
    expect(validatePassword('abcdefgh')).toMatch(/letter and one number/);
    expect(validatePassword('12345678')).toMatch(/letter and one number/);
  });
});

describe('validateDisplayName', () => {
  it('rejects blank and overly long names', () => {
    expect(validateDisplayName('  ')).toBe('Display name is required');
    expect(validateDisplayName('a'.repeat(51))).toMatch(/50 characters/);
    expect(validateDisplayName('Auntie Mei')).toBeNull();
  });
});
