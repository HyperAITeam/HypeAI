import { SlashCommandBuilder, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import type { BotClient } from "../types.js";
import { isAllowedUser } from "../utils/security.js";
import {
  addTask,
  removeTask,
  clearTasks,
  getPendingTasks,
  updateTaskStatus,
  loadTasks,
  type Task,
} from "../utils/taskStore.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";
import { checkPromptInjection } from "../utils/promptGuard.js";
import type { SlashCommand } from "./index.js";
import type { PlatformMessage } from "../platform/types.js";
import { getDiscordAdapter } from "../platform/discordAdapter.js";

const data = new SlashCommandBuilder()
  .setName("task")
  .setDescription("Manage scheduled tasks")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a scheduled task")
      .addStringOption((opt) => opt.setName("content").setDescription("Task content").setRequired(true)),
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all tasks"))
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a task")
      .addIntegerOption((opt) => opt.setName("id").setDescription("Task ID").setRequired(true)),
  )
  .addSubcommand((sub) => sub.setName("clear").setDescription("Clear all pending tasks"))
  .addSubcommand((sub) => sub.setName("run").setDescription("Run all pending tasks"))
  .addSubcommand((sub) => sub.setName("stop").setDescription("Stop running tasks"));

let isRunningTasks = false;
let shouldStopTasks = false;

function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return "No scheduled tasks.";
  const lines = tasks.map((t) => {
    const emoji = { pending: "⏳", running: "🔄", completed: "✅", failed: "❌" }[t.status];
    return `${t.id}. ${emoji} ${t.content}`;
  });
  return `**Scheduled Tasks** (${tasks.length})\n${lines.join("\n")}`;
}

async function execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({ content: "You are not authorized.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "add": {
      const content = interaction.options.getString("content", true);
      const injectionCheck = checkPromptInjection(content);
      if (injectionCheck.detected) {
        await interaction.reply({
          content: `**[Security Warning]** Suspicious pattern detected. Task still added.`,
          ephemeral: true,
        });
      }
      const task = await addTask(client.workingDir, content.trim());
      await interaction.reply(`Task added **[${task.id}]** ${task.content}`);
      break;
    }

    case "list": {
      const store = loadTasks(client.workingDir);
      await interaction.reply(formatTaskList(store.tasks));
      break;
    }

    case "remove": {
      const id = interaction.options.getInteger("id", true);
      const removed = await removeTask(client.workingDir, id);
      await interaction.reply(removed ? `Task **[${id}]** removed.` : `Task **[${id}]** not found.`);
      break;
    }

    case "clear": {
      const count = await clearTasks(client.workingDir);
      await interaction.reply(`Cleared **${count}** pending task(s).`);
      break;
    }

    case "stop": {
      if (!isRunningTasks) {
        await interaction.reply("No tasks are currently running.");
        return;
      }
      shouldStopTasks = true;
      await interaction.reply("Stop requested. Will stop after current task.");
      break;
    }

    case "run": {
      if (isRunningTasks) {
        await interaction.reply({ content: "Tasks are already running.", ephemeral: true });
        return;
      }

      const pending = getPendingTasks(client.workingDir);
      if (pending.length === 0) {
        await interaction.reply("No pending tasks.");
        return;
      }

      const multiSession = getMultiSessionManager();
      if (!multiSession) {
        await interaction.reply({ content: "Session manager not initialized.", ephemeral: true });
        return;
      }

      await interaction.deferReply();
      isRunningTasks = true;
      shouldStopTasks = false;

      let completed = 0;
      let failed = 0;
      const channel = interaction.channel as TextChannel;

      for (let i = 0; i < pending.length; i++) {
        if (shouldStopTasks) break;
        const task = pending[i];
        await updateTaskStatus(client.workingDir, task.id, "running");
        try {
          const platformMsg: PlatformMessage = {
            platform: "discord",
            userId: interaction.user.id,
            displayName: interaction.user.displayName ?? interaction.user.username,
            channelId: interaction.channelId,
            content: task.content,
            raw: interaction,
          };
          const adapter = getDiscordAdapter();
          const result = await multiSession.sendMessage(
            null,
            task.content,
            platformMsg,
            adapter,
          );
          await updateTaskStatus(client.workingDir, task.id, "completed", result);
          completed++;
        } catch (err: any) {
          await updateTaskStatus(client.workingDir, task.id, "failed", err.message);
          failed++;
        }
      }

      isRunningTasks = false;
      shouldStopTasks = false;

      await interaction.editReply(
        `Tasks done! ${completed} completed` + (failed > 0 ? `, ${failed} failed` : ""),
      );
      break;
    }
  }
}

export default { data, execute } as SlashCommand;
