import { describe, it, expect } from "vitest";
import { isTransientError, withRetry, type RetryConfig } from "../src/utils/retry.js";

const fastConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10,
  maxDelayMs: 50,
  backoffMultiplier: 2,
};

describe("isTransientError", () => {
  it("should classify ECONNREFUSED as transient", () => {
    expect(isTransientError(new Error("connect ECONNREFUSED 127.0.0.1:8080"))).toBe(true);
  });

  it("should classify ETIMEDOUT as transient", () => {
    expect(isTransientError(new Error("ETIMEDOUT"))).toBe(true);
  });

  it("should classify timeout as transient", () => {
    expect(isTransientError("request timeout")).toBe(true);
  });

  it("should classify spawn errors as transient (not ENOENT)", () => {
    expect(isTransientError(new Error("spawn error"))).toBe(true);
  });

  it("should classify ENOENT as permanent", () => {
    expect(isTransientError(new Error("ENOENT: no such file"))).toBe(false);
  });

  it("should classify EACCES as permanent", () => {
    expect(isTransientError(new Error("EACCES: permission denied"))).toBe(false);
  });

  it("should classify 'not installed' as permanent", () => {
    expect(isTransientError(new Error("gemini is not installed"))).toBe(false);
  });

  it("should classify 'not authorized' as permanent", () => {
    expect(isTransientError(new Error("not authorized"))).toBe(false);
  });

  it("should classify unknown errors as non-transient", () => {
    expect(isTransientError(new Error("some random error"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("should return on first success", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        return "ok";
      },
      fastConfig,
    );
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("should retry on transient error and succeed", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("ECONNREFUSED");
        return "recovered";
      },
      fastConfig,
    );
    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("should throw after max retries exceeded", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error("ECONNREFUSED");
        },
        { ...fastConfig, maxRetries: 2 },
      ),
    ).rejects.toThrow("ECONNREFUSED");
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("should throw immediately on permanent error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error("ENOENT: no such file");
        },
        fastConfig,
      ),
    ).rejects.toThrow("ENOENT");
    expect(calls).toBe(1); // No retries
  });

  it("should call onRetry callback", async () => {
    const retries: number[] = [];
    let calls = 0;

    await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("ECONNREFUSED");
        return "ok";
      },
      fastConfig,
      (attempt) => {
        retries.push(attempt);
      },
    );

    expect(retries).toEqual([1, 2]);
  });

  it("should respect maxRetries=0 (no retries)", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error("ECONNREFUSED");
        },
        { ...fastConfig, maxRetries: 0 },
      ),
    ).rejects.toThrow("ECONNREFUSED");
    expect(calls).toBe(1);
  });
});
