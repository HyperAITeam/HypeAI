import { describe, it, expect, afterEach } from "vitest";
import { RateLimiter } from "../src/utils/rateLimiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("should allow requests up to maxTokens", () => {
    limiter = new RateLimiter({ maxTokens: 3, refillRate: 1, refillIntervalMs: 10000 });

    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(false);
  });

  it("should return retryAfterMs when rate limited", () => {
    limiter = new RateLimiter({ maxTokens: 1, refillRate: 1, refillIntervalMs: 5000 });

    limiter.tryConsume("user1"); // Use the one token
    const result = limiter.tryConsume("user1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(5000);
  });

  it("should have independent buckets per user", () => {
    limiter = new RateLimiter({ maxTokens: 1, refillRate: 1, refillIntervalMs: 10000 });

    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(false);
    expect(limiter.tryConsume("user2").allowed).toBe(true); // Different user
    expect(limiter.tryConsume("user2").allowed).toBe(false);
  });

  it("should refill tokens after interval", async () => {
    limiter = new RateLimiter({ maxTokens: 1, refillRate: 1, refillIntervalMs: 50 });

    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));

    expect(limiter.tryConsume("user1").allowed).toBe(true);
  });

  it("should reset a user's bucket", () => {
    limiter = new RateLimiter({ maxTokens: 2, refillRate: 1, refillIntervalMs: 10000 });

    limiter.tryConsume("user1");
    limiter.tryConsume("user1");
    expect(limiter.tryConsume("user1").allowed).toBe(false);

    limiter.reset("user1");
    expect(limiter.tryConsume("user1").allowed).toBe(true);
  });

  it("should cap tokens at maxTokens after refill", async () => {
    limiter = new RateLimiter({ maxTokens: 2, refillRate: 1, refillIntervalMs: 30 });

    // Use one token
    limiter.tryConsume("user1");

    // Wait for multiple refill periods
    await new Promise((r) => setTimeout(r, 100));

    // Should have at most maxTokens (2), not more
    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(true);
    expect(limiter.tryConsume("user1").allowed).toBe(false);
  });
});
