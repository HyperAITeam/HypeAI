import dotenv from "dotenv";
import path from "node:path";
import type { CliTool } from "./types.js";

// .exe 실행 시에도 exe와 같은 폴더의 .env를 로드
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Discord
export let DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
export let COMMAND_PREFIX = process.env.COMMAND_PREFIX ?? "!";

// Security
export let ALLOWED_USER_IDS = new Set(
  (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

// Timeouts (with range clamping)
function clampTimeout(value: number, defaultVal: number, min: number, max: number): number {
  if (isNaN(value)) return defaultVal;
  return Math.max(min, Math.min(max, value));
}

export let COMMAND_TIMEOUT = clampTimeout(
  parseInt(process.env.COMMAND_TIMEOUT ?? "30", 10), 30, 5, 120,
);
export let AI_CLI_TIMEOUT = clampTimeout(
  parseInt(process.env.AI_CLI_TIMEOUT ?? "300", 10), 300, 30, 1800,
);

/** Reload config from .env (used after interactive setup creates .env) */
export function reloadConfig(): void {
  dotenv.config({ path: path.join(process.cwd(), ".env"), override: true });
  DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
  COMMAND_PREFIX = process.env.COMMAND_PREFIX ?? "!";
  ALLOWED_USER_IDS = new Set(
    (process.env.ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  COMMAND_TIMEOUT = clampTimeout(
    parseInt(process.env.COMMAND_TIMEOUT ?? "30", 10), 30, 5, 120,
  );
  AI_CLI_TIMEOUT = clampTimeout(
    parseInt(process.env.AI_CLI_TIMEOUT ?? "300", 10), 300, 30, 1800,
  );
}

// CLI tool definitions
export const CLI_TOOLS: Record<string, CliTool> = {
  claude: {
    command: "claude",
    maxTimeout: AI_CLI_TIMEOUT,
    name: "Claude Code",
    rulesFile: "CLAUDE.md",
    promptArgs: ["-p"],
    extraFlags: ["--output-format", "json", "--dangerously-skip-permissions"],
    resumeFlag: "--resume",
    continueFlag: null,
    jsonOutput: true,
    useAgentSdk: true,
  },
  gemini: {
    command: "gemini",
    maxTimeout: AI_CLI_TIMEOUT,
    name: "Gemini CLI",
    rulesFile: "GEMINI.md",
    promptArgs: ["-p"],
    extraFlags: ["--yolo"],
    resumeFlag: "--resume",
    continueFlag: null,
    jsonOutput: true,
    useAgentSdk: false,
    useStreamJson: true,
  },
  opencode: {
    command: "opencode",
    maxTimeout: AI_CLI_TIMEOUT,
    name: "OpenCode",
    rulesFile: "AGENTS.md",
    promptArgs: ["run"],
    extraFlags: ["--print-logs"],
    resumeFlag: null,
    continueFlag: "-c",
    jsonOutput: false,
    useAgentSdk: false,
  },
};

// Blocked commands for !exec (prefix-matched against user input)
export const BLOCKED_COMMANDS = new Set([
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

// Discord message limit
export const DISCORD_MAX_LENGTH = 2000;
