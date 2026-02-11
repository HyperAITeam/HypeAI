import path from "node:path";
import type { PrefixCommand, CommandContext } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { sendResult } from "../utils/formatter.js";
import { withTyping } from "../utils/typing.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";
import { checkPromptInjection } from "../utils/promptGuard.js";

/**
 * 명령어 인자에서 세션 이름과 메시지 분리
 * !a work "메시지" → { sessionName: "work", message: "메시지" }
 * !a "메시지"       → { sessionName: null, message: "메시지" }
 */
function parseAskArgs(args: string[]): { sessionName: string | null; message: string } {
  if (args.length === 0) {
    return { sessionName: null, message: "" };
  }

  const firstArg = args[0];

  // 따옴표로 시작하면 전체가 메시지
  if (firstArg.startsWith('"') || firstArg.startsWith("'")) {
    return { sessionName: null, message: args.join(" ") };
  }

  // 첫 인자가 존재하는 세션 이름인지 확인
  const multiSession = getMultiSessionManager();
  if (multiSession?.hasSession(firstArg)) {
    return {
      sessionName: firstArg,
      message: args.slice(1).join(" "),
    };
  }

  // 아니면 전체가 메시지
  return { sessionName: null, message: args.join(" ") };
}

const askCommand: PrefixCommand = {
  name: "ask",
  aliases: ["a"],
  description: "Send a message to the AI CLI. Usage: !a [session] <message>",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const multiSession = getMultiSessionManager();
    if (!multiSession) {
      await ctx.message.reply("Session manager not initialized.");
      return;
    }

    const { sessionName, message: msg } = parseAskArgs(ctx.args);

    if (!msg) {
      await ctx.message.reply(
        "Usage: `!ask [session] <message>`\nExample: `!a hello` or `!a work \"analyze this code\"`",
      );
      return;
    }

    // Prompt injection warning (non-blocking)
    const injectionCheck = checkPromptInjection(msg);
    if (injectionCheck.detected) {
      await ctx.message.reply(
        `**[Security Warning]** Suspicious prompt pattern detected: ${injectionCheck.warnings.join(", ")}. Proceeding with caution.`,
      );
    }

    // 세션 조회 (없으면 default lazy 생성)
    const targetSessionName = sessionName ?? multiSession.getActiveSessionName();
    let namedSession = multiSession.getSession(targetSessionName);

    // default 세션이 없으면 자동 생성
    if (!namedSession && targetSessionName === "default") {
      try {
        namedSession = multiSession.createSession("default", ctx.client.selectedCli);
      } catch (err: any) {
        await ctx.message.reply(`Failed to create default session: ${err.message}`);
        return;
      }
    }

    if (!namedSession) {
      await ctx.message.reply(
        `Session '${targetSessionName}' not found. Create with: \`!session create ${targetSessionName} <cli>\``,
      );
      return;
    }

    if (namedSession.manager.isBusy) {
      await ctx.message.reply(
        `Session '${targetSessionName}' is already processing. Use \`!session kill ${targetSessionName}\` to cancel.`,
      );
      return;
    }

    const tool = CLI_TOOLS[namedSession.cliName];
    const folder = path.basename(ctx.client.workingDir);

    try {
      // 진행 메시지 전송
      const progressMsg = await ctx.message.reply(
        `\u{23F3} **${tool.name}** \uC791\uC5C5 \uC2DC\uC791...`,
      );
      let lastEditTime = 0;
      const THROTTLE_MS = 2000;

      const onProgress = (status: string) => {
        const now = Date.now();
        if (now - lastEditTime < THROTTLE_MS) return;
        lastEditTime = now;
        progressMsg
          .edit(`\u{23F3} **${tool.name}** \uC791\uC5C5 \uC911...\n${status}`)
          .catch(() => {});
      };

      const result = await withTyping(ctx.message, () =>
        multiSession.sendMessage(sessionName, msg, ctx.message, onProgress),
      );

      // 진행 메시지 삭제
      await progressMsg.delete().catch(() => {});

      const prefix =
        sessionName || multiSession.listSessions().length > 1
          ? `**${tool.name}** @ \`${folder}\` [${namedSession.name}]`
          : `**${tool.name}** @ \`${folder}\``;

      await sendResult(ctx.message, result, { prefix });
    } catch (err: any) {
      await ctx.message.reply(`Error: ${err.message}`);
    }
  },
};

export default askCommand;
