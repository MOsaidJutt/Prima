// ── Bcrypt round constants ────────────────────────────────────────────────────
// Passwords get 12 rounds — slow enough to resist offline brute force.
// Invitation / reset tokens get 10 rounds — random 48-char tokens are already
// high-entropy, so expensive hashing adds latency without meaningful security gain.

export const BCRYPT_ROUNDS_PASSWORD = 12
export const BCRYPT_ROUNDS_TOKEN = 10

// ── Token sizes ───────────────────────────────────────────────────────────────

export const INVITE_TOKEN_LENGTH = 48
export const TOKEN_PREFIX_LENGTH = 8

// ── Session / expiry ──────────────────────────────────────────────────────────

export const INVITE_TTL_HOURS = 48
export const PASSWORD_RESET_TTL_HOURS = 1
