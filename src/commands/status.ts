import type { PrefixCommand, CommandContext } from "../types.js";
import { discordToPlatformMessage, getDiscordAdapter } from "../platform/discordAdapter.js";
import { executeStatus } from "./cross/statusCross.js";

const statusCommand: PrefixCommand = {
  name: "status",
  aliases: ["sysinfo"],
  description: "Show system status.",

  async execute(ctx: CommandContext): Promise<void> {
    const platformMsg = discordToPlatformMessage(ctx.message);
    await executeStatus({
      message: platformMsg,
      args: ctx.args,
      adapter: getDiscordAdapter(),
      selectedCli: ctx.client.selectedCli,
      workingDir: ctx.client.workingDir,
    });
  },
};

export default statusCommand;
