import type { PrefixCommand, CommandContext } from "../types.js";
import { COMMAND_TIMEOUT } from "../config.js";
import { isAllowedUser, isCommandBlocked } from "../utils/security.js";
import { runCommand } from "../utils/subprocess.js";
import { formatOutput, sendResult } from "../utils/formatter.js";
import { withTyping } from "../utils/typing.js";
import { audit, AuditEvent } from "../utils/auditLog.js";

const execCommand: PrefixCommand = {
  name: "exec",
  aliases: ["run", "cmd"],
  description: "Execute a CMD command.",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const command = ctx.args.join(" ");
    if (!command) {
      await ctx.message.reply("Usage: `!exec <command>`");
      return;
    }

    if (isCommandBlocked(command)) {
      audit(AuditEvent.COMMAND_BLOCKED, ctx.message.author.id, {
        command: `exec ${command}`,
        success: false,
      });
      await ctx.message.reply("This command is blocked for safety reasons.");
      return;
    }

    const { code, stdout, stderr } = await withTyping(ctx.message, () =>
      runCommand(command, { timeout: COMMAND_TIMEOUT * 1000 }),
    );

    const result = formatOutput(stdout, stderr, code);
    await sendResult(ctx.message, result, { prefix: "**CMD**" });
  },
};

export default execCommand;
