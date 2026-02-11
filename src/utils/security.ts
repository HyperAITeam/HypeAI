import { ALLOWED_USER_IDS, BLOCKED_COMMANDS } from "../config.js";

/** Check if a Discord user is whitelisted. Empty whitelist = deny all. */
export function isAllowedUser(userId: string): boolean {
  if (ALLOWED_USER_IDS.size === 0) {
    console.warn("[security] ALLOWED_USER_IDS is empty — all access denied. Set user IDs in .env.");
    return false;
  }
  return ALLOWED_USER_IDS.has(userId);
}

/**
 * Dangerous executable patterns that should be blocked even when
 * they appear in the middle of a command (e.g. piped or chained).
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /\bpowershell(?:\.exe)?\b/i,
  /\bpwsh(?:\.exe)?\b/i,
  /\bcmd(?:\.exe)?\s*\/c\b/i,
  /\bwscript(?:\.exe)?\b/i,
  /\bcscript(?:\.exe)?\b/i,
  /\bmshta(?:\.exe)?\b/i,
  /\bcertutil(?:\.exe)?\b/i,
  /\bbitsadmin(?:\.exe)?\b/i,
  /\bwmic(?:\.exe)?\b/i,
  /\bregsvr32(?:\.exe)?\b/i,
  /\brundll32(?:\.exe)?\b/i,
];

/** Check if a CMD command is in the blocklist. */
export function isCommandBlocked(command: string): boolean {
  const lower = command.trim().toLowerCase();

  // Prefix match against BLOCKED_COMMANDS set
  for (const blocked of BLOCKED_COMMANDS) {
    if (lower.startsWith(blocked)) return true;
  }

  // Regex pattern match for dangerous executables anywhere in command
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) return true;
  }

  return false;
}
