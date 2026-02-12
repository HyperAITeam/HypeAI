import type { CrossPlatformContext } from "../../platform/context.js";
import { COMMAND_PREFIX, CLI_TOOLS } from "../../config.js";

export async function executeHelp(ctx: CrossPlatformContext): Promise<void> {
  if (!ctx.adapter.isAuthorized(ctx.message.userId)) {
    await ctx.adapter.reply(ctx.message, "You are not authorized to use this bot.");
    return;
  }

  const p = COMMAND_PREFIX;
  const tool = CLI_TOOLS[ctx.selectedCli];

  await ctx.adapter.replyRich(ctx.message, {
    title: "AI CLI Gateway Bot",
    description: `Currently using ${tool.name}.`,
    color: 0x5865F2,
    fields: [
      {
        name: "AI CLI",
        value: [
          `${p}ask [session] <message> — Send message (alias: ${p}a)`,
          `${p}session create <name> [cli] [cwd] — Create session`,
          `${p}session list — List all sessions (alias: ${p}s ls)`,
          `${p}session switch <name> — Switch session (alias: ${p}s sw)`,
          `${p}session info [name] — Show session info (alias: ${p}s)`,
          `${p}session new [name] — Reset session`,
          `${p}session kill [name] — Kill session process`,
          `${p}session delete <name> — Delete session`,
          `${p}session stats [name] — Show token stats`,
          `${p}session history [name] [count] — Show history`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "CMD Execution",
        value: `${p}exec <command> — Run a CMD command (aliases: ${p}run, ${p}cmd)`,
        inline: false,
      },
      {
        name: "System",
        value: [
          `${p}status — Show system info`,
          `${p}help — Show this message`,
        ].join("\n"),
        inline: false,
      },
    ],
    footer: "Only authorized users can use this bot.",
  });
}
