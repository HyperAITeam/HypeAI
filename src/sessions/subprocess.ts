import { spawn, type ChildProcess } from "node:child_process";
import type { ISessionManager, SessionInfo, SessionStats, HistoryEntry } from "./types.js";
import type { CliTool } from "../types.js";
import type { PlatformMessage, PlatformAdapter } from "../platform/types.js";
import { buildSafeShellCmd } from "../utils/shellEscape.js";
import { sanitizeOutput } from "../utils/sanitizeOutput.js";
import { withRetry } from "../utils/retry.js";
import { RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS } from "../config.js";
import { audit, AuditEvent } from "../utils/auditLog.js";

/** ANSI escape code 제거 (터미널 색상/커서 코드 → Discord에선 깨짐) */
function stripAnsi(s: string): string {
  return s.replace(/\x1B(?:\[[0-9;]*[A-Za-z]|\][^\x07]*\x07)/g, "");
}

/** 간단한 토큰 추정 (약 4자 = 1토큰) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_HISTORY_ENTRIES = 50;
const MAX_HISTORY_CONTENT_LENGTH = 500;

/**
 * Subprocess-based session for CLIs without an SDK (Gemini, OpenCode).
 *
 * Runs `cli -p "message"` per request. Session resume is supported only
 * if the tool defines a `resumeFlag` (currently only Claude, which uses
 * the Agent SDK instead).
 */
export class SubprocessSessionManager implements ISessionManager {
  private cliName: string;
  private tool: CliTool;
  private cwd: string;
  private sessionId: string | null = null;
  private messageCount = 0;
  private startedAt = 0;
  private proc: ChildProcess | null = null;

  // 토큰 및 히스토리 추적
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private history: HistoryEntry[] = [];
  private lastMessage: string = "";

  constructor(cliName: string, tool: CliTool, cwd: string) {
    this.cliName = cliName;
    this.tool = tool;
    this.cwd = cwd;
  }

