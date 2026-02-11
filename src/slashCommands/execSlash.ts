import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "../types.js";
import { COMMAND_TIMEOUT } from "../config.js";
import { isAllowedUser, isCommandBlocked } from "../utils/security.js";
import { runCommand } from "../utils/subprocess.js";
import { formatOutput } from "../utils/formatter.js";
import { audit, AuditEvent } from "../utils/auditLog.js";
import type { SlashCommand } from "./index.js";

const data = new SlashCommandBuilder()
  .setName("exec")
  .setDescription("Execute a CMD command")
  .addStringOption((opt) =>
    opt.setName("command").setDescription("The command to execute").setRequired(true),
  );

async function execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({ content: "You are not authorized.", ephemeral: true });
    return;
  }

  const command = interaction.options.getString("command", true);

  if (isCommandBlocked(command)) {
    audit(AuditEvent.COMMAND_BLOCKED, interaction.user.id, {
      command: `exec ${command}`,
      success: false,
    });
    await interaction.reply({ content: "This command is blocked for safety reasons.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const { code, stdout, stderr } = await runCommand(command, { timeout: COMMAND_TIMEOUT * 1000 });
  const result = formatOutput(stdout, stderr, code);
  const content = `**CMD**\n\`\`\`\n${result.slice(0, 1900)}\n\`\`\``;
  await interaction.editReply(content);
}

export default { data, execute } as SlashCommand;
