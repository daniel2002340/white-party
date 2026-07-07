import { randomInt } from "node:crypto";

// Unambiguous alphabet: no 0/O, 1/l/I to keep hand-typed passwords painless.
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Generate a cryptographically-random temporary password (default 16 chars). */
export function generateTempPassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
