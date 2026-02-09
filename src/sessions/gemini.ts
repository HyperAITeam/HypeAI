import { spawn, type ChildProcess } from "node:child_process";
import type { Message, TextChannel } from "discord.js";
import type { ISessionManager, SessionInfo } from "./types.js";
import type { CliTool } from "../types.js";
import { handleAskUserQuestion } from "../utils/discordPrompt.js";

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

  constructor(tool: CliTool, cwd: string) {
    this.tool = tool;
    this.cwd = cwd;
  }

  get isBusy(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  async sendMessage(message: string, discordMessage: Message): Promise<string> {
    const cmd = this.buildCommand(message);
    const shellCmd = cmd.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");

    console.log(`  [Gemini] Running: ${shellCmd}`);
    console.log(`  [Gemini] cwd: ${this.cwd}`);

    return new Promise<string>((resolve) => {
      const proc = spawn(shellCmd, {
        shell: true,
        cwd: this.cwd,
        windowsHide: true,
      });
      this.proc = proc;

      let resultText = "";
      let newSessionId: string | null = null;
      let lineBuffer = "";

      // Process stream-json output line by line
      proc.stdout?.on("data", async (data: Buffer) => {
        lineBuffer += data.toString("utf-8");
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? ""; // Keep incomplete line in buffer

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
                // Handle interactive tool prompts via Discord UI
                if (event.tool_name === "ask_followup" && event.tool_input) {
                  await this.handleToolUse(
                    event.tool_name,
                    event.tool_input,
                    discordMessage,
                  );
                }
                break;

              case "result":
                // Final result event - may contain the complete response
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
            // Not valid JSON, might be plain text output
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

        // Process any remaining buffered content
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
          resolve(`[Error] ${stderr || "Gemini CLI exited with error"}`);
          return;
        }

        if (newSessionId) {
          this.sessionId = newSessionId;
        }

        this.messageCount++;
        if (this.startedAt === 0) this.startedAt = Date.now();

        console.log(`  [Gemini] Query complete. Session: ${this.sessionId}`);
        resolve(resultText.trim() || "(no output)");
      });

      proc.on("error", (err) => {
        this.proc = null;
        if (err.message.includes("ENOENT")) {
          resolve("[Error] `gemini` is not installed or not in PATH.");
        } else {
          resolve(`[Error] Failed to run gemini: ${err.message}`);
        }
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
    };
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
