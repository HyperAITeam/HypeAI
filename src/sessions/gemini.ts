import { spawn, type ChildProcess } from "node:child_process";
import type { Message, TextChannel } from "discord.js";
import type { ISessionManager, SessionInfo, SessionStats, HistoryEntry } from "./types.js";
import type { CliTool } from "../types.js";
import { handleAskUserQuestion } from "../utils/discordPrompt.js";
import { buildSafeShellCmd } from "../utils/shellEscape.js";
import { sanitizeOutput } from "../utils/sanitizeOutput.js";
import { withRetry } from "../utils/retry.js";
import { RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS } from "../config.js";
import { audit, AuditEvent } from "../utils/auditLog.js";

/**
 * Gemini CLI stream-json event types.
 * @see https://geminicli.com/docs/cli/headless/
 */
interface GeminiStreamEvent {
  type: "init" | "message" | "tool_use" | "tool_result" | "error" | "result";
  session_id?: string;
  model?: string;
  role?: "user" | "assistant";
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  error?: string;
  stats?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

/** 간단한 토큰 추정 (약 4자 = 1토큰) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_HISTORY_ENTRIES = 50;
const MAX_HISTORY_CONTENT_LENGTH = 500;

/**
 * Gemini session using stream-json output format.
 *
 * - Uses `gemini --output-format stream-json` for real-time streaming
 * - Supports session resume via `--resume <session_id>`
 * - Intercepts tool_use events for Discord UI integration
 */
export class GeminiSessionManager implements ISessionManager {
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

  constructor(tool: CliTool, cwd: string) {
    this.tool = tool;
    this.cwd = cwd;
  }

  get isBusy(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  async sendMessage(message: string, discordMessage: Message): Promise<string> {
    this.lastMessage = message;

    try {
      const resultText = await withRetry(
        () => this._executeQuery(message, discordMessage),
        {
          maxRetries: RETRY_MAX_ATTEMPTS,
          baseDelayMs: RETRY_BASE_DELAY_MS,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
        },
        async (attempt, error, delayMs) => {
          audit(AuditEvent.RETRY_ATTEMPTED, discordMessage.author.id, {
            details: { attempt, error: error.message, delayMs },
          });
          const secs = Math.ceil(delayMs / 1000);
          if ("send" in discordMessage.channel) {
            await discordMessage.channel.send(
              `Retry ${attempt}/${RETRY_MAX_ATTEMPTS} in ${secs}s... (${error.message})`,
            ).catch(() => {});
          }
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

      console.log(`  [Gemini] Query complete. Session: ${this.sessionId}`);
      return resultText.trim() || "(no output)";
    } catch (err: any) {
      return `[Error] ${err.message ?? err}`;
    }
  }

  private _executeQuery(message: string, discordMessage: Message): Promise<string> {
    const cmd = this.buildCommand(message);
    const shellCmd = buildSafeShellCmd(cmd);

    console.log(`  [Gemini] Running: ${shellCmd}`);
    console.log(`  [Gemini] cwd: ${this.cwd}`);

    return new Promise<string>((resolve, reject) => {
      const proc = spawn(shellCmd, {
        shell: true,
        cwd: this.cwd,
        windowsHide: true,
      });
      this.proc = proc;

      let resultText = "";
      let newSessionId: string | null = null;
      let lineBuffer = "";

      proc.stdout?.on("data", async (data: Buffer) => {
        lineBuffer += data.toString("utf-8");
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line) as GeminiStreamEvent;
            console.log(`  [Gemini] event: ${event.type}`);

            switch (event.type) {
              case "init":
                if (event.session_id) {
                  newSessionId = event.session_id;
                  console.log(`  [Gemini] session_id: ${newSessionId}`);
                }
                break;

              case "message":
                if (event.role === "assistant" && event.content) {
                  resultText = event.content;
                }
                break;

              case "tool_use":
                if (event.tool_name === "ask_followup" && event.tool_input) {
                  await this.handleToolUse(
                    event.tool_name,
                    event.tool_input,
                    discordMessage,
                  );
                }
                break;

              case "result":
                if (event.content) {
                  resultText = event.content;
                }
                if (event.session_id) {
                  newSessionId = event.session_id;
                }
                break;

              case "error":
                if (event.error) {
                  console.error(`  [Gemini] error: ${event.error}`);
                }
                break;
            }
          } catch (parseErr) {
            console.log(`  [Gemini] non-json line: ${line.slice(0, 100)}`);
          }
        }
      });

      const errChunks: Buffer[] = [];
      proc.stderr?.on("data", (d: Buffer) => {
        errChunks.push(d);
        console.error(`  [Gemini] stderr: ${d.toString()}`);
      });

      proc.on("close", (code) => {
        this.proc = null;

        if (lineBuffer.trim()) {
          try {
            const event = JSON.parse(lineBuffer) as GeminiStreamEvent;
            if (event.type === "result" && event.content) {
              resultText = event.content;
            }
            if (event.session_id) {
              newSessionId = event.session_id;
            }
          } catch {
            // Ignore parse errors for incomplete data
          }
        }

        if (code !== 0 && !resultText) {
          const stderr = Buffer.concat(errChunks).toString("utf-8").trim();
          reject(new Error(sanitizeOutput(stderr) || "Gemini CLI exited with error"));
          return;
        }

        if (newSessionId) {
          this.sessionId = newSessionId;
        }

        resolve(resultText);
      });

      proc.on("error", (err) => {
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
      cliName: "gemini",
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

  // --- Private methods ---

  private buildCommand(message: string): string[] {
    const cmd = [
      this.tool.command,
      "-p",
      message,
      "--output-format",
      "stream-json",
      ...this.tool.extraFlags,
    ];

    // Resume session if we have a session ID
    if (this.sessionId) {
      cmd.push("--resume", this.sessionId);
    }

    return cmd;
  }

  /**
   * Handle Gemini tool_use events that require user interaction.
   * Maps to Discord UI via handleAskUserQuestion.
   */
  private async handleToolUse(
    toolName: string,
    input: Record<string, unknown>,
    discordMessage: Message,
  ): Promise<void> {
    // Gemini's ask_followup tool structure (hypothetical - adjust based on actual format)
    if (toolName === "ask_followup" && input.question) {
      const questions = [
        {
          question: String(input.question),
          header: "Gemini asks",
          options: Array.isArray(input.options)
            ? (input.options as string[]).map((opt) => ({ label: opt }))
            : [{ label: "Yes" }, { label: "No" }],
        },
      ];

      await handleAskUserQuestion(
        { questions },
        discordMessage.channel as TextChannel,
        discordMessage.author.id,
      );
    }
  }
}
