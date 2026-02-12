import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import path from "node:path";
import type { BotClient } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";
import { checkPromptInjection } from "../utils/promptGuard.js";
import { audit, AuditEvent } from "../utils/auditLog.js";
import type { SlashCommand } from "./index.js";
import type { PlatformMessage } from "../platform/types.js";
import { getDiscordAdapter } from "../platform/discordAdapter.js";

const data = new SlashCommandBuilder()
  .setName("ask")
  .setDescription("Send a message to the AI CLI")
  .addStringOption((opt) =>
    opt.setName("message").setDescription("The message to send").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("session").setDescription("Target session name").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({ content: "You are not authorized to use this bot.", ephemeral: true });
    return;
  }

  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await interaction.reply({ content: "Session manager not initialized.", ephemeral: true });
    return;
  }

  const msg = interaction.options.getString("message", true);
  const sessionName = interaction.options.getString("session");

  // Prompt injection warning
  const injectionCheck = checkPromptInjection(msg);
  if (injectionCheck.detected) {
    audit(AuditEvent.INJECTION_WARNING, interaction.user.id, {
      command: "ask",
      details: { warnings: injectionCheck.warnings },
    });
  }

  const targetSessionName = sessionName ?? multiSession.getActiveSessionName();
  let namedSession = multiSession.getSession(targetSessionName);

  if (!namedSession && targetSessionName === "default") {
    try {
      namedSession = multiSession.createSession("default", client.selectedCli);
    } catch (err: any) {
      await interaction.reply({ content: `Failed to create default session: ${err.message}`, ephemeral: true });
      return;
    }
  }

  if (!namedSession) {
    await interaction.reply({ content: `Session '${targetSessionName}' not found.`, ephemeral: true });
    return;
  }

  if (namedSession.manager.isBusy) {
    await interaction.reply({ content: `Session '${targetSessionName}' is already processing.`, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const platformMsg: PlatformMessage = {
      platform: "discord",
      userId: interaction.user.id,
      displayName: interaction.user.displayName ?? interaction.user.username,
      channelId: interaction.channelId,
      content: msg,
      raw: interaction,
    };
    const adapter = getDiscordAdapter();
    const result = await multiSession.sendMessage(sessionName, msg, platformMsg, adapter);

    const tool = CLI_TOOLS[namedSession.cliName];
    const folder = path.basename(client.workingDir);
    const prefix = `**${tool.name}** @ \`${folder}\` [${namedSession.name}]`;

    const content = `${prefix}\n\`\`\`\n${result.slice(0, 1900)}\n\`\`\``;
    await interaction.editReply(content);
  } catch (err: any) {
    await interaction.editReply(`Error: ${err.message}`);
  }
}

export default { data, execute } as SlashCommand;
