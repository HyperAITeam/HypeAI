import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "../types.js";
import { CLI_TOOLS, COMMAND_PREFIX } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import type { SlashCommand } from "./index.js";

const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available commands");

async function execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({ content: "You are not authorized.", ephemeral: true });
    return;
  }

  const p = COMMAND_PREFIX;
  const tool = CLI_TOOLS[client.selectedCli];

  const embed = new EmbedBuilder()
    .setTitle("AI CLI Gateway Bot")
    .setDescription(`Currently using **${tool.name}**.`)
    .setColor(0x5865F2)
    .addFields(
      {
        name: "Slash Commands",
        value: [
          "`/ask <message> [session]` — Send message to AI",
          "`/session create|list|switch|info|...` — Manage sessions",
          "`/exec <command>` — Execute CMD command",
          "`/task add|list|run|remove|clear|stop` — Task queue",
          "`/status` — Show system info",
          "`/help` — Show this message",
        ].join("\n"),
        inline: false,
      },
      {
        name: "Prefix Commands",
        value: [
          `\`${p}ask [session] <message>\` — Send message (alias: \`${p}a\`)`,
          `\`${p}session <sub>\` — Session management (alias: \`${p}s\`)`,
          `\`${p}exec <cmd>\` — Run CMD (aliases: \`${p}run\`, \`${p}cmd\`)`,
          `\`${p}task <sub>\` — Task queue (alias: \`${p}t\`)`,
          `\`${p}status\` — System info`,
          `\`${p}help\` — Help`,
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "Only authorized users can use this bot." });

  await interaction.reply({ embeds: [embed] });
}

export default { data, execute } as SlashCommand;
