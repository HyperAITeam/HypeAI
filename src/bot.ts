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
import {
  DISCORD_BOT_TOKEN, COMMAND_PREFIX, CLI_TOOLS, ALLOWED_USER_IDS, reloadConfig,
  AUDIT_LOG_DIR, AUDIT_LOG_ENABLED,
  RATE_LIMIT_MAX, RATE_LIMIT_WINDOW,
  APPLICATION_ID, SLASH_COMMAND_GUILD_ID,
  LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET,
} from "./config.js";
import { startSetupServer, envExists } from "./setup/setupServer.js";
import { LineBotServer } from "./lineBot.js";
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
import { closeBrowser, initializePuppeteer } from "./utils/diffRenderer.js";
import { initAuditLogger, getAuditLogger, audit, AuditEvent } from "./utils/auditLog.js";
import { initRateLimiter, getRateLimiter } from "./utils/rateLimiter.js";
import { isAllowedUser } from "./utils/security.js";
import { registerSlashCommands, buildSlashCollection, type SlashCommand } from "./slashCommands/index.js";

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

// Validation helpers
function isValidDiscordId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

function isValidLineUserId(id: string): boolean {
  return /^U[a-f0-9]{32}$/i.test(id);
}

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

  // 1) Platform selection
  console.log("  [1] 사용할 플랫폼을 선택하세요:");
  console.log();
  console.log("      1) Discord만");
  console.log("      2) LINE만");
  console.log("      3) Discord + LINE 둘 다");
  console.log();

  let platformChoice: number;
  while (true) {
    const raw = await ask("  선택 [1-3] (기본: 1): ");
    if (raw === "") {
      platformChoice = 1;
      break;
    }
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 3) {
      platformChoice = n;
      break;
    }
    console.log("  잘못된 선택입니다. 1, 2, 3 중 하나를 입력해주세요.");
  }

  const useDiscord = platformChoice === 1 || platformChoice === 3;
  const useLine = platformChoice === 2 || platformChoice === 3;

  const platformNames = [];
  if (useDiscord) platformNames.push("Discord");
  if (useLine) platformNames.push("LINE");
  console.log(`  -> ${platformNames.join(" + ")} 선택됨`);
  console.log();

  // Build env content
  const envLines: string[] = [];

  // Discord settings
  if (useDiscord) {
    console.log("  ─── Discord 설정 ───");
    console.log();

    // Discord bot token
    let discordToken: string;
    while (true) {
      discordToken = await ask("  Discord 봇 토큰: ");
      if (discordToken) break;
      console.log("  봇 토큰은 필수입니다. 다시 입력해주세요.");
    }

    // Discord user ID
    let discordUserId: string;
    while (true) {
      discordUserId = await ask("  Discord 유저 ID (17-19자리 숫자): ");
      if (isValidDiscordId(discordUserId)) break;
      console.log("  유효하지 않은 ID입니다. 17-19자리 숫자를 입력해주세요.");
    }

    envLines.push("# Discord 설정");
    envLines.push(`DISCORD_BOT_TOKEN=${discordToken}`);
    envLines.push(`ALLOWED_USER_IDS=${discordUserId}`);
    envLines.push("");
    console.log();
  }

  // LINE settings
  if (useLine) {
    console.log("  ─── LINE 설정 ───");
    console.log();
    console.log("  LINE Developers Console에서 토큰과 시크릿을 복사하세요.");
    console.log("  https://developers.line.biz/console/");
    console.log();

    // LINE Channel Access Token
    let lineToken: string;
    while (true) {
      lineToken = await ask("  LINE Channel Access Token: ");
      if (lineToken) break;
      console.log("  Access Token은 필수입니다. 다시 입력해주세요.");
    }

    // LINE Channel Secret
    let lineSecret: string;
    while (true) {
      lineSecret = await ask("  LINE Channel Secret: ");
      if (lineSecret) break;
      console.log("  Channel Secret은 필수입니다. 다시 입력해주세요.");
    }

    // LINE User ID
    let lineUserId: string;
    while (true) {
      lineUserId = await ask("  LINE 유저 ID (U로 시작하는 33자): ");
      if (isValidLineUserId(lineUserId)) break;
      console.log("  유효하지 않은 LINE ID입니다. U로 시작하는 33자 문자열을 입력해주세요.");
    }

    // LINE Webhook Port
    const portRaw = await ask("  LINE 웹훅 포트 (기본: 3000): ");
    const linePort = portRaw || "3000";

    envLines.push("# LINE 설정");
    envLines.push(`LINE_CHANNEL_ACCESS_TOKEN=${lineToken}`);
    envLines.push(`LINE_CHANNEL_SECRET=${lineSecret}`);
    envLines.push(`ALLOWED_LINE_USER_IDS=${lineUserId}`);
    envLines.push(`LINE_WEBHOOK_PORT=${linePort}`);
    envLines.push("");

    console.log();
    console.log("  ─── LINE 웹훅 안내 ───");
    console.log();
    console.log("  LINE 봇은 웹훅 URL이 필요합니다.");
    console.log("  로컬 테스트: Cloudflare Tunnel 사용 (무료)");
    console.log();
    console.log("    1. 설치: winget install cloudflare.cloudflared");
    console.log(`    2. 실행: cloudflared tunnel --url http://localhost:${linePort}`);
    console.log("    3. 표시된 URL + /webhook 을 LINE Developers에 등록");
    console.log();
  }

  // Common settings
  envLines.push("# 공통 설정");
  envLines.push("COMMAND_PREFIX=!");
  envLines.push("COMMAND_TIMEOUT=30");
  envLines.push("AI_CLI_TIMEOUT=300");

  const envContent = envLines.join("\n") + "\n";
  fs.writeFileSync(envPath, envContent, "utf-8");
  reloadConfig();

  console.log("=".repeat(48));
  console.log("  .env 파일이 생성되었습니다!");
  console.log("=".repeat(48));
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
  let cliName: string;
  let workingDir: string;

  // Check if .env exists - if not, open web setup page
  if (!envExists()) {
    console.log();
    console.log("  .env 파일이 없습니다. 웹 설정 페이지를 엽니다...");

    try {
      const setupResult = await startSetupServer(5000);
      reloadConfig();
      cliName = setupResult.cliName;
      workingDir = setupResult.workingDir || process.cwd();
    } catch (err: any) {
      // Fallback to terminal setup if web setup fails
      console.log();
      console.log("  웹 설정을 사용할 수 없습니다. 터미널 설정으로 전환합니다...");
      console.log();
      await setupEnv();
      const result = await startupSetup();
      cliName = result.cliName;
      workingDir = result.workingDir;
    }
  } else {
    // .env exists, use terminal setup for CLI/working dir selection
    const result = await startupSetup();
    cliName = result.cliName;
    workingDir = result.workingDir;
  }

  const hasDiscord = !!DISCORD_BOT_TOKEN;
  const hasLine = !!(LINE_CHANNEL_ACCESS_TOKEN && LINE_CHANNEL_SECRET);

  if (!hasDiscord && !hasLine) {
    console.error("No platform configured. Set DISCORD_BOT_TOKEN and/or LINE_CHANNEL_ACCESS_TOKEN + LINE_CHANNEL_SECRET in .env.");
    process.exit(1);
  }

  if (hasDiscord && ALLOWED_USER_IDS.size === 0) {
    console.warn();
    console.warn("  [WARNING] ALLOWED_USER_IDS is empty!");
    console.warn("  All Discord commands will be denied until user IDs are configured in .env.");
    console.warn();
  }

  // Ensure rules file exists
  workingDir = path.resolve(workingDir || process.cwd());
  ensureRulesMd(cliName, workingDir);

  console.log();
  console.log("=".repeat(48));
  console.log(`  ${CLI_TOOLS[cliName].name}  @  ${workingDir}`);
  console.log("=".repeat(48));
  console.log();

  // Initialize audit logger
  if (AUDIT_LOG_ENABLED) {
    initAuditLogger(path.resolve(workingDir, AUDIT_LOG_DIR));
    console.log(`  [audit] Logging to ${path.resolve(workingDir, AUDIT_LOG_DIR)}`);
  }

  // Initialize rate limiter
  initRateLimiter({
    maxTokens: RATE_LIMIT_MAX,
    refillRate: 1,
    refillIntervalMs: RATE_LIMIT_WINDOW * 1000,
  });
  console.log(`  [rate] Max ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW}s`);

  // Create multi-session manager
  const multiSession = new MultiSessionManager(workingDir);
  setMultiSessionManager(multiSession);

  // Restore persisted sessions
  const restored = multiSession.restoreFromDisk();
  if (restored > 0) {
    console.log(`  [persist] Restored ${restored} session(s) from disk`);
  }

  // ── Discord setup (conditional) ──
  let client: BotClient | null = null;
  let lineBot: LineBotServer | null = null;

  if (hasDiscord) {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    }) as BotClient;

    client.commands = new Collection();
    client.aliases = new Collection();
    client.slashCommands = buildSlashCollection();
    client.selectedCli = cliName;
    client.workingDir = workingDir;

    // Load commands
    loadCommands(client);

    // ── Discord Events ──

    client.on(Events.ClientReady, async () => {
      const tool = CLI_TOOLS[cliName];
      const folder = path.basename(workingDir);
      console.log(`  [Discord] Logged in as ${client!.user?.tag}`);
      console.log(`  [Discord] Active CLI: ${tool.name}  |  CWD: ${workingDir}`);
      client!.user?.setActivity(`${tool.name} @ ${folder}`, {
        type: ActivityType.Listening,
      });

      // Register slash commands if APPLICATION_ID is set
      if (APPLICATION_ID) {
        try {
          await registerSlashCommands(
            APPLICATION_ID,
            DISCORD_BOT_TOKEN,
            SLASH_COMMAND_GUILD_ID || undefined,
          );
        } catch (err: any) {
          console.error(`  [slash] Failed to register: ${err.message}`);
        }
      }
    });

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith(COMMAND_PREFIX)) return;

      const args = message.content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
      const cmdName = args.shift()?.toLowerCase();
      if (!cmdName) return;

      const cmd =
        client!.commands.get(cmdName) ??
        client!.commands.get(client!.aliases.get(cmdName) ?? "");
      if (!cmd) return;

      // Rate limiting
      const rateLimiter = getRateLimiter();
      if (rateLimiter) {
        const { allowed, retryAfterMs } = rateLimiter.tryConsume(message.author.id);
        if (!allowed) {
          const secs = Math.ceil(retryAfterMs / 1000);
          audit(AuditEvent.RATE_LIMITED, message.author.id, {
            command: cmdName,
            success: false,
          });
          await message.reply(`Rate limited. Try again in ${secs}s.`).catch(() => {});
          return;
        }
      }

      // Audit: command executed
      audit(AuditEvent.COMMAND_EXECUTED, message.author.id, { command: cmdName });

      const ctx: CommandContext = { message, args, client: client! };

      try {
        await cmd.execute(ctx);
      } catch (err: any) {
        console.error(`[error] Command ${cmdName}:`, err);
        audit(AuditEvent.COMMAND_ERROR, message.author.id, {
          command: cmdName,
          success: false,
          details: { error: String(err.message ?? err) },
        });
        const safeMsg = sanitizeOutput(String(err.message ?? err));
        await message.reply(`An error occurred: \`${safeMsg}\``).catch(() => {});
      }
    });

    // ── Slash command handler ──
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const slashCmd = client!.slashCommands.get(interaction.commandName) as SlashCommand | undefined;
      if (!slashCmd) return;

      // Rate limiting for slash commands
      const rateLimiter = getRateLimiter();
      if (rateLimiter) {
        const { allowed, retryAfterMs } = rateLimiter.tryConsume(interaction.user.id);
        if (!allowed) {
          const secs = Math.ceil(retryAfterMs / 1000);
          audit(AuditEvent.RATE_LIMITED, interaction.user.id, {
            command: interaction.commandName,
            success: false,
          });
          await interaction.reply({
            content: `Rate limited. Try again in ${secs}s.`,
            ephemeral: true,
          }).catch(() => {});
          return;
        }
      }

      audit(AuditEvent.COMMAND_EXECUTED, interaction.user.id, {
        command: `/${interaction.commandName}`,
      });

      try {
        await slashCmd.execute(interaction, client!);
      } catch (err: any) {
        console.error(`[error] Slash /${interaction.commandName}:`, err);
        audit(AuditEvent.COMMAND_ERROR, interaction.user.id, {
          command: `/${interaction.commandName}`,
          success: false,
          details: { error: String(err.message ?? err) },
        });
        const content = `An error occurred: \`${String(err.message ?? err).slice(0, 100)}\``;
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(content).catch(() => {});
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => {});
        }
      }
    });
  }

  // Graceful shutdown - cleanup all sessions
  const shutdown = async () => {
    console.log("\n  Shutting down...");
    if (lineBot) lineBot.stop();
    const multiSessionMgr = getMultiSessionManager();
    if (multiSessionMgr) {
      multiSessionMgr.persistToDisk();
      await multiSessionMgr.cleanup();
    }
    const logger = getAuditLogger();
    if (logger) await logger.shutdown();
    await closeBrowser(); // Close puppeteer browser
    if (client) client.destroy();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Pre-initialize Puppeteer (Chromium download) — non-blocking
  if (hasDiscord) {
    try {
      await initializePuppeteer();
      console.log("  [puppeteer] Chromium ready");
    } catch (err: any) {
      console.warn(`  [puppeteer] Chromium init failed: ${err.message}`);
      console.warn("  [puppeteer] !diff will fall back to text mode");
    }
  }

  // ── Start platforms ──

  // Start LINE webhook server if configured
  if (hasLine) {
    lineBot = new LineBotServer(cliName, workingDir);
    await lineBot.start();
  }

  // Start Discord if configured
  if (hasDiscord && client) {
    await client.login(DISCORD_BOT_TOKEN);
  }

  // Log platform status
  const platforms: string[] = [];
  if (hasDiscord) platforms.push("Discord");
  if (hasLine) platforms.push("LINE");
  console.log(`  [platform] Active: ${platforms.join(" + ")}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
