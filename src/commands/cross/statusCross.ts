import os from "node:os";
import type { CrossPlatformContext } from "../../platform/context.js";

export async function executeStatus(ctx: CrossPlatformContext): Promise<void> {
  if (!ctx.adapter.isAuthorized(ctx.message.userId)) {
    await ctx.adapter.reply(ctx.message, "You are not authorized to use this bot.");
    return;
  }

  const cpus = os.cpus();
  const cpuUsage = cpus.length > 0
    ? Math.round(
        cpus.reduce((sum, c) => {
          const total = Object.values(c.times).reduce((a, b) => a + b, 0);
          return sum + ((total - c.times.idle) / total) * 100;
        }, 0) / cpus.length,
      )
    : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const uptimeSecs = os.uptime();
  const hours = Math.floor(uptimeSecs / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);
  const secs = Math.floor(uptimeSecs % 60);

  const gb = (bytes: number): string => Math.floor(bytes / 1073741824).toString();

  await ctx.adapter.replyRich(ctx.message, {
    title: "System Status",
    color: 0x2ECC71,
    fields: [
      { name: "OS", value: `${os.type()} ${os.release()}`, inline: true },
      { name: "CPU", value: `${cpuUsage}%`, inline: true },
      {
        name: "Memory",
        value: `${memPercent}% (${gb(usedMem)}/${gb(totalMem)} GB)`,
        inline: true,
      },
      { name: "Uptime", value: `${hours}h ${mins}m ${secs}s`, inline: true },
      { name: "Node.js", value: process.version, inline: true },
    ],
  });
}
