/**
 * Sanitize output before sending to Discord.
 * Redacts API keys, tokens, user paths, and environment variable assignments.
 */

const SENSITIVE_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // API keys and tokens (common prefixes)
  { pattern: /\b(sk-[a-zA-Z0-9_-]{20,})/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /\b(ghp_[a-zA-Z0-9]{36,})/g, replacement: "[REDACTED_TOKEN]" },
  { pattern: /\b(gho_[a-zA-Z0-9]{36,})/g, replacement: "[REDACTED_TOKEN]" },
  { pattern: /\b(github_pat_[a-zA-Z0-9_]{22,})/g, replacement: "[REDACTED_TOKEN]" },
  { pattern: /\b(xox[bpsa]-[a-zA-Z0-9-]{10,})/g, replacement: "[REDACTED_TOKEN]" },
  { pattern: /\b(AIza[a-zA-Z0-9_-]{35})/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /Bearer\s+[a-zA-Z0-9._\-\/+=]{20,}/gi, replacement: "Bearer [REDACTED]" },

  // Environment variable assignments with sensitive values
  { pattern: /(ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY|DISCORD_BOT_TOKEN|API_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN)=[^\s\n]+/gi, replacement: "$1=[REDACTED]" },

  // Windows user paths (redact username)
  { pattern: /[A-Z]:\\Users\\[^\\"\s]+/gi, replacement: "[REDACTED_PATH]" },

  // npm auth tokens
  { pattern: /\/\/[^:]+:_authToken=[^\s\n]+/g, replacement: "//[REDACTED_REGISTRY]:_authToken=[REDACTED]" },
];

/**
 * Remove sensitive information from output text.
 */
export function sanitizeOutput(text: string): string {
  let result = text;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}
