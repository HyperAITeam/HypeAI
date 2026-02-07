import { ALLOWED_USER_IDS, BLOCKED_COMMANDS } from "../config.js";

/** Check if a Discord user is whitelisted. */
export function isAllowedUser(userId: string): boolean {
  if (ALLOWED_USER_IDS.size === 0) return true;
  return ALLOWED_USER_IDS.has(userId);
}

/** Check if a CMD command is in the blocklist. */
export function isCommandBlocked(command: string): boolean {
  const lower = command.trim().toLowerCase();
  for (const blocked of BLOCKED_COMMANDS) {
    if (lower.startsWith(blocked)) return true;
  }
  return false;
}
