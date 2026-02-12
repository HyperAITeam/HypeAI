import http from "node:http";
import crypto from "node:crypto";
import { messagingApi } from "@line/bot-sdk";
import {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  LINE_WEBHOOK_PORT,
  COMMAND_PREFIX,
} from "./config.js";
import { LineAdapter } from "./platform/lineAdapter.js";
import type { PlatformMessage } from "./platform/types.js";
import type { CrossPlatformContext } from "./platform/context.js";
import { executeAsk } from "./commands/cross/askCross.js";
import { executeSession } from "./commands/cross/sessionCross.js";
import { executeExec } from "./commands/cross/execCross.js";
import { executeStatus } from "./commands/cross/statusCross.js";
import { executeHelp } from "./commands/cross/helpCross.js";
import { audit, AuditEvent } from "./utils/auditLog.js";
import { getRateLimiter } from "./utils/rateLimiter.js";

interface LineTextEvent {
  type: "message";
  replyToken: string;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message: {
    type: string;
    id: string;
    text?: string;
  };
}

/** Command routing table (name → handler) */
const COMMAND_MAP: Record<string, (ctx: CrossPlatformContext) => Promise<void>> = {
  ask: executeAsk,
  a: executeAsk,
  session: executeSession,
  s: executeSession,
  exec: executeExec,
  run: executeExec,
  cmd: executeExec,
  status: executeStatus,
  sysinfo: executeStatus,
  help: executeHelp,
};

export class LineBotServer {
  private selectedCli: string;
  private workingDir: string;
  private server: http.Server | null = null;
  private lineClient: messagingApi.MessagingApiClient;
  private adapter: LineAdapter;

  constructor(selectedCli: string, workingDir: string) {
    this.selectedCli = selectedCli;
    this.workingDir = workingDir;
    this.lineClient = new messagingApi.MessagingApiClient({
      channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
    });
    this.adapter = new LineAdapter(this.lineClient);
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve) => {
      this.server!.listen(LINE_WEBHOOK_PORT, () => {
        console.log(`  [LINE] Webhook server listening on port ${LINE_WEBHOOK_PORT}`);
        resolve();
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log("  [LINE] Webhook server stopped");
    }
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Only accept POST /webhook
    if (req.method !== "POST" || (req.url !== "/webhook" && req.url !== "/")) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const signature = req.headers["x-line-signature"] as string | undefined;

      if (!signature || !this.validateSignature(body, signature)) {
        console.warn("  [LINE] Invalid signature — rejecting request");
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      // Respond 200 immediately (LINE requires quick response)
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));

      // Process events asynchronously
      try {
        const payload = JSON.parse(body.toString("utf-8"));
        if (payload.events && Array.isArray(payload.events)) {
          for (const event of payload.events) {
            this.processEvent(event).catch((err) => {
              console.error("  [LINE] Event processing error:", err);
            });
          }
        }
      } catch (err) {
        console.error("  [LINE] Failed to parse webhook body:", err);
      }
    });
  }

  private validateSignature(body: Buffer, signature: string): boolean {
    const hmac = crypto.createHmac("SHA256", LINE_CHANNEL_SECRET);
    hmac.update(body);
    const expected = hmac.digest("base64");
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf-8"),
      Buffer.from(signature, "utf-8"),
    );
  }

  private async processEvent(event: LineTextEvent): Promise<void> {
    // Only handle text messages
    if (event.type !== "message" || event.message.type !== "text") return;

    const text = event.message.text ?? "";
    const userId = event.source.userId;
    if (!userId) return;

    // Check if this is a pending response (for askQuestion)
    if (this.adapter.handlePendingResponse(userId, text)) {
      return;
    }

    // Only process command-prefixed messages
    if (!text.startsWith(COMMAND_PREFIX)) return;

    const args = text.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    if (!cmdName) return;

    // Determine the channelId (userId for 1:1, groupId/roomId for groups)
    const channelId = event.source.groupId ?? event.source.roomId ?? userId;

    // Build platform message
    const platformMsg: PlatformMessage = {
      platform: "line",
      userId,
      displayName: userId, // LINE doesn't provide display name in webhook
      channelId,
      content: text,
      raw: event,
    };

    // Authorization check
    if (!this.adapter.isAuthorized(userId)) {
      // Use replyToken for unauthorized response (quick, saves push quota)
      await this.adapter.replyWithToken(event.replyToken, "You are not authorized to use this bot.");
      return;
    }

    // Rate limiting
    const rateLimiter = getRateLimiter();
    if (rateLimiter) {
      const { allowed, retryAfterMs } = rateLimiter.tryConsume(userId);
      if (!allowed) {
        const secs = Math.ceil(retryAfterMs / 1000);
        audit(AuditEvent.RATE_LIMITED, userId, {
          command: cmdName,
          success: false,
        });
        await this.adapter.replyWithToken(
          event.replyToken,
          `Rate limited. Try again in ${secs}s.`,
        );
        return;
      }
    }

    // Use replyToken for immediate "processing..." acknowledgment
    await this.adapter.replyWithToken(
      event.replyToken,
      `\u{23F3} Processing ${COMMAND_PREFIX}${cmdName}...`,
    ).catch(() => {});

    // Audit
    audit(AuditEvent.COMMAND_EXECUTED, userId, { command: cmdName });

    // Route to command handler
    await this.routeCommand(cmdName, {
      message: platformMsg,
      args,
      adapter: this.adapter,
      selectedCli: this.selectedCli,
      workingDir: this.workingDir,
    });
  }

  private async routeCommand(
    cmdName: string,
    ctx: CrossPlatformContext,
  ): Promise<void> {
    const handler = COMMAND_MAP[cmdName];
    if (!handler) {
      await this.adapter.reply(
        ctx.message,
        `Unknown command: ${COMMAND_PREFIX}${cmdName}\nUse ${COMMAND_PREFIX}help to see available commands.`,
      );
      return;
    }

    try {
      await handler(ctx);
    } catch (err: any) {
      console.error("  [LINE] Command %s error:", cmdName, err);
      audit(AuditEvent.COMMAND_ERROR, ctx.message.userId, {
        command: cmdName,
        success: false,
        details: { error: String(err.message ?? err) },
      });
      await this.adapter.reply(
        ctx.message,
        `An error occurred: ${String(err.message ?? err).slice(0, 200)}`,
      ).catch(() => {});
    }
  }
}
