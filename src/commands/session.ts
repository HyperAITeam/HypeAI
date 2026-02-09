import path from "node:path";
import { EmbedBuilder, ActivityType } from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";

const sessionCommand: PrefixCommand = {
  name: "session",
  aliases: ["s"],
  description: "Session management (info / create / list / delete / new / kill / switch).",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const sub = ctx.args[0]?.toLowerCase() ?? "info";

    switch (sub) {
      case "create":
      case "c":
        return handleCreate(ctx);
      case "list":
      case "ls":
        return handleList(ctx);
      case "delete":
      case "del":
      case "rm":
        return handleDelete(ctx);
      case "new":
        return handleNew(ctx);
      case "kill":
      case "stop":
        return handleKill(ctx);
      case "switch":
      case "sw":
        return handleSwitch(ctx);
      case "info":
      default:
        return handleInfo(ctx);
    }
  },
};

/**
 * !session create <name> [cli]
 * 새 세션 생성
 */
async function handleCreate(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  const name = ctx.args[1];
  const cliName = ctx.args[2]?.toLowerCase() ?? ctx.client.selectedCli;

  if (!name) {
    await ctx.message.reply("Usage: `!session create <name> [cli]`\nExample: `!session create work opencode`");
    return;
  }

  try {
    const session = multiSession.createSession(name, cliName);
    const tool = CLI_TOOLS[cliName];

    const embed = new EmbedBuilder()
      .setTitle("Session Created")
      .setColor(0x57F287)
      .addFields(
        { name: "Name", value: `\`${session.name}\``, inline: true },
        { name: "CLI", value: tool.name, inline: true },
      )
      .setFooter({ text: `Use: !a ${name} "message" or !session switch ${name}` });

    await ctx.message.reply({ embeds: [embed] });
  } catch (err: any) {
    await ctx.message.reply(`Failed to create session: ${err.message}`);
  }
}

/**
 * !session list
 * 모든 세션 목록 표시
 */
async function handleList(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  const sessions = multiSession.listSessions();
  const activeSessionName = multiSession.getActiveSessionName();

  if (sessions.length === 0) {
    await ctx.message.reply("No sessions. Use `!session create <name> [cli]` to create one.");
    return;
  }

  const sessionList = sessions
    .map((s) => {
      const tool = CLI_TOOLS[s.cliName];
      const info = s.manager.getInfo();
      const isActive = s.name === activeSessionName;
      const status = info.isBusy ? "Processing" : info.sessionId ? "Active" : "New";
      return `${isActive ? "**" : ""}\`${s.name}\`${isActive ? " (active)**" : ""} — ${tool.name} | ${status} | ${info.messageCount} msgs`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Sessions")
    .setDescription(sessionList)
    .setColor(0x5865F2)
    .setFooter({ text: `${sessions.length} session(s) | Active: ${activeSessionName}` });

  await ctx.message.reply({ embeds: [embed] });
}

/**
 * !session delete <name>
 * 세션 삭제
 */
async function handleDelete(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  const name = ctx.args[1];
  if (!name) {
    await ctx.message.reply("Usage: `!session delete <name>`");
    return;
  }

  const session = multiSession.getSession(name);
  if (!session) {
    await ctx.message.reply(`Session '${name}' not found.`);
    return;
  }

  const deleted = await multiSession.deleteSession(name);
  if (deleted) {
    await ctx.message.reply(`Session '${name}' deleted.`);
  } else {
    await ctx.message.reply(`Failed to delete session '${name}'.`);
  }
}

/**
 * !session new [name]
 * 세션 초기화 (대화 리셋)
 */
async function handleNew(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.message.reply(`Session '${name}' not found.`);
    return;
  }

  await session.manager.newSession();
  const tool = CLI_TOOLS[session.cliName];
  await ctx.message.reply(
    `Session '${name}' reset. Next message starts a new **${tool.name}** conversation.`,
  );
}

/**
 * !session kill [name]
 * 세션 프로세스 종료
 */
async function handleKill(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.message.reply(`Session '${name}' not found.`);
    return;
  }

  const killed = await session.manager.kill();
  const tool = CLI_TOOLS[session.cliName];

  if (killed) {
    await ctx.message.reply(`**${tool.name}** process in session '${name}' killed.`);
  } else {
    await ctx.message.reply(`No CLI process is running in session '${name}'.`);
  }
}

/**
 * !session switch <name>
 * 활성 세션 변경
 */
async function handleSwitch(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  const targetName = ctx.args[1];

  // 인자 없으면 세션 목록 표시
  if (!targetName) {
    return handleList(ctx);
  }

  const session = multiSession.getSession(targetName);
  if (!session) {
    await ctx.message.reply(
      `Session '${targetName}' not found. Create with: \`!session create ${targetName} <cli>\``,
    );
    return;
  }

  const currentActive = multiSession.getActiveSessionName();
  if (targetName === currentActive) {
    await ctx.message.reply(`Already using session '${targetName}'.`);
    return;
  }

  multiSession.setActiveSession(targetName);

  // Update bot activity
  const tool = CLI_TOOLS[session.cliName];
  const folder = path.basename(ctx.client.workingDir);
  ctx.client.user?.setActivity(`${tool.name} @ ${folder} [${targetName}]`, {
    type: ActivityType.Listening,
  });

  // Update client selectedCli
  ctx.client.selectedCli = session.cliName;

  const info = session.manager.getInfo();
  const embed = new EmbedBuilder()
    .setTitle("Session Switched")
    .setDescription(`Active session: **${targetName}**`)
    .setColor(0x57F287)
    .addFields(
      { name: "CLI", value: tool.name, inline: true },
      { name: "Messages", value: String(info.messageCount), inline: true },
    );

  if (info.sessionId) {
    embed.setFooter({ text: "Previous conversation context preserved." });
  }

  await ctx.message.reply({ embeds: [embed] });
}

/**
 * !session info [name]
 * 세션 정보 표시
 */
async function handleInfo(ctx: CommandContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("Session manager not initialized.");
    return;
  }

  // 인자로 세션 이름이 있으면 해당 세션, 없으면 활성 세션
  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    // 세션이 없으면 목록 표시
    if (!ctx.args[1]) {
      return handleList(ctx);
    }
    await ctx.message.reply(`Session '${name}' not found.`);
    return;
  }

  const info = session.manager.getInfo();
  const elapsed = info.startedAt ? Math.floor((Date.now() - info.startedAt) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  let status: string;
  if (info.isBusy) status = "Processing...";
  else if (info.sessionId) status = "Active";
  else status = "New";

  const isActive = name === multiSession.getActiveSessionName();

  const embed = new EmbedBuilder()
    .setTitle(`Session: ${name}${isActive ? " (active)" : ""}`)
    .setColor(isActive ? 0x57F287 : 0x5865F2)
    .addFields(
      { name: "CLI Tool", value: info.toolName, inline: true },
      { name: "Status", value: status, inline: true },
      { name: "Messages", value: String(info.messageCount), inline: true },
      {
        name: "Duration",
        value: info.startedAt ? `${mins}m ${secs}s` : "—",
        inline: true,
      },
      { name: "Working Directory", value: `\`${info.cwd}\``, inline: false },
    );

  if (info.sessionId) {
    embed.addFields({
      name: "Session ID",
      value: `\`${info.sessionId.slice(0, 16)}...\``,
      inline: false,
    });
  }

  await ctx.message.reply({ embeds: [embed] });
}

export default sessionCommand;
