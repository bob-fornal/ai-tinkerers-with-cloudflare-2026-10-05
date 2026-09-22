const THUNK_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i — avoids visual ambiguity
const THUNK_LENGTH = 12; // 33^12 keyspace — not sequential, not guessable, not derived from user info

/**
 * Generates a high-entropy, non-sequential thunk tag. Callers must retry on
 * the rare unique-constraint collision (see db/users.ts).
 */
export function generateThunk(): string {
  const bytes = new Uint8Array(THUNK_LENGTH);
  crypto.getRandomValues(bytes);
  let thunk = "";
  for (const byte of bytes) {
    thunk += THUNK_ALPHABET.charAt(byte % THUNK_ALPHABET.length);
  }
  return thunk;
}
