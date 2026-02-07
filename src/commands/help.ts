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
            `\`${p}ask <message>\` — Send message to ${tool.name} (alias: \`${p}a\`)`,
            `\`${p}session info\` — Show session status (alias: \`${p}s\`)`,
            `\`${p}session new\` — Start a fresh conversation`,
            `\`${p}session kill\` — Kill running CLI process (alias: \`${p}s stop\`)`,
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
