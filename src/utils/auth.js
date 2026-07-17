// Local-first auth: an account is created once (username + password), stored
// hashed in IndexedDB. Logging in mints a random token, stored both in
// IndexedDB (source of truth + expiry) and as a cookie (so a refresh/close
// doesn't force a re-login). Token expires 7 days after creation, or on logout.

export const TOKEN_COOKIE = 'billhive_token';
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder().encode(salt + ':' + password);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return bufToHex(digest);
}

export function generateToken() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}
