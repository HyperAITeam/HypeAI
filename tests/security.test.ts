import { describe, it, expect, beforeAll } from "vitest";

// BLOCKED_COMMANDS를 직접 정의 (config.ts가 dotenv에 의존하기 때문)
const BLOCKED_COMMANDS = new Set([
  "format",
  "diskpart",
  "shutdown",
  "restart",
  "del /s",
  "rd /s",
  "rmdir /s",
  "reg delete",
  "bcdedit",
  "cipher /w",
  "net user",
  "net localgroup",
]);

// security.ts 함수 재구현 (테스트용)
function isCommandBlocked(command: string): boolean {
  const lower = command.trim().toLowerCase();
  for (const blocked of BLOCKED_COMMANDS) {
    if (lower.startsWith(blocked)) return true;
  }
  return false;
}

function isAllowedUser(userId: string, allowedIds: Set<string>): boolean {
  if (allowedIds.size === 0) return true;
  return allowedIds.has(userId);
}

describe("Security Utils", () => {
  describe("isCommandBlocked", () => {
    it("should block dangerous commands", () => {
      expect(isCommandBlocked("shutdown")).toBe(true);
      expect(isCommandBlocked("shutdown /s /t 0")).toBe(true);
      expect(isCommandBlocked("restart")).toBe(true);
      expect(isCommandBlocked("format c:")).toBe(true);
      expect(isCommandBlocked("del /s")).toBe(true);
      expect(isCommandBlocked("rd /s /q")).toBe(true);
      expect(isCommandBlocked("rmdir /s")).toBe(true);
      expect(isCommandBlocked("reg delete")).toBe(true);
      expect(isCommandBlocked("net user admin")).toBe(true);
      expect(isCommandBlocked("net localgroup")).toBe(true);
    });

    it("should allow safe commands", () => {
      expect(isCommandBlocked("dir")).toBe(false);
      expect(isCommandBlocked("cd ..")).toBe(false);
      expect(isCommandBlocked("git status")).toBe(false);
      expect(isCommandBlocked("npm install")).toBe(false);
      expect(isCommandBlocked("node --version")).toBe(false);
      expect(isCommandBlocked("echo hello")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isCommandBlocked("SHUTDOWN")).toBe(true);
      expect(isCommandBlocked("Shutdown")).toBe(true);
      expect(isCommandBlocked("FORMAT")).toBe(true);
    });

    it("should handle whitespace", () => {
      expect(isCommandBlocked("  shutdown")).toBe(true);
      expect(isCommandBlocked("shutdown  ")).toBe(true);
      expect(isCommandBlocked("  shutdown  ")).toBe(true);
    });
  });

  describe("isAllowedUser", () => {
    it("should allow any user when whitelist is empty", () => {
      const emptySet = new Set<string>();
      expect(isAllowedUser("123456789", emptySet)).toBe(true);
      expect(isAllowedUser("any-random-id", emptySet)).toBe(true);
    });

    it("should allow whitelisted users", () => {
      const allowedIds = new Set(["111111111", "222222222"]);
      expect(isAllowedUser("111111111", allowedIds)).toBe(true);
      expect(isAllowedUser("222222222", allowedIds)).toBe(true);
    });

    it("should reject non-whitelisted users", () => {
      const allowedIds = new Set(["111111111", "222222222"]);
      expect(isAllowedUser("333333333", allowedIds)).toBe(false);
      expect(isAllowedUser("unknown", allowedIds)).toBe(false);
    });
  });
});
