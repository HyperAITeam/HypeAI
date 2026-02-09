import path from "node:path";
import { EmbedBuilder, ActivityType } from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import type { ISessionManager } from "../sessions/types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { getSession, setSession } from "./ask.js";
import { createSession } from "../bot.js";

// Session cache to preserve sessions when switching between CLIs
const sessionCache = new Map<string, ISessionManager>();

/** Initialize cache with the first session (called from bot.ts) */
export function initSessionCache(cliName: string, session: ISessionManager): void {
  sessionCache.set(cliName, session);
}

/** Get all cached sessions for cleanup */
export function getAllCachedSessions(): ISessionManager[] {
  return Array.from(sessionCache.values());
}

const sessionCommand: PrefixCommand = {
  name: "session",
  aliases: ["s"],
  description: "Session management (info / new / kill / switch).",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const sub = ctx.args[0]?.toLowerCase() ?? "info";

    switch (sub) {
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

async function handleNew(ctx: CommandContext): Promise<void> {
  const session = getSession();
  if (!session) return;

  await session.newSession();
  const tool = CLI_TOOLS[ctx.client.selectedCli];
  await ctx.message.reply(
    `Session reset. Next \`!ask\` starts a new **${tool.name}** conversation.`,
  );
}

async function handleKill(ctx: CommandContext): Promise<void> {
  const session = getSession();
  if (!session) return;

  const killed = await session.kill();
  const tool = CLI_TOOLS[ctx.client.selectedCli];
  if (killed) {
    await ctx.message.reply(`**${tool.name}** process killed.`);
  } else {
    await ctx.message.reply("No CLI process is currently running.");
  }
}

async function handleSwitch(ctx: CommandContext): Promise<void> {
  const targetCli = ctx.args[1]?.toLowerCase();
  const availableClis = Object.keys(CLI_TOOLS);

  // Show available CLIs if no argument
  if (!targetCli) {
    const currentTool = CLI_TOOLS[ctx.client.selectedCli];
    const cliList = availableClis
      .map((cli) => {
        const tool = CLI_TOOLS[cli];
        const isCurrent = cli === ctx.client.selectedCli;
        return `\`${cli}\` — ${tool.name}${isCurrent ? " ✅" : ""}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Switch CLI Tool")
      .setDescription(`Current: **${currentTool.name}**\n\nAvailable CLIs:\n${cliList}`)
      .setColor(0x5865F2)
      .setFooter({ text: "Usage: !session switch <cli>" });

    await ctx.message.reply({ embeds: [embed] });
    return;
  }

  // Validate target CLI
  if (!availableClis.includes(targetCli)) {
    await ctx.message.reply(
      `Unknown CLI: \`${targetCli}\`\nAvailable: ${availableClis.map((c) => `\`${c}\``).join(", ")}`,
    );
    return;
  }

  // Check if already using this CLI
  if (targetCli === ctx.client.selectedCli) {
    const tool = CLI_TOOLS[targetCli];
    await ctx.message.reply(`Already using **${tool.name}**.`);
    return;
  }

  const oldCli = ctx.client.selectedCli;
  const oldTool = CLI_TOOLS[oldCli];
  const newTool = CLI_TOOLS[targetCli];

  // Save current session to cache (preserve session state)
  const currentSession = getSession();
  if (currentSession) {
    // Kill any running process but preserve session ID
    await currentSession.kill();
    sessionCache.set(oldCli, currentSession);
  }

  // Try to restore from cache, or create new session
  let newSession = sessionCache.get(targetCli);
  let isRestoredSession = false;

  if (newSession) {
    isRestoredSession = true;
  } else {
    newSession = createSession(targetCli, ctx.client.workingDir);
    sessionCache.set(targetCli, newSession);
  }

  setSession(newSession);

  // Update client state
  ctx.client.selectedCli = targetCli;

  // Update bot activity
  const folder = path.basename(ctx.client.workingDir);
  ctx.client.user?.setActivity(`${newTool.name} @ ${folder}`, {
    type: ActivityType.Listening,
  });

  console.log(`  [switch] ${oldTool.name} -> ${newTool.name} (restored: ${isRestoredSession})`);

  // Build response embed
  const newSessionInfo = newSession.getInfo();
  const embed = new EmbedBuilder()
    .setTitle("CLI Switched")
    .setDescription(`**${oldTool.name}** → **${newTool.name}**`)
    .setColor(0x57F287)
    .addFields(
      { name: "Working Directory", value: `\`${ctx.client.workingDir}\``, inline: false },
    );

  if (isRestoredSession && newSessionInfo.sessionId) {
    embed.addFields(
      { name: "Session", value: "Restored previous session ✅", inline: true },
      { name: "Messages", value: String(newSessionInfo.messageCount), inline: true },
    );
    embed.setFooter({ text: "Previous conversation context preserved." });
  } else {
    embed.setFooter({ text: "New session started." });
  }

  await ctx.message.reply({ embeds: [embed] });
}

async function handleInfo(ctx: CommandContext): Promise<void> {
  const session = getSession();
  if (!session) return;

  const info = session.getInfo();
  const elapsed = info.startedAt ? Math.floor((Date.now() - info.startedAt) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  let status: string;
  if (info.isBusy) status = "Processing...";
  else if (info.sessionId) status = "Active";
  else status = "New";

  const embed = new EmbedBuilder()
    .setTitle("Session Info")
    .setColor(0x5865F2)
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
      value: `\`${info.sessionId.slice(0, 16)}…\``,
      inline: false,
    });
  }

  await ctx.message.reply({ embeds: [embed] });
}

export default sessionCommand;
