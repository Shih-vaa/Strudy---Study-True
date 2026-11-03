// Password rules shared by the setup screen (instant feedback) and main (the real check).

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 256;

/** Returns a message if the password is not acceptable, otherwise null. */
export function validatePasswordLength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  return null;
}

/** Checks a new password and its confirmation; returns a message, or null if both are fine. */
export function checkNewPassword(password: string, confirmation: string): string | null {
  const tooShortOrLong = validatePasswordLength(password);
  if (tooShortOrLong) return tooShortOrLong;
  return password === confirmation ? null : "The two passwords don't match.";
}
