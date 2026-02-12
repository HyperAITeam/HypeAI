import path from "node:path";
import type { CrossPlatformContext } from "../../platform/context.js";
import { CLI_TOOLS } from "../../config.js";
import { getMultiSessionManager } from "../../sessions/multiSession.js";
import { checkPromptInjection } from "../../utils/promptGuard.js";
import { audit, AuditEvent } from "../../utils/auditLog.js";

/**
 * Parse args to extract optional session name and message.
 * !a work "message" → { sessionName: "work", message: "message" }
 * !a "message"       → { sessionName: null, message: "message" }
 */
function parseAskArgs(args: string[]): { sessionName: string | null; message: string } {
  if (args.length === 0) {
    return { sessionName: null, message: "" };
  }

  const firstArg = args[0];

  if (firstArg.startsWith('"') || firstArg.startsWith("'")) {
    return { sessionName: null, message: args.join(" ") };
  }

  const multiSession = getMultiSessionManager();
  if (multiSession?.hasSession(firstArg)) {
    return {
      sessionName: firstArg,
      message: args.slice(1).join(" "),
    };
  }

  return { sessionName: null, message: args.join(" ") };
}

export async function executeAsk(ctx: CrossPlatformContext): Promise<void> {
  if (!ctx.adapter.isAuthorized(ctx.message.userId)) {
    await ctx.adapter.reply(ctx.message, "You are not authorized to use this bot.");
    return;
  }

  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const { sessionName, message: msg } = parseAskArgs(ctx.args);

  if (!msg) {
    await ctx.adapter.reply(
      ctx.message,
      "Usage: !ask [session] <message>\nExample: !a hello or !a work \"analyze this code\"",
    );
    return;
  }

  // Prompt injection warning (non-blocking)
  const injectionCheck = checkPromptInjection(msg);
  if (injectionCheck.detected) {
    audit(AuditEvent.INJECTION_WARNING, ctx.message.userId, {
      command: "ask",
      details: { warnings: injectionCheck.warnings },
    });
    await ctx.adapter.reply(
      ctx.message,
      `[Security Warning] Suspicious prompt pattern detected: ${injectionCheck.warnings.join(", ")}. Proceeding with caution.`,
    );
  }

  // Get or lazy-create session
  const targetSessionName = sessionName ?? multiSession.getActiveSessionName();
  let namedSession = multiSession.getSession(targetSessionName);

  if (!namedSession && targetSessionName === "default") {
    try {
      namedSession = multiSession.createSession("default", ctx.selectedCli);
    } catch (err: any) {
      await ctx.adapter.reply(ctx.message, `Failed to create default session: ${err.message}`);
      return;
    }
  }

  if (!namedSession) {
    await ctx.adapter.reply(
      ctx.message,
      `Session '${targetSessionName}' not found. Create with: !session create ${targetSessionName} <cli>`,
    );
    return;
  }

  if (namedSession.manager.isBusy) {
    await ctx.adapter.reply(
      ctx.message,
      `Session '${targetSessionName}' is already processing. Use !session kill ${targetSessionName} to cancel.`,
    );
    return;
  }

  const tool = CLI_TOOLS[namedSession.cliName];
  const folder = path.basename(ctx.workingDir);

  try {
    // Send progress message
    const progressHandle = await ctx.adapter.sendProgress(
      ctx.message,
      `\u{23F3} ${tool.name} 작업 시작...`,
    );
    let lastEditTime = 0;
    const THROTTLE_MS = 2000;

    const onProgress = (status: string) => {
      const now = Date.now();
      if (now - lastEditTime < THROTTLE_MS) return;
      lastEditTime = now;
      progressHandle.update(`\u{23F3} ${tool.name} 작업 중...\n${status}`).catch(() => {});
    };

    // Show typing indicator
    const typing = ctx.adapter.showTyping(ctx.message);

    try {
      const result = await multiSession.sendMessage(
        sessionName,
        msg,
        ctx.message,
        ctx.adapter,
        onProgress,
      );

      // Delete progress message
      await progressHandle.delete();

      const prefix =
        sessionName || multiSession.listSessions().length > 1
          ? `${tool.name} @ ${folder} [${namedSession.name}]`
          : `${tool.name} @ ${folder}`;

      // Send result with file fallback for long output
      const fullResult = `${prefix}\n\`\`\`\n${result}\n\`\`\``;

      if (fullResult.length <= ctx.adapter.maxMessageLength) {
        await ctx.adapter.reply(ctx.message, fullResult);
      } else {
        // Send preview + file attachment
        const maxPreview = ctx.adapter.maxMessageLength - 200;
        const preview = result.slice(0, maxPreview);
        const previewText = `${prefix}\n\`\`\`\n${preview}\n\`\`\`\n(truncated — full output attached)`;

        await ctx.adapter.replyWithFile(ctx.message, previewText, {
          name: "output.txt",
          content: Buffer.from(result, "utf-8"),
        });
      }
    } finally {
      typing.stop();
    }
  } catch (err: any) {
    await ctx.adapter.reply(ctx.message, `Error: ${err.message}`);
  }
}
