import path from "node:path";
import type { PrefixCommand, CommandContext } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { sendResult } from "../utils/formatter.js";
import { withTyping } from "../utils/typing.js";
import type { ISessionManager } from "../sessions/types.js";

/** Shared session — injected from bot.ts */
let session: ISessionManager | null = null;
export function setSession(s: ISessionManager): void {
  session = s;
}
export function getSession(): ISessionManager | null {
  return session;
}

const askCommand: PrefixCommand = {
  name: "ask",
  aliases: ["a"],
  description: "Send a message to the AI CLI.",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    if (!session) {
      await ctx.message.reply("Session not initialized.");
      return;
    }

    const msg = ctx.args.join(" ");
    if (!msg) {
      await ctx.message.reply("Usage: `!ask <message>`");
      return;
    }

    if (session.isBusy) {
      await ctx.message.reply(
        "CLI is already processing a request. Use `!session kill` to cancel it.",
      );
      return;
    }

    const tool = CLI_TOOLS[ctx.client.selectedCli];
    const folder = path.basename(ctx.client.workingDir);

    const result = await withTyping(ctx.message, () =>
      session!.sendMessage(msg, ctx.message),
    );

    await sendResult(ctx.message, result, {
      prefix: `**${tool.name}** @ \`${folder}\``,
    });
  },
};

export default askCommand;
