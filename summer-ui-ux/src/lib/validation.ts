import type { TranslationKey } from '@/i18n/en';

/**
 * Client-side validation (FR 1.1.2, 1.1.4, 1.1.5, 2.1, UC CreateProfile/EditProfile exceptions).
 * Returns an i18n key for the error, or null when valid. The backend must
 * re-validate; this only gives fast feedback.
 */

/** Strip spaces/dashes and an optional +65 prefix. */
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '').replace(/^\+?65(?=\d{8}$)/, '');
}

/** Singapore numbers: 8 digits starting with 3 (VoIP), 6 (landline), 8 or 9 (mobile). */
export function validatePhone(raw: string): TranslationKey | null {
  const phone = normalisePhone(raw);
  if (!phone) return 'error.phoneRequired';
  if (!/^[3689]\d{7}$/.test(phone)) return 'error.phoneFormat';
  return null;
}

/** System password requirements (FR 1.1.4). Keep in sync with P1's backend rule. */
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
