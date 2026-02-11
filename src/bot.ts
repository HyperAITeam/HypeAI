import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ActivityType,
} from "discord.js";
import { DISCORD_BOT_TOKEN, COMMAND_PREFIX, CLI_TOOLS, ALLOWED_USER_IDS, reloadConfig } from "./config.js";
import type { BotClient, PrefixCommand, CommandContext } from "./types.js";
import type { ISessionManager } from "./sessions/types.js";
import { ClaudeSessionManager } from "./sessions/claude.js";
import { SubprocessSessionManager } from "./sessions/subprocess.js";
import { GeminiSessionManager } from "./sessions/gemini.js";
import {
  MultiSessionManager,
  setMultiSessionManager,
  getMultiSessionManager,
} from "./sessions/multiSession.js";
import { sanitizeOutput } from "./utils/sanitizeOutput.js";
import { closeBrowser } from "./utils/diffRenderer.js";

// ── Static command imports (for .exe bundling) ──────────────────────
import askCommand from "./commands/ask.js";
import sessionCommand from "./commands/session.js";
import execCommand from "./commands/exec.js";
import statusCommand from "./commands/status.js";
import helpCommand from "./commands/help.js";
import myidCommand from "./commands/myid.js";
import taskCommand from "./commands/task.js";
import diffCommand from "./commands/diff.js";

// ── Global error handlers (prevent silent crash in exe) ─────────────
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

// ── Console readline helper ──────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    }),
  );
}

// ── First-run .env setup ─────────────────────────────────────────────

async function setupEnv(): Promise<void> {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) return;

  console.log();
  console.log("=".repeat(48));
  console.log("  초기 설정 — .env 파일 생성");
  console.log("=".repeat(48));
  console.log();
  console.log("  .env 파일이 없습니다. 필수 정보를 입력해주세요.");
  console.log();

  // 1) Discord 봇 토큰
  let token: string;
  while (true) {
    token = await ask("  [1/2] Discord 봇 토큰: ");
    if (token) break;
    console.log("  봇 토큰은 필수입니다. 다시 입력해주세요.");
  }

  // 2) Discord 유저 ID
  let userId: string;
  while (true) {
    userId = await ask("  [2/2] Discord 유저 ID: ");
    if (userId) break;
    console.log("  유저 ID는 필수입니다. 다시 입력해주세요.");
  }

  const envContent = [
    `DISCORD_BOT_TOKEN=${token}`,
    `ALLOWED_USER_IDS=${userId}`,
    `COMMAND_PREFIX=!`,
    `COMMAND_TIMEOUT=30`,
    `AI_CLI_TIMEOUT=300`,
  ].join("\n") + "\n";

  fs.writeFileSync(envPath, envContent, "utf-8");
  reloadConfig();

  console.log();
  console.log("  .env 파일이 생성되었습니다!");
  console.log();
}

// ── Startup interactive setup ────────────────────────────────────────

async function startupSetup(): Promise<{ cliName: string; workingDir: string }> {
  const tools = Object.entries(CLI_TOOLS);

  console.log();
  console.log("=".repeat(48));
  console.log("  AI CLI Gateway Bot");
  console.log("=".repeat(48));

  // 1) CLI tool selection
  console.log();
  console.log("  [1/2] Select AI CLI tool:");
  console.log();
  tools.forEach(([key, t], i) => {
    console.log(`    ${i + 1}) ${t.name}  (${key})`);
  });
  console.log();

  let cliName: string;
  while (true) {
    const raw = await ask(`  Enter number [1-${tools.length}] (default: 1): `);
    if (raw === "") {
      cliName = tools[0][0];
      break;
    }
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= tools.length) {
      cliName = tools[n - 1][0];
      break;
    }
    console.log("  Invalid choice, try again.");
  }

  const toolName = CLI_TOOLS[cliName].name;
  console.log(`  -> ${toolName} selected!`);

  // 2) Working directory
  console.log();
  console.log("  [2/2] Enter working directory:");
  console.log(`        (The folder where ${toolName} will run)`);
  console.log();

  let cwd: string;
  while (true) {
    const raw = await ask(`  Path (default: ${process.cwd()}): `);
    cwd = raw || process.cwd();
    cwd = cwd.replace(/^["']|["']$/g, "");
    if (fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()) break;
    console.log(`  '${cwd}' is not a valid directory. Try again.`);
  }

  cwd = path.resolve(cwd);
  console.log(`  -> Working directory: ${cwd}`);
  console.log();
  console.log("=".repeat(48));
  console.log(`  ${toolName}  @  ${cwd}`);
  console.log("=".repeat(48));
  console.log();

  ensureRulesMd(cliName, cwd);

  return { cliName, workingDir: cwd };
}

// ── Rules MD ─────────────────────────────────────────────────────────

const RULES_MARKER = "# [AIDevelop Bot Rules]";
const RULES_TEMPLATE = `\
# [AIDevelop Bot Rules]
# Auto-generated by AIDevelop bot — do not remove this section.

## Working Directory Restriction
- You MUST only read, write, and modify files within this project directory.
- Do NOT access or modify files outside of this folder.
- Shell commands must only operate within this directory.

## Allowed Actions
- File operations (read, write, edit, search) — within this folder only
- Shell commands — within this folder only
- Web search and web fetch — allowed
`;

function ensureRulesMd(cliName: string, cwd: string): void {
  const tool = CLI_TOOLS[cliName];
  const filename = tool.rulesFile;
  const mdPath = path.join(cwd, filename);

  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, "utf-8");
    if (content.includes(RULES_MARKER)) {
      console.log(`  [${filename}] Rules already present`);
      return;
    }
    fs.appendFileSync(mdPath, "\n\n" + RULES_TEMPLATE, "utf-8");
    console.log(`  [${filename}] Appended rules to ${mdPath}`);
  } else {
    fs.writeFileSync(mdPath, RULES_TEMPLATE, "utf-8");
    console.log(`  [${filename}] Created ${mdPath}`);
  }
}

