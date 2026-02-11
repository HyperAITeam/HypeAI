import fs from "node:fs";
import path from "node:path";

export enum AuditEvent {
  COMMAND_EXECUTED = "COMMAND_EXECUTED",
  COMMAND_DENIED = "COMMAND_DENIED",
  COMMAND_BLOCKED = "COMMAND_BLOCKED",
  COMMAND_ERROR = "COMMAND_ERROR",
  INJECTION_WARNING = "INJECTION_WARNING",
  SESSION_CREATED = "SESSION_CREATED",
  SESSION_DELETED = "SESSION_DELETED",
  SESSION_RESET = "SESSION_RESET",
  SESSION_SWITCHED = "SESSION_SWITCHED",
  SESSION_PERSISTED = "SESSION_PERSISTED",
  SESSION_RESTORED = "SESSION_RESTORED",
  RATE_LIMITED = "RATE_LIMITED",
  RETRY_ATTEMPTED = "RETRY_ATTEMPTED",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
}

export interface AuditEntry {
  timestamp: string;
  event: AuditEvent;
  userId: string;
  command?: string;
  sessionName?: string;
  details?: Record<string, unknown>;
  success: boolean;
}

export class AuditLogger {
  private logDir: string;
  private stream: fs.WriteStream | null = null;
  private currentDate: string = "";

  constructor(logDir: string) {
    this.logDir = logDir;
    fs.mkdirSync(logDir, { recursive: true });
  }

  log(entry: Omit<AuditEntry, "timestamp">): void {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Rotate on date change
    if (dateStr !== this.currentDate) {
      this.rotateStream(dateStr);
    }

    const fullEntry: AuditEntry = {
      timestamp: now.toISOString(),
      ...entry,
    };

    try {
      this.stream?.write(JSON.stringify(fullEntry) + "\n");
    } catch {
      // Silent fail — audit logging should never crash the bot
    }
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.stream) {
        this.stream.end(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private rotateStream(dateStr: string): void {
    if (this.stream) {
      this.stream.end();
    }
    const filePath = path.join(this.logDir, `audit-${dateStr}.jsonl`);
    this.stream = fs.createWriteStream(filePath, { flags: "a" });
    this.currentDate = dateStr;
  }
}

// Singleton
let auditLogger: AuditLogger | null = null;

export function initAuditLogger(logDir: string): void {
  auditLogger = new AuditLogger(logDir);
}

export function getAuditLogger(): AuditLogger | null {
  return auditLogger;
}

/** Convenience helper — silent no-op if logger not initialized */
export function audit(
  event: AuditEvent,
  userId: string,
  details?: Partial<Pick<AuditEntry, "command" | "sessionName" | "details" | "success">>,
): void {
  if (!auditLogger) return;
  auditLogger.log({
    event,
    userId,
    command: details?.command,
    sessionName: details?.sessionName,
    details: details?.details,
    success: details?.success ?? true,
  });
}
