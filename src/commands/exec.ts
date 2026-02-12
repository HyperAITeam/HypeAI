import type { PrefixCommand, CommandContext } from "../types.js";
import { discordToPlatformMessage, getDiscordAdapter } from "../platform/discordAdapter.js";
import { executeExec } from "./cross/execCross.js";

const execCommand: PrefixCommand = {
  name: "exec",
  aliases: ["run", "cmd"],
  description: "Execute a CMD command.",

  async execute(ctx: CommandContext): Promise<void> {
    const platformMsg = discordToPlatformMessage(ctx.message);
    await executeExec({
      message: platformMsg,
      args: ctx.args,
      adapter: getDiscordAdapter(),
      selectedCli: ctx.client.selectedCli,
      workingDir: ctx.client.workingDir,
    });
  },
};

export default execCommand;
