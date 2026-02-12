import type { PrefixCommand, CommandContext } from "../types.js";
import { discordToPlatformMessage, getDiscordAdapter } from "../platform/discordAdapter.js";
import { executeHelp } from "./cross/helpCross.js";

const helpCommand: PrefixCommand = {
  name: "help",
  aliases: [],
  description: "Show all available commands.",

  async execute(ctx: CommandContext): Promise<void> {
    const platformMsg = discordToPlatformMessage(ctx.message);
    await executeHelp({
      message: platformMsg,
      args: ctx.args,
      adapter: getDiscordAdapter(),
      selectedCli: ctx.client.selectedCli,
      workingDir: ctx.client.workingDir,
    });
  },
};

export default helpCommand;
