export interface RateLimiterOptions {
  /** Millisecond clock; injectable so a caller can drive it deterministically. Defaults to `Date.now`. */
  readonly now?: () => number;
}

/**
 * A pure per-key sliding-window limiter.
 *
 * It owns no audio state: callers ask whether a keyed request may proceed, and the limiter records what
 * it allowed and drops what has aged out of the window. An absent key is the caller's signal to skip
 * limiting entirely, so this is only consulted for keyed cues.
 */
export class RateLimiter {
  private readonly history = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(options: RateLimiterOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Records and allows the request, or refuses when `key` already has `maxPerWindow` allowed requests
   * inside the trailing `windowSeconds`. A non-positive allowance refuses unconditionally.
   */
  tryAcquire(key: string, maxPerWindow: number, windowSeconds: number): boolean {
    if (maxPerWindow <= 0) {
      return false;
    }

    const now = this.now();
    const windowMs = Math.max(0, windowSeconds) * 1000;
    const kept = (this.history.get(key) ?? []).filter((stamp) => now - stamp <= windowMs);

    if (kept.length >= maxPerWindow) {
      this.history.set(key, kept);
      return false;
    }

    kept.push(now);
    this.history.set(key, kept);
    return true;
  }

  clear(): void {
    this.history.clear();
  }
}
