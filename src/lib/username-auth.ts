export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

/** Usernames created in-app get a deterministic internal address. */
export const INTERNAL_EMAIL_DOMAIN = "zynoraio.app";

export function isInternalEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

/** Accepts either a username or a real email address and returns the auth email. */
export function identifierToEmail(identifier: string) {
  const value = identifier.trim();
  return value.includes("@") ? value.toLowerCase() : usernameToEmail(value);
}
