import type { CrossPlatformContext } from "../../platform/context.js";
import { CLI_TOOLS } from "../../config.js";
import { getMultiSessionManager } from "../../sessions/multiSession.js";
import { audit, AuditEvent } from "../../utils/auditLog.js";

export async function executeSession(ctx: CrossPlatformContext): Promise<void> {
  if (!ctx.adapter.isAuthorized(ctx.message.userId)) {
    await ctx.adapter.reply(ctx.message, "You are not authorized to use this bot.");
    return;
  }

  const sub = ctx.args[0]?.toLowerCase() ?? "info";

  switch (sub) {
    case "create":
    case "c":
      return handleCreate(ctx);
    case "list":
    case "ls":
      return handleList(ctx);
    case "delete":
    case "del":
    case "rm":
      return handleDelete(ctx);
    case "new":
      return handleNew(ctx);
    case "kill":
    case "stop":
      return handleKill(ctx);
    case "switch":
    case "sw":
      return handleSwitch(ctx);
    case "stats":
    case "stat":
      return handleStats(ctx);
    case "history":
    case "hist":
    case "h":
      return handleHistory(ctx);
    case "cwd":
    case "dir":
      return handleCwd(ctx);
    case "info":
    default:
      return handleInfo(ctx);
  }
}

async function handleCreate(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1];
  if (!name) {
    await ctx.adapter.reply(
      ctx.message,
      "Usage: !session create <name> [cli] [cwd]\nExample: !session create work claude",
    );
    return;
  }

  let cliName = ctx.selectedCli;
  let cwd: string | undefined;

  const arg2 = ctx.args[2];
  if (arg2) {
    if (CLI_TOOLS[arg2.toLowerCase()]) {
      cliName = arg2.toLowerCase();
      if (ctx.args[3]) {
        cwd = ctx.args.slice(3).join(" ");
      }
    } else {
      cwd = ctx.args.slice(2).join(" ");
    }
  }

  try {
    const session = multiSession.createSession(name, cliName, cwd);
    const tool = CLI_TOOLS[cliName];

    audit(AuditEvent.SESSION_CREATED, ctx.message.userId, {
      sessionName: name,
      details: { cli: cliName, cwd: session.cwd },
    });

    await ctx.adapter.replyRich(ctx.message, {
      title: "Session Created",
      color: 0x57F287,
      fields: [
        { name: "Name", value: session.name, inline: true },
        { name: "CLI", value: tool.name, inline: true },
        { name: "Working Directory", value: session.cwd, inline: false },
      ],
      footer: `Use: !a ${name} "message" or !session switch ${name}`,
    });
  } catch (err: any) {
    await ctx.adapter.reply(ctx.message, `Failed to create session: ${err.message}`);
  }
}

async function handleList(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const sessions = multiSession.listSessions();
  const activeSessionName = multiSession.getActiveSessionName();

  if (sessions.length === 0) {
    await ctx.adapter.reply(ctx.message, "No sessions. Use !session create <name> [cli] to create one.");
    return;
  }

  const sessionList = sessions
    .map((s) => {
      const tool = CLI_TOOLS[s.cliName];
      const info = s.manager.getInfo();
      const isActive = s.name === activeSessionName;
      const status = info.isBusy ? "Processing" : info.sessionId ? "Active" : "New";
      return `${isActive ? ">" : " "} ${s.name}${isActive ? " (active)" : ""} — ${tool.name} | ${status} | ${info.messageCount} msgs`;
    })
    .join("\n");

  await ctx.adapter.replyRich(ctx.message, {
    title: "Sessions",
    description: sessionList,
    color: 0x5865F2,
    footer: `${sessions.length} session(s) | Active: ${activeSessionName}`,
  });
}

async function handleDelete(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1];
  if (!name) {
    await ctx.adapter.reply(ctx.message, "Usage: !session delete <name>");
    return;
  }

  const session = multiSession.getSession(name);
  if (!session) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  const deleted = await multiSession.deleteSession(name);
  if (deleted) {
    audit(AuditEvent.SESSION_DELETED, ctx.message.userId, { sessionName: name });
    await ctx.adapter.reply(ctx.message, `Session '${name}' deleted.`);
  } else {
    await ctx.adapter.reply(ctx.message, `Failed to delete session '${name}'.`);
  }
}

async function handleNew(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  await session.manager.newSession();
  audit(AuditEvent.SESSION_RESET, ctx.message.userId, { sessionName: name });
  const tool = CLI_TOOLS[session.cliName];
  await ctx.adapter.reply(
    ctx.message,
    `Session '${name}' reset. Next message starts a new ${tool.name} conversation.`,
  );
}

async function handleKill(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  const killed = await session.manager.kill();
  const tool = CLI_TOOLS[session.cliName];

  if (killed) {
    await ctx.adapter.reply(ctx.message, `${tool.name} process in session '${name}' killed.`);
  } else {
    await ctx.adapter.reply(ctx.message, `No CLI process is running in session '${name}'.`);
  }
}

