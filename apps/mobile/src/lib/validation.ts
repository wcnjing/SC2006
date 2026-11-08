import type { TranslationKey } from '@/i18n/en';

/**
 * Client-side validation (FR 1.1.2, 1.1.4, 1.1.5, 2.1, UC CreateProfile/EditProfile exceptions).
 * Returns an i18n key for the error, or null when valid. The backend must
 * re-validate; this only gives fast feedback.
 */

/** Same rule as P1's validateEmail (@communitylink/shared), with translated messages. */
export function validateEmail(raw: string): TranslationKey | null {
  const email = raw.trim();
  if (!email) return 'error.emailRequired';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'error.emailFormat';
  return null;
}

export const normaliseEmail = (raw: string) => raw.trim().toLowerCase();

/** System password requirements (FR 1.1.4). Stricter than P1's rule (8+ chars, a letter and a digit), so anything that passes here passes there. */
export function validateNewPassword(pw: string): TranslationKey | null {
  if (!pw) return 'error.passwordRequired';
  if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw))
    return 'error.passwordWeak';
  return null;
}

export function validateDisplayName(name: string): TranslationKey | null {
  const n = name.trim();
  if (!n) return 'error.displayNameRequired';
  if (n.length < 2 || n.length > 30) return 'error.displayNameLength';
  return null;
}

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** EditProfile exception 2: unsupported profile picture format. */
export function validateImageType(
  mimeType: string | null | undefined,
  uri: string,
): TranslationKey | null {
  if (mimeType) return SUPPORTED_IMAGE_TYPES.includes(mimeType) ? null : 'error.imageFormat';
  // Some platforms omit mimeType; fall back to extension / data-URI prefix.
  const m = uri.match(/^data:(image\/[a-z]+)/i) ?? uri.match(/\.(jpe?g|png|webp)(\?|$)/i);
  return m ? null : 'error.imageFormat';
}
