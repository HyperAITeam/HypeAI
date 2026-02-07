import type { PrefixCommand, CommandContext } from "../types.js";

const myidCommand: PrefixCommand = {
  name: "myid",
  aliases: ["id"],
  description: "Show your Discord user ID.",

  async execute(ctx: CommandContext): Promise<void> {
    const { author } = ctx.message;
    await ctx.message.reply(
      `Your Discord User ID: \`${author.id}\`\n` +
      `Copy this into \`.env\` → \`ALLOWED_USER_IDS=${author.id}\``,
    );
  },
};

export default myidCommand;
