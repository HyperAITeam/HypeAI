import { EmbedBuilder } from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { getSession } from "./ask.js";

const sessionCommand: PrefixCommand = {
  name: "session",
  aliases: ["s"],
  description: "Session management (info / new / kill).",

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