  get isBusy(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  async sendMessage(
    message: string,
    platformMessage: PlatformMessage,
    adapter: PlatformAdapter,
  ): Promise<string> {
    this.lastMessage = message;

    try {
      const resultText = await withRetry(
        () => this._executeQuery(message),
        {
          maxRetries: RETRY_MAX_ATTEMPTS,
          baseDelayMs: RETRY_BASE_DELAY_MS,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
        },
        async (attempt, error, delayMs) => {
          audit(AuditEvent.RETRY_ATTEMPTED, platformMessage.userId, {
            details: { attempt, error: error.message, delayMs },
          });
          const secs = Math.ceil(delayMs / 1000);
          await adapter.reply(
            platformMessage,
            `Retry ${attempt}/${RETRY_MAX_ATTEMPTS} in ${secs}s... (${error.message})`,
          ).catch(() => {});
        },
      );

      this.messageCount++;
      if (this.startedAt === 0) this.startedAt = Date.now();

      const inputTokens = estimateTokens(this.lastMessage);
      const outputTokens = estimateTokens(resultText);
      this.totalInputTokens += inputTokens;
      this.totalOutputTokens += outputTokens;

      this.addHistory("user", this.lastMessage, inputTokens);
      this.addHistory("assistant", resultText, outputTokens);

      return resultText.trim() || "(no output)";
    } catch (err: any) {
      return `[Error] ${err.message ?? err}`;
    }
  }

  private _executeQuery(message: string): Promise<string> {
    const cmd = this.buildCommand(message);
    const shellCmd = buildSafeShellCmd(cmd);

    return new Promise<string>((resolve, reject) => {
      console.log(`  [${this.cliName}] exec: ${shellCmd}`);
      console.log(`  [${this.cliName}] cwd: ${this.cwd}`);
      const proc = spawn(shellCmd, {
        shell: true,
        cwd: this.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.proc = proc;

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout?.on("data", (d: Buffer) => {
        chunks.push(d);
        console.log(`  [${this.cliName}] stdout: ${stripAnsi(d.toString()).trim().slice(0, 150)}`);
      });
      proc.stderr?.on("data", (d: Buffer) => {
        errChunks.push(d);
        console.error(`  [${this.cliName}] stderr: ${stripAnsi(d.toString()).trim().slice(0, 150)}`);
      });

      proc.on("close", (code) => {
        this.proc = null;

        const stdout = stripAnsi(Buffer.concat(chunks).toString("utf-8"));
        const stderr = stripAnsi(Buffer.concat(errChunks).toString("utf-8"));

        console.log(`  [${this.cliName}] exit: code=${code}`);
        if (stderr.trim()) console.error(`  [${this.cliName}] stderr: ${stderr.trim().slice(0, 200)}`);

        if (code !== 0) {
          const err = stderr.trim() || stdout.trim() || "CLI exited with error";
          reject(new Error(sanitizeOutput(err)));
          return;
        }

        const [result, newSid] = this.parseOutput(stdout);
        if (newSid) this.sessionId = newSid;

        resolve(result);
      });

      proc.on("error", (err) => {
        console.error(`  [${this.cliName}] spawn error: ${err.message}`);
        this.proc = null;
        reject(err);
      });
    });
  }

  async kill(): Promise<boolean> {
    if (!this.isBusy || !this.proc) return false;
    this.proc.kill();
    this.proc = null;
    return true;
  }

  async newSession(): Promise<void> {
    await this.kill();
    this.sessionId = null;
    this.messageCount = 0;
    this.startedAt = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.history = [];
  }

  getInfo(): SessionInfo {
    return {
      cliName: this.cliName,
      toolName: this.tool.name,
      cwd: this.cwd,
      isBusy: this.isBusy,
      messageCount: this.messageCount,
      startedAt: this.startedAt,
      sessionId: this.sessionId,
      stats: this.getStats(),
    };
  }

  getStats(): SessionStats {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      history: this.history,
    };
  }

  getHistory(limit?: number): HistoryEntry[] {
    if (limit === undefined) return [...this.history];
    return this.history.slice(-limit);
  }

  private addHistory(role: "user" | "assistant", content: string, tokens: number): void {
    const truncatedContent =
      content.length > MAX_HISTORY_CONTENT_LENGTH
        ? content.slice(0, MAX_HISTORY_CONTENT_LENGTH) + "..."
        : content;

    this.history.push({
      role,
      content: truncatedContent,
      timestamp: Date.now(),
      tokens,
    });

    // 최대 히스토리 개수 제한
    if (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history = this.history.slice(-MAX_HISTORY_ENTRIES);
    }
  }

  getPersistedState(): import("../types.js").PersistedSessionState {
    return {
      sessionId: this.sessionId,
      messageCount: this.messageCount,
      startedAt: this.startedAt,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      history: [...this.history],
    };
  }

  restoreFromState(state: import("../types.js").PersistedSessionState): void {
    this.sessionId = state.sessionId;
    this.messageCount = state.messageCount;
    this.startedAt = state.startedAt;
    this.totalInputTokens = state.totalInputTokens;
    this.totalOutputTokens = state.totalOutputTokens;
    this.history = [...state.history];
  }

  async cleanup(): Promise<void> {
    if (this.isBusy) this.proc?.kill();
    this.proc = null;
  }

  getCwd(): string {
    return this.cwd;
  }

  // --- internals ---

  private buildCommand(message: string): string[] {
    const cmd = [this.tool.command, ...this.tool.promptArgs, message, ...this.tool.extraFlags];
    if (this.sessionId && this.tool.resumeFlag) {
      cmd.push(this.tool.resumeFlag, this.sessionId);
    }
    // 두 번째 메시지부터 이전 세션 이어가기 (e.g. opencode -c)
    if (this.messageCount > 0 && this.tool.continueFlag) {
      cmd.push(this.tool.continueFlag);
    }
    return cmd;
  }

  private parseOutput(raw: string): [string, string | null] {
    if (!this.tool.jsonOutput) return [raw.trim(), null];
    try {
      const data = JSON.parse(raw);
      return [data.result ?? raw, data.session_id ?? null];
    } catch {
      return [raw.trim(), null];
    }
  }
}
