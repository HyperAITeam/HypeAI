import type { TextChannel } from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import { isAllowedUser } from "../utils/security.js";
import { discordToPlatformMessage, getDiscordAdapter } from "../platform/discordAdapter.js";
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
import { sendResult } from "../utils/formatter.js";
import { withTyping } from "../utils/typing.js";
import { checkPromptInjection } from "../utils/promptGuard.js";

// 작업 실행 중단 플래그
let isRunningTasks = false;
let shouldStopTasks = false;

function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "📋 예약된 작업이 없습니다.";
  }

  const statusEmoji: Record<Task["status"], string> = {
    pending: "⏳",
    running: "🔄",
    completed: "✅",
    failed: "❌",
  };

  const lines = tasks.map((t) => `${t.id}. ${statusEmoji[t.status]} ${t.content}`);

  return `📋 **예약된 작업** (${tasks.length}개)\n━━━━━━━━━━━━━━━━━\n${lines.join("\n")}`;
}

const taskCommand: PrefixCommand = {
  name: "task",
  aliases: ["t"],
  description: "Manage scheduled tasks. Subcommands: add, list, run, remove, clear, stop",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const subcommand = ctx.args[0]?.toLowerCase();
    const rest = ctx.args.slice(1).join(" ");

    switch (subcommand) {
      case "add":
      case "a":
        await handleAdd(ctx, rest);
        break;

      case "list":
      case "ls":
      case "l":
        await handleList(ctx);
        break;

      case "run":
      case "r":
        await handleRun(ctx);
        break;

      case "remove":
      case "rm":
      case "del":
        await handleRemove(ctx, rest);
        break;

      case "clear":
      case "c":
        await handleClear(ctx);
        break;

      case "stop":
      case "s":
        await handleStop(ctx);
        break;

      default:
        await ctx.message.reply(
          "**📋 Task 명령어 사용법**\n" +
            "```\n" +
            "!task add <작업>     작업 추가\n" +
            "!task list           작업 목록\n" +
            "!task run            예약된 작업 실행\n" +
            "!task remove <번호>  작업 삭제\n" +
            "!task clear          대기 중인 작업 초기화\n" +
            "!task stop           실행 중단\n" +
            "```\n" +
            "**별칭**: `!t`, add=`a`, list=`ls`, run=`r`, remove=`rm`, clear=`c`, stop=`s`",
        );
    }
  },
};

async function handleAdd(ctx: CommandContext, content: string): Promise<void> {
  if (!content.trim()) {
    await ctx.message.reply("❌ 작업 내용을 입력해주세요.\n예: `!task add 버그 수정해줘`");
    return;
  }

  // Prompt injection warning (non-blocking)
  const injectionCheck = checkPromptInjection(content);
  if (injectionCheck.detected) {
    await ctx.message.reply(
      `**[Security Warning]** Suspicious prompt pattern detected: ${injectionCheck.warnings.join(", ")}. Task will still be added.`,
    );
  }

  const task = await addTask(ctx.client.workingDir, content.trim());
  await ctx.message.reply(`✅ 작업 추가됨 **[${task.id}]** ${task.content}`);
}

async function handleList(ctx: CommandContext): Promise<void> {
  const store = loadTasks(ctx.client.workingDir);
  const list = formatTaskList(store.tasks);
  await ctx.message.reply(list);
}

async function handleRemove(ctx: CommandContext, idStr: string): Promise<void> {
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    await ctx.message.reply("❌ 삭제할 작업 번호를 입력해주세요.\n예: `!task remove 1`");
    return;
  }

  const removed = await removeTask(ctx.client.workingDir, id);
  if (removed) {
    await ctx.message.reply(`🗑️ 작업 **[${id}]** 삭제됨`);
  } else {
    await ctx.message.reply(`❌ 작업 **[${id}]**을 찾을 수 없습니다.`);
  }
}

async function handleClear(ctx: CommandContext): Promise<void> {
  const count = await clearTasks(ctx.client.workingDir);
  await ctx.message.reply(`🗑️ 대기 중인 작업 **${count}개** 삭제됨`);
}

async function handleStop(ctx: CommandContext): Promise<void> {
  if (!isRunningTasks) {
    await ctx.message.reply("⚠️ 현재 실행 중인 작업이 없습니다.");
    return;
  }

  shouldStopTasks = true;
  await ctx.message.reply("🛑 작업 중단 요청됨. 현재 작업 완료 후 중단됩니다.");
}

async function handleRun(ctx: CommandContext): Promise<void> {
  if (isRunningTasks) {
    await ctx.message.reply("⚠️ 이미 작업이 실행 중입니다. `!task stop`으로 중단할 수 있습니다.");
    return;
  }

  const pendingTasks = getPendingTasks(ctx.client.workingDir);

  if (pendingTasks.length === 0) {
    await ctx.message.reply("📋 실행할 작업이 없습니다. `!task add <작업>`으로 추가하세요.");
    return;
  }

  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.message.reply("❌ 세션 매니저가 초기화되지 않았습니다.");
    return;
  }

  isRunningTasks = true;
  shouldStopTasks = false;

  const channel = ctx.message.channel as TextChannel;

  await ctx.message.reply(`🚀 **작업 시작!** (${pendingTasks.length}개)\n━━━━━━━━━━━━━━━━━`);

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < pendingTasks.length; i++) {
    if (shouldStopTasks) {
      await channel.send(`🛑 작업 중단됨. ${completed}개 완료, ${pendingTasks.length - i}개 남음`);
      break;
    }

    const task = pendingTasks[i];
    await updateTaskStatus(ctx.client.workingDir, task.id, "running");

    await channel.send(`\n**[${i + 1}/${pendingTasks.length}]** ${task.content}...`);

    try {
      // 기본 세션으로 메시지 전송
      const platformMsg = discordToPlatformMessage(ctx.message);
      const adapter = getDiscordAdapter();
      const result = await withTyping(ctx.message, () =>
        multiSession.sendMessage(null, task.content, platformMsg, adapter),
      );

      await updateTaskStatus(ctx.client.workingDir, task.id, "completed", result);
      completed++;

      // 결과 전송 (긴 경우 파일로)
      await sendResult(ctx.message, result, { prefix: `✅ **[${task.id}]** 완료` });
    } catch (err: any) {
      await updateTaskStatus(ctx.client.workingDir, task.id, "failed", err.message);
      failed++;
      await channel.send(`❌ **[${task.id}]** 실패: ${err.message}`);
    }
  }

  isRunningTasks = false;
  shouldStopTasks = false;

  await channel.send(
    `\n━━━━━━━━━━━━━━━━━\n🎉 **작업 완료!** ✅ ${completed}개 완료` +
      (failed > 0 ? ` / ❌ ${failed}개 실패` : ""),
  );
}

export default taskCommand;
