import type { PrefixCommand, CommandContext } from "../types.js";
import { discordToPlatformMessage, getDiscordAdapter } from "../platform/discordAdapter.js";
import { executeAsk } from "./cross/askCross.js";

const askCommand: PrefixCommand = {
  name: "ask",
  aliases: ["a"],
  description: "Send a message to the AI CLI. Usage: !a [session] <message>",

  async execute(ctx: CommandContext): Promise<void> {
    const platformMsg = discordToPlatformMessage(ctx.message);
    await executeAsk({
      message: platformMsg,
      args: ctx.args,
      adapter: getDiscordAdapter(),
      selectedCli: ctx.client.selectedCli,
      workingDir: ctx.client.workingDir,
    });
  },
};

export default askCommand;
