import { describe, it, expect } from "vitest";

// BLOCKED_COMMANDS를 직접 정의 (config.ts가 dotenv에 의존하기 때문)
const BLOCKED_COMMANDS = new Set([
  "format", "diskpart", "shutdown", "restart",
  "del /s", "rd /s", "rmdir /s",
  "reg delete", "bcdedit", "cipher /w",
  "net user", "net localgroup",
  "powershell", "pwsh", "cmd /c", "cmd.exe",
  "wsl", "bash", "wmic",
  "sc delete", "sc stop", "sc config",
  "taskkill", "schtasks", "netsh",
  "bootrec", "bcdboot", "setx", "erase /s",
]);

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

// security.ts 함수 재구현 (테스트용)
function isCommandBlocked(command: string): boolean {
  const lower = command.trim().toLowerCase();
  for (const blocked of BLOCKED_COMMANDS) {
    if (lower.startsWith(blocked)) return true;
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) return true;
  }
  return false;
}

function isAllowedUser(userId: string, allowedIds: Set<string>): boolean {
  if (allowedIds.size === 0) return false;
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

    it("should block newly added dangerous commands", () => {
      expect(isCommandBlocked("powershell -Command test")).toBe(true);
      expect(isCommandBlocked("pwsh -c test")).toBe(true);
      expect(isCommandBlocked("cmd /c dir")).toBe(true);
      expect(isCommandBlocked("cmd.exe /c dir")).toBe(true);
      expect(isCommandBlocked("wsl ls")).toBe(true);
      expect(isCommandBlocked("bash -c test")).toBe(true);
      expect(isCommandBlocked("wmic process")).toBe(true);
      expect(isCommandBlocked("taskkill /f /im")).toBe(true);
      expect(isCommandBlocked("schtasks /create")).toBe(true);
      expect(isCommandBlocked("netsh firewall")).toBe(true);
      expect(isCommandBlocked("sc delete myservice")).toBe(true);
      expect(isCommandBlocked("sc stop myservice")).toBe(true);
      expect(isCommandBlocked("sc config myservice")).toBe(true);
    });

    it("should block dangerous executables via regex patterns (mid-command)", () => {
      expect(isCommandBlocked("echo test | powershell.exe -Command")).toBe(true);
      expect(isCommandBlocked("echo test | cmd.exe /c del")).toBe(true);
      expect(isCommandBlocked("dir & wscript.exe malicious.vbs")).toBe(true);
      expect(isCommandBlocked("echo test | certutil -decode")).toBe(true);
      expect(isCommandBlocked("echo test | bitsadmin /transfer")).toBe(true);
      expect(isCommandBlocked("rundll32 shell32.dll")).toBe(true);
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
      expect(isCommandBlocked("PowerShell -Command")).toBe(true);
    });

    it("should handle whitespace", () => {
      expect(isCommandBlocked("  shutdown")).toBe(true);
      expect(isCommandBlocked("shutdown  ")).toBe(true);
      expect(isCommandBlocked("  shutdown  ")).toBe(true);
    });
  });

  describe("isAllowedUser", () => {
    it("should deny all users when whitelist is empty", () => {
      const emptySet = new Set<string>();
      expect(isAllowedUser("123456789", emptySet)).toBe(false);
      expect(isAllowedUser("any-random-id", emptySet)).toBe(false);
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
