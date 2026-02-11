export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const TRANSIENT_PATTERNS = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "timeout",
  "socket hang up",
  "network",
  "spawn",
];

const PERMANENT_PATTERNS = [
  "ENOENT",
  "EACCES",
  "EPERM",
  "not installed",
  "not authorized",
  "not found",
  "permission denied",
];

export function isTransientError(error: Error | string): boolean {
  const msg = typeof error === "string" ? error : error.message;
  const lower = msg.toLowerCase();

  // Permanent errors take priority
  for (const pat of PERMANENT_PATTERNS) {
    if (lower.includes(pat.toLowerCase())) return false;
  }

  // Check for transient patterns
  for (const pat of TRANSIENT_PATTERNS) {
    if (lower.includes(pat.toLowerCase())) return true;
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: (attempt: number, error: Error, delayMs: number) => void | Promise<void>,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // If max retries reached or not transient, throw immediately
      if (attempt >= config.maxRetries || !isTransientError(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs,
      );

      if (onRetry) {
        await onRetry(attempt + 1, lastError, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error("withRetry: unexpected state");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