// ── Load commands (static — compatible with .exe bundling) ──────────

const allCommands: PrefixCommand[] = [
  askCommand,
  sessionCommand,
  execCommand,
  statusCommand,
  helpCommand,
  myidCommand,
  taskCommand,
  diffCommand,
];

function loadCommands(client: BotClient): void {
  for (const cmd of allCommands) {
    if (!cmd?.name) continue;
    client.commands.set(cmd.name, cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        client.aliases.set(alias, cmd.name);
      }
    }
    console.log(`  [cmd] Loaded: ${cmd.name}`);
  }
}

// ── Prerequisites check ─────────────────────────────────────────────

function checkClaudePrerequisites(): void {
  // 1) cli.js 존재 확인
  const exeDir = path.dirname(process.execPath);
  const cliInExeDir = path.join(exeDir, "cli.js");
  const cliInNodeModules = path.join(
    process.cwd(),
    "node_modules",
    "@anthropic-ai",
    "claude-agent-sdk",
    "cli.js",
  );
  const hasCli = fs.existsSync(cliInExeDir) || fs.existsSync(cliInNodeModules);

  if (!hasCli) {
    throw new Error(
      "cli.js 파일을 찾을 수 없습니다. exe와 같은 폴더에 cli.js를 배치하세요. " +
      "Release에서 cli.js를 함께 다운로드하거나 build.bat으로 다시 빌드하세요.",
    );
  }

  // Node.js 런타임은 sendMessage 시점에 resolveNodeExecutable()로 자동 탐색/다운로드
}

// ── Create session manager ───────────────────────────────────────────

export function createSession(cliName: string, cwd: string): ISessionManager {
  const tool = CLI_TOOLS[cliName];

  // Claude: Agent SDK
  if (tool.useAgentSdk) {
    checkClaudePrerequisites();
    return new ClaudeSessionManager(tool, cwd);
  }

  // Gemini: Stream JSON with session resume
  if (tool.useStreamJson) {
    return new GeminiSessionManager(tool, cwd);
  }

  // Others (OpenCode, etc.): Basic subprocess
  return new SubprocessSessionManager(cliName, tool, cwd);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await setupEnv();

  if (!DISCORD_BOT_TOKEN) {
    console.error("DISCORD_BOT_TOKEN is not set. Check your .env file.");
    process.exit(1);
  }

  if (ALLOWED_USER_IDS.size === 0) {
    console.warn();
    console.warn("  [WARNING] ALLOWED_USER_IDS is empty!");
    console.warn("  All commands will be denied until user IDs are configured in .env.");
    console.warn();
  }

  const { cliName, workingDir } = await startupSetup();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  }) as BotClient;

  client.commands = new Collection();
  client.aliases = new Collection();
  client.selectedCli = cliName;
  client.workingDir = workingDir;

  // Create multi-session manager
  const multiSession = new MultiSessionManager(workingDir);
  setMultiSessionManager(multiSession);

  // Load commands
  loadCommands(client);

  // ── Events ──

  client.on(Events.ClientReady, () => {
    const tool = CLI_TOOLS[cliName];
    const folder = path.basename(workingDir);
    console.log(`  Logged in as ${client.user?.tag}`);
    console.log(`  Active CLI: ${tool.name}  |  CWD: ${workingDir}`);
    client.user?.setActivity(`${tool.name} @ ${folder}`, {
      type: ActivityType.Listening,
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(COMMAND_PREFIX)) return;

    const args = message.content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    if (!cmdName) return;

    const cmd =
      client.commands.get(cmdName) ??
      client.commands.get(client.aliases.get(cmdName) ?? "");
    if (!cmd) return;

    const ctx: CommandContext = { message, args, client };

    try {
      await cmd.execute(ctx);
    } catch (err: any) {
      console.error(`[error] Command ${cmdName}:`, err);
      const safeMsg = sanitizeOutput(String(err.message ?? err));
      await message.reply(`An error occurred: \`${safeMsg}\``).catch(() => {});
    }
  });

  // Graceful shutdown - cleanup all sessions
  const shutdown = async () => {
    console.log("\n  Shutting down...");
    const multiSessionMgr = getMultiSessionManager();
    if (multiSessionMgr) {
      await multiSessionMgr.cleanup();
    }
    await closeBrowser(); // Close puppeteer browser
    client.destroy();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(DISCORD_BOT_TOKEN);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
