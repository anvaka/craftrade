/** In-memory token buckets. One process, so no shared store is needed. */
export class Buckets {
  private map = new Map<string, { tokens: number; at: number }>();

  constructor(private now: () => number) {}

  /** Take one token from the bucket for key. False means the caller is over the limit. */
  take(key: string, burst: number, perSecond: number): boolean {
    const now = this.now();
    const b = this.map.get(key) ?? { tokens: burst, at: now };
    b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * perSecond);
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.map.set(key, b);
    if (this.map.size > 50_000) this.prune(now);
    return ok;
  }

  /** Drop buckets idle for ten minutes; by then any of ours has refilled. */
  private prune(now: number) {
    for (const [k, b] of this.map) if (now - b.at > 600_000) this.map.delete(k);
  }
}

/** Burst and refill per second, per device token. Per-IP limits are twice these. */
export const LIMITS = {
  post: { burst: 40, perSecond: 2 },
  fuse: { burst: 12, perSecond: 0.5 },
  newDevice: { burst: 10, perSecond: 1 / 30 },
};
