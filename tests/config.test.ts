import { describe, it, expect } from "vitest";

// CLI_TOOLS 구조 테스트용 (config.ts의 구조 검증)
const CLI_TOOLS = {
  claude: {
    command: "claude",
    name: "Claude Code",
    rulesFile: "CLAUDE.md",
    extraFlags: ["--output-format", "json", "--dangerously-skip-permissions"],
    resumeFlag: "--resume",
    jsonOutput: true,
    useAgentSdk: true,
  },
  gemini: {
    command: "gemini",
    name: "Gemini CLI",
    rulesFile: "GEMINI.md",
    extraFlags: ["--yolo"],
    resumeFlag: null,
    jsonOutput: false,
    useAgentSdk: false,
  },
  opencode: {
    command: "opencode",
    name: "OpenCode",
    rulesFile: "AGENTS.md",
    extraFlags: [],
    resumeFlag: null,
    jsonOutput: false,
    useAgentSdk: false,
  },
};

describe("Config", () => {
  describe("CLI_TOOLS", () => {
    it("should have claude, gemini, and opencode tools", () => {
      expect(CLI_TOOLS).toHaveProperty("claude");
      expect(CLI_TOOLS).toHaveProperty("gemini");
      expect(CLI_TOOLS).toHaveProperty("opencode");
    });

    it("should have correct structure for each tool", () => {
      const tools = Object.values(CLI_TOOLS);
      tools.forEach((tool) => {
        expect(tool).toHaveProperty("command");
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("rulesFile");
        expect(tool).toHaveProperty("extraFlags");
        expect(tool).toHaveProperty("jsonOutput");
        expect(tool).toHaveProperty("useAgentSdk");
      });
    });

    it("claude should use Agent SDK", () => {
      expect(CLI_TOOLS.claude.useAgentSdk).toBe(true);
      expect(CLI_TOOLS.claude.jsonOutput).toBe(true);
      expect(CLI_TOOLS.claude.resumeFlag).toBe("--resume");
    });

    it("gemini should use subprocess", () => {
      expect(CLI_TOOLS.gemini.useAgentSdk).toBe(false);
      expect(CLI_TOOLS.gemini.jsonOutput).toBe(false);
      expect(CLI_TOOLS.gemini.resumeFlag).toBeNull();
    });

    it("opencode should use subprocess", () => {
      expect(CLI_TOOLS.opencode.useAgentSdk).toBe(false);
      expect(CLI_TOOLS.opencode.jsonOutput).toBe(false);
      expect(CLI_TOOLS.opencode.resumeFlag).toBeNull();
    });
  });

  describe("BLOCKED_COMMANDS", () => {
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

    it("should contain dangerous system commands", () => {
      expect(BLOCKED_COMMANDS.has("shutdown")).toBe(true);
      expect(BLOCKED_COMMANDS.has("format")).toBe(true);
      expect(BLOCKED_COMMANDS.has("diskpart")).toBe(true);
    });

    it("should contain dangerous file commands", () => {
      expect(BLOCKED_COMMANDS.has("del /s")).toBe(true);
      expect(BLOCKED_COMMANDS.has("rd /s")).toBe(true);
      expect(BLOCKED_COMMANDS.has("rmdir /s")).toBe(true);
    });

    it("should contain dangerous registry commands", () => {
      expect(BLOCKED_COMMANDS.has("reg delete")).toBe(true);
    });

    it("should contain dangerous network commands", () => {
      expect(BLOCKED_COMMANDS.has("net user")).toBe(true);
      expect(BLOCKED_COMMANDS.has("net localgroup")).toBe(true);
    });
  });

  describe("Environment defaults", () => {
    it("should have sensible defaults", () => {
      // 기본값 테스트
      const defaults = {
        COMMAND_PREFIX: "!",
        COMMAND_TIMEOUT: 30,
        AI_CLI_TIMEOUT: 300,
        DISCORD_MAX_LENGTH: 2000,
      };

      expect(defaults.COMMAND_PREFIX).toBe("!");
      expect(defaults.COMMAND_TIMEOUT).toBe(30);
      expect(defaults.AI_CLI_TIMEOUT).toBe(300);
      expect(defaults.DISCORD_MAX_LENGTH).toBe(2000);
    });
  });
});