async function handleSwitch(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const targetName = ctx.args[1];

  if (!targetName) {
    return handleList(ctx);
  }

  const session = multiSession.getSession(targetName);
  if (!session) {
    await ctx.adapter.reply(
      ctx.message,
      `Session '${targetName}' not found. Create with: !session create ${targetName} <cli>`,
    );
    return;
  }

  const currentActive = multiSession.getActiveSessionName();
  if (targetName === currentActive) {
    await ctx.adapter.reply(ctx.message, `Already using session '${targetName}'.`);
    return;
  }

  multiSession.setActiveSession(targetName);
  audit(AuditEvent.SESSION_SWITCHED, ctx.message.userId, {
    sessionName: targetName,
    details: { from: currentActive },
  });

  const tool = CLI_TOOLS[session.cliName];
  const info = session.manager.getInfo();

  await ctx.adapter.replyRich(ctx.message, {
    title: "Session Switched",
    description: `Active session: ${targetName}`,
    color: 0x57F287,
    fields: [
      { name: "CLI", value: tool.name, inline: true },
      { name: "Messages", value: String(info.messageCount), inline: true },
    ],
    footer: info.sessionId ? "Previous conversation context preserved." : undefined,
  });
}

async function handleStats(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  const stats = session.manager.getStats();
  const info = session.manager.getInfo();
  const tool = CLI_TOOLS[session.cliName];
  const isActive = name === multiSession.getActiveSessionName();

  await ctx.adapter.replyRich(ctx.message, {
    title: `Stats: ${name}${isActive ? " (active)" : ""}`,
    color: 0xFEE75C,
    fields: [
      { name: "CLI Tool", value: tool.name, inline: true },
      { name: "Messages", value: String(info.messageCount), inline: true },
      { name: "History Entries", value: String(stats.history.length), inline: true },
      { name: "Input Tokens", value: stats.totalInputTokens.toLocaleString(), inline: true },
      { name: "Output Tokens", value: stats.totalOutputTokens.toLocaleString(), inline: true },
      { name: "Total Tokens", value: stats.totalTokens.toLocaleString(), inline: true },
    ],
    footer: "Token counts are estimates (~4 chars = 1 token)",
  });
}

async function handleHistory(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  let name: string;
  let count = 10;

  const arg1 = ctx.args[1];
  const arg2 = ctx.args[2];

  if (arg1 && !isNaN(Number(arg1))) {
    name = multiSession.getActiveSessionName();
    count = parseInt(arg1, 10);
  } else if (arg1) {
    name = arg1;
    if (arg2 && !isNaN(Number(arg2))) {
      count = parseInt(arg2, 10);
    }
  } else {
    name = multiSession.getActiveSessionName();
  }

  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  const history = session.manager.getHistory(count);
  const isActive = name === multiSession.getActiveSessionName();

  if (history.length === 0) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' has no conversation history yet.`);
    return;
  }

  const historyLines = history.map((entry) => {
    const role = entry.role === "user" ? "User" : "AI";
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const tokens = entry.tokens ? ` (${entry.tokens} tok)` : "";
    const content = entry.content.length > 100 ? entry.content.slice(0, 100) + "..." : entry.content;
    return `[${role}] ${time}${tokens}\n${content}`;
  });

  await ctx.adapter.replyRich(ctx.message, {
    title: `History: ${name}${isActive ? " (active)" : ""}`,
    description: historyLines.join("\n\n"),
    color: 0x5865F2,
    footer: `Showing last ${history.length} entries`,
  });
}

async function handleInfo(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    if (!ctx.args[1]) {
      return handleList(ctx);
    }
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  const info = session.manager.getInfo();
  const elapsed = info.startedAt ? Math.floor((Date.now() - info.startedAt) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  let status: string;
  if (info.isBusy) status = "Processing...";
  else if (info.sessionId) status = "Active";
  else status = "New";

  const isActive = name === multiSession.getActiveSessionName();

  const fields = [
    { name: "CLI Tool", value: info.toolName, inline: true },
    { name: "Status", value: status, inline: true },
    { name: "Messages", value: String(info.messageCount), inline: true },
    { name: "Duration", value: info.startedAt ? `${mins}m ${secs}s` : "—", inline: true },
    { name: "Working Directory", value: info.cwd, inline: false },
  ];

  if (info.sessionId) {
    fields.push({
      name: "Session ID",
      value: `${info.sessionId.slice(0, 16)}...`,
      inline: false,
    });
  }

  await ctx.adapter.replyRich(ctx.message, {
    title: `Session: ${name}${isActive ? " (active)" : ""}`,
    color: isActive ? 0x57F287 : 0x5865F2,
    fields,
  });
}

async function handleCwd(ctx: CrossPlatformContext): Promise<void> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) {
    await ctx.adapter.reply(ctx.message, "Session manager not initialized.");
    return;
  }

  const name = ctx.args[1] ?? multiSession.getActiveSessionName();
  const session = multiSession.getSession(name);

  if (!session) {
    await ctx.adapter.reply(ctx.message, `Session '${name}' not found.`);
    return;
  }

  const isActive = name === multiSession.getActiveSessionName();
  const tool = CLI_TOOLS[session.cliName];

  await ctx.adapter.replyRich(ctx.message, {
    title: `Working Directory: ${name}${isActive ? " (active)" : ""}`,
    color: 0x5865F2,
    fields: [
      { name: "CLI", value: tool.name, inline: true },
      { name: "Path", value: session.cwd, inline: false },
    ],
    footer: "To change cwd, create a new session with: !session create <name> <cli> <path>",
  });
}
