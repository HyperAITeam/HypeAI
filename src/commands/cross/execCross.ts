import type { CrossPlatformContext } from "../../platform/context.js";
import { COMMAND_TIMEOUT } from "../../config.js";
import { isCommandBlocked } from "../../utils/security.js";
import { runCommand } from "../../utils/subprocess.js";
import { formatOutput } from "../../utils/formatter.js";
import { audit, AuditEvent } from "../../utils/auditLog.js";

export async function executeExec(ctx: CrossPlatformContext): Promise<void> {
  if (!ctx.adapter.isAuthorized(ctx.message.userId)) {
    await ctx.adapter.reply(ctx.message, "You are not authorized to use this bot.");
    return;
  }

  const command = ctx.args.join(" ");
  if (!command) {
    await ctx.adapter.reply(ctx.message, "Usage: !exec <command>");
    return;
  }

  if (isCommandBlocked(command)) {
    audit(AuditEvent.COMMAND_BLOCKED, ctx.message.userId, {
      command: `exec ${command}`,
      success: false,
    });
    await ctx.adapter.reply(ctx.message, "This command is blocked for safety reasons.");
    return;
  }

  const typing = ctx.adapter.showTyping(ctx.message);
  try {
    const { code, stdout, stderr } = await runCommand(command, {
      timeout: COMMAND_TIMEOUT * 1000,
    });

    const result = formatOutput(stdout, stderr, code);
    const fullResult = `CMD\n\`\`\`\n${result}\n\`\`\``;

    if (fullResult.length <= ctx.adapter.maxMessageLength) {
      await ctx.adapter.reply(ctx.message, fullResult);
    } else {
      const maxPreview = ctx.adapter.maxMessageLength - 200;
      const preview = result.slice(0, maxPreview);
      await ctx.adapter.replyWithFile(
        ctx.message,
        `CMD\n\`\`\`\n${preview}\n\`\`\`\n(truncated — full output attached)`,
        {
          name: "output.txt",
          content: Buffer.from(result, "utf-8"),
        },
      );
    }
  } finally {
    typing.stop();
  }
}
