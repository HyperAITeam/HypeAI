import { EmbedBuilder } from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import { COMMAND_PREFIX, CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";

const helpCommand: PrefixCommand = {
  name: "help",
  aliases: [],
  description: "Show all available commands.",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const p = COMMAND_PREFIX;
    const tool = CLI_TOOLS[ctx.client.selectedCli];

    const embed = new EmbedBuilder()
      .setTitle("AI CLI Gateway Bot")
      .setDescription(`Currently using **${tool.name}**.`)
      .setColor(0x5865F2)
      .addFields(
        {
          name: "AI CLI",
          value: [
            `\`${p}ask [session] <message>\` — Send message (alias: \`${p}a\`)`,
            `\`${p}session create <name> [cli]\` — Create a new session (alias: \`${p}s c\`)`,
            `\`${p}session list\` — List all sessions (alias: \`${p}s ls\`)`,
            `\`${p}session switch <name>\` — Switch active session (alias: \`${p}s sw\`)`,
            `\`${p}session info [name]\` — Show session info (alias: \`${p}s\`)`,
            `\`${p}session new [name]\` — Reset session conversation`,
            `\`${p}session kill [name]\` — Kill session process (alias: \`${p}s stop\`)`,
            `\`${p}session delete <name>\` — Delete session (alias: \`${p}s rm\`)`,
            `\`${p}session stats [name]\` — Show token usage stats (alias: \`${p}s stat\`)`,
            `\`${p}session history [name] [count]\` — Show conversation history (alias: \`${p}s h\`)`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "CMD Execution",
          value: `\`${p}exec <command>\` — Run a CMD command (aliases: \`${p}run\`, \`${p}cmd\`)`,
          inline: false,
        },
        {
          name: "System",
          value: [
            `\`${p}status\` — Show system info (alias: \`${p}sysinfo\`)`,
            `\`${p}myid\` — Show your Discord user ID (alias: \`${p}id\`)`,
            `\`${p}help\` — Show this message`,
          ].join("\n"),
          inline: false,
        },
      )
      .setFooter({ text: "Only authorized users can use this bot." });

    await ctx.message.reply({ embeds: [embed] });
  },
};

export default helpCommand;
