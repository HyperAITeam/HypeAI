import os from "node:os";
import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "../types.js";
import { isAllowedUser } from "../utils/security.js";
import type { SlashCommand } from "./index.js";

const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show system status");

function gb(bytes: number): string {
  return Math.floor(bytes / 1073741824).toString();
}

async function execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({ content: "You are not authorized.", ephemeral: true });
    return;
  }

  const cpus = os.cpus();
  const cpuUsage = cpus.length > 0
    ? Math.round(
        cpus.reduce((sum, c) => {
          const total = Object.values(c.times).reduce((a, b) => a + b, 0);
          return sum + ((total - c.times.idle) / total) * 100;
        }, 0) / cpus.length,
      )
    : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const uptimeSecs = os.uptime();
  const hours = Math.floor(uptimeSecs / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);
  const secs = Math.floor(uptimeSecs % 60);

  const embed = new EmbedBuilder()
    .setTitle("System Status")
    .setColor(0x2ECC71)
    .addFields(
      { name: "OS", value: `${os.type()} ${os.release()}`, inline: true },
      { name: "CPU", value: `${cpuUsage}%`, inline: true },
      { name: "Memory", value: `${memPercent}% (${gb(usedMem)}/${gb(totalMem)} GB)`, inline: true },
      { name: "Uptime", value: `${hours}h ${mins}m ${secs}s`, inline: true },
      { name: "Node.js", value: process.version, inline: true },
    );

  await interaction.reply({ embeds: [embed] });
}

export default { data, execute } as SlashCommand;
