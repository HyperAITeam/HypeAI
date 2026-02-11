import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotClient } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";
import { audit, AuditEvent } from "../utils/auditLog.js";
import type { SlashCommand } from "./index.js";

const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("Session management")
  .addSubcommand((sub) =>
    sub
      .setName("info")
      .setDescription("Show session info")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new session")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name").setRequired(true))
      .addStringOption((opt) =>
        opt.setName("cli").setDescription("CLI tool").addChoices(
          { name: "Claude Code", value: "claude" },
          { name: "Gemini CLI", value: "gemini" },
          { name: "OpenCode", value: "opencode" },
        ),
      ),
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all sessions"))
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a session")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("switch")
      .setDescription("Switch active session")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("new")
      .setDescription("Reset session conversation")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("kill")
      .setDescription("Kill session process")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("stats")
      .setDescription("Show token usage statistics")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("history")
      .setDescription("Show conversation history")
      .addStringOption((opt) => opt.setName("name").setDescription("Session name"))
      .addIntegerOption((opt) => opt.setName("count").setDescription("Number of entries").setMinValue(1).setMaxValue(50)),
  );

async function execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({ content: "You are not authorized.", ephemeral: true });
    return;
  }

  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await interaction.reply({ content: "Session manager not initialized.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "create": {
      const name = interaction.options.getString("name", true);
      const cliName = interaction.options.getString("cli") ?? client.selectedCli;
      try {
        const session = multiSession.createSession(name, cliName);
        const tool = CLI_TOOLS[cliName];
        audit(AuditEvent.SESSION_CREATED, interaction.user.id, {
          sessionName: name,
          details: { cli: cliName },
        });
        const embed = new EmbedBuilder()
          .setTitle("Session Created")
          .setColor(0x57F287)
          .addFields(
            { name: "Name", value: `\`${session.name}\``, inline: true },
            { name: "CLI", value: tool.name, inline: true },
          );
        await interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.reply({ content: `Failed: ${err.message}`, ephemeral: true });
      }
      break;
    }

    case "list": {
      const sessions = multiSession.listSessions();
      const activeName = multiSession.getActiveSessionName();
      if (sessions.length === 0) {
        await interaction.reply("No sessions.");
        return;
      }
      const list = sessions
        .map((s) => {
          const tool = CLI_TOOLS[s.cliName];
          const info = s.manager.getInfo();
          const isActive = s.name === activeName;
          const status = info.isBusy ? "Processing" : info.sessionId ? "Active" : "New";
          return `${isActive ? "**" : ""}\`${s.name}\`${isActive ? " (active)**" : ""} — ${tool.name} | ${status} | ${info.messageCount} msgs`;
        })
        .join("\n");
      const embed = new EmbedBuilder()
        .setTitle("Sessions")
        .setDescription(list)
        .setColor(0x5865F2)
        .setFooter({ text: `${sessions.length} session(s) | Active: ${activeName}` });
      await interaction.reply({ embeds: [embed] });
      break;
    }

    case "delete": {
      const name = interaction.options.getString("name", true);
      const deleted = await multiSession.deleteSession(name);
      if (deleted) {
        audit(AuditEvent.SESSION_DELETED, interaction.user.id, { sessionName: name });
        await interaction.reply(`Session '${name}' deleted.`);
      } else {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
      }
      break;
    }

    case "switch": {
      const name = interaction.options.getString("name", true);
      const session = multiSession.getSession(name);
      if (!session) {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
        return;
      }
      multiSession.setActiveSession(name);
      audit(AuditEvent.SESSION_SWITCHED, interaction.user.id, { sessionName: name });
      client.selectedCli = session.cliName;
      const tool = CLI_TOOLS[session.cliName];
      await interaction.reply(`Switched to session **${name}** (${tool.name}).`);
      break;
    }

    case "new": {
      const name = interaction.options.getString("name") ?? multiSession.getActiveSessionName();
      const session = multiSession.getSession(name);
      if (!session) {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
        return;
      }
      await session.manager.newSession();
      audit(AuditEvent.SESSION_RESET, interaction.user.id, { sessionName: name });
      await interaction.reply(`Session '${name}' reset.`);
      break;
    }

    case "kill": {
      const name = interaction.options.getString("name") ?? multiSession.getActiveSessionName();
      const session = multiSession.getSession(name);
      if (!session) {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
        return;
      }
      const killed = await session.manager.kill();
      await interaction.reply(killed ? `Session '${name}' process killed.` : `No process running in '${name}'.`);
      break;
    }

    case "stats": {
      const name = interaction.options.getString("name") ?? multiSession.getActiveSessionName();
      const session = multiSession.getSession(name);
      if (!session) {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
        return;
      }
      const stats = session.manager.getStats();
      const info = session.manager.getInfo();
      const tool = CLI_TOOLS[session.cliName];
      const embed = new EmbedBuilder()
        .setTitle(`Stats: ${name}`)
        .setColor(0xFEE75C)
        .addFields(
          { name: "CLI Tool", value: tool.name, inline: true },
          { name: "Messages", value: String(info.messageCount), inline: true },
          { name: "Input Tokens", value: stats.totalInputTokens.toLocaleString(), inline: true },
          { name: "Output Tokens", value: stats.totalOutputTokens.toLocaleString(), inline: true },
          { name: "Total Tokens", value: stats.totalTokens.toLocaleString(), inline: true },
        );
      await interaction.reply({ embeds: [embed] });
      break;
    }

    case "history": {
      const name = interaction.options.getString("name") ?? multiSession.getActiveSessionName();
      const count = interaction.options.getInteger("count") ?? 10;
      const session = multiSession.getSession(name);
      if (!session) {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
        return;
      }
      const history = session.manager.getHistory(count);
      if (history.length === 0) {
        await interaction.reply(`Session '${name}' has no history yet.`);
        return;
      }
      const lines = history.map((entry) => {
        const role = entry.role === "user" ? "User" : "AI";
        const content = entry.content.length > 100 ? entry.content.slice(0, 100) + "..." : entry.content;
        return `**${role}**: ${content}`;
      });
      const embed = new EmbedBuilder()
        .setTitle(`History: ${name}`)
        .setDescription(lines.join("\n\n"))
        .setColor(0x5865F2)
        .setFooter({ text: `Showing last ${history.length} entries` });
      await interaction.reply({ embeds: [embed] });
      break;
    }

    case "info":
    default: {
      const name = interaction.options.getString("name") ?? multiSession.getActiveSessionName();
      const session = multiSession.getSession(name);
      if (!session) {
        await interaction.reply({ content: `Session '${name}' not found.`, ephemeral: true });
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

      const embed = new EmbedBuilder()
        .setTitle(`Session: ${name}`)
        .setColor(0x5865F2)
        .addFields(
          { name: "CLI Tool", value: info.toolName, inline: true },
          { name: "Status", value: status, inline: true },
          { name: "Messages", value: String(info.messageCount), inline: true },
          { name: "Duration", value: info.startedAt ? `${mins}m ${secs}s` : "—", inline: true },
          { name: "Working Directory", value: `\`${info.cwd}\``, inline: false },
        );
      await interaction.reply({ embeds: [embed] });
      break;
    }
  }
}

export default { data, execute } as SlashCommand;
