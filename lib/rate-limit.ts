import "server-only";

// Simple fixed-window, in-memory rate limiter. Adequate "for this scale":
// counters live in process memory and reset on restart. Not shared across
// multiple Node instances — fine for a single-process VPS deployment.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Record an attempt for `key` and report whether it is allowed.
 * Allows up to `limit` attempts per `windowMs`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    const fresh: Window = { count: 1, resetAt: now + windowMs };
    windows.set(key, fresh);
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterMs: allowed ? 0 : existing.resetAt - now,
  };
}

// Opportunistic cleanup so the map does not grow unbounded. Called on each
// login attempt; cheap because the map stays small at this scale.
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key);
  }
}
