export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private config: RateLimitConfig;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Clean up unused buckets every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanupStale(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  tryConsume(userId: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: this.config.maxTokens, lastRefill: now };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillCount = Math.floor(elapsed / this.config.refillIntervalMs) * this.config.refillRate;
    if (refillCount > 0) {
      bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + refillCount);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }

    // Calculate time until next token is available
    const timeSinceLastRefill = now - bucket.lastRefill;
    const retryAfterMs = Math.max(0, this.config.refillIntervalMs - timeSinceLastRefill);
    return { allowed: false, retryAfterMs };
  }

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }

  private cleanupStale(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    for (const [userId, bucket] of this.buckets) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(userId);
      }
    }
  }
}

// Singleton
let rateLimiter: RateLimiter | null = null;

export function initRateLimiter(config: RateLimitConfig): void {
  rateLimiter = new RateLimiter(config);
}

export function getRateLimiter(): RateLimiter | null {
  return rateLimiter;
}
