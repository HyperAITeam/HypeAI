import type { PrefixCommand, CommandContext } from "../types.js";
import { discordToPlatformMessage, getDiscordAdapter } from "../platform/discordAdapter.js";
import { executeSession } from "./cross/sessionCross.js";

const sessionCommand: PrefixCommand = {
  name: "session",
  aliases: ["s"],
  description: "Session management (info / create / list / delete / new / kill / switch / stats / history / cwd).",

  async execute(ctx: CommandContext): Promise<void> {
    const platformMsg = discordToPlatformMessage(ctx.message);
    await executeSession({
      message: platformMsg,
      args: ctx.args,
      adapter: getDiscordAdapter(),
      selectedCli: ctx.client.selectedCli,
      workingDir: ctx.client.workingDir,
    });
  },
};

export default sessionCommand;
