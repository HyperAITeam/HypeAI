/**
 * Prompt injection detection and security context wrapping.
 *
 * This module provides a warning-only detection layer — it does NOT
 * block messages, but flags suspicious patterns for user awareness.
 */

const INJECTION_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, description: "instruction override" },
  { pattern: /ignore\s+(all\s+)?above\s+instructions/i, description: "instruction override" },
  { pattern: /disregard\s+(all\s+)?previous/i, description: "instruction override" },
  { pattern: /forget\s+(all\s+)?previous/i, description: "instruction override" },
  { pattern: /you\s+are\s+now\s+/i, description: "role reassignment" },
  { pattern: /new\s+instructions?:/i, description: "instruction injection" },
  { pattern: /system\s*:\s*/i, description: "system prompt injection" },
  { pattern: /\[INST\]/i, description: "prompt format injection" },
  { pattern: /<\|im_start\|>/i, description: "prompt format injection" },
  { pattern: /\bDAN\b.*\bmode\b/i, description: "jailbreak attempt" },
  { pattern: /do\s+anything\s+now/i, description: "jailbreak attempt" },
];

export interface InjectionCheckResult {
  detected: boolean;
  warnings: string[];
}

/**
 * Check user input for common prompt injection patterns.
 * Returns detected patterns (warning only — does not block).
 */
export function checkPromptInjection(input: string): InjectionCheckResult {
  const warnings: string[] = [];

  for (const { pattern, description } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      warnings.push(description);
    }
  }

  return {
    detected: warnings.length > 0,
    warnings: [...new Set(warnings)],
  };
}

/**
 * Wrap a user message with a security context prefix that reminds
 * the AI about working directory restrictions.
 */
export function wrapWithSecurityContext(message: string, workingDir: string): string {
  return (
    `[Security Context: Only operate within "${workingDir}". ` +
    `Do not access files outside this directory. ` +
    `Do not execute destructive system commands.]\n\n${message}`
  );
}
