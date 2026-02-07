import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Message, TextChannel } from "discord.js";
import type { ISessionManager, SessionInfo } from "./types.js";
import type { CliTool } from "../types.js";
import { handleAskUserQuestion } from "../utils/discordPrompt.js";

/**
 * Claude session using the Agent SDK.
 *
 * - Uses `query()` async generator for communication
 * - Intercepts AskUserQuestion via `canUseTool` → Discord UI
 * - Maintains session continuity via `resume` option
 */
export class ClaudeSessionManager implements ISessionManager {
  private tool: CliTool;
  private cwd: string;
  private sessionId: string | null = null;
  private messageCount = 0;
  private startedAt = 0;
  private busy = false;
  private abortController: AbortController | null = null;

  constructor(tool: CliTool, cwd: string) {
    this.tool = tool;
    this.cwd = cwd;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  async sendMessage(message: string, discordMessage: Message): Promise<string> {
    this.busy = true;
    this.abortController = new AbortController();

    try {
      const options: Record<string, unknown> = {
        cwd: this.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>,
        ) => {
          if (toolName === "AskUserQuestion") {
            const result = await handleAskUserQuestion(
              input as any,
              discordMessage.channel as TextChannel,
              discordMessage.author.id,
            );
            return { behavior: "allow" as const, updatedInput: result };
          }
          return { behavior: "allow" as const, updatedInput: input };
        },
      };

      if (this.sessionId) {
        options.resume = this.sessionId;
      }

      let resultText = "";
      let newSessionId: string | null = null;

      for await (const msg of query({ prompt: message, options: options as any })) {
        if (msg.type === "system" && (msg as any).subtype === "init") {
          newSessionId = (msg as any).session_id ?? null;
        }
        if (msg.type === "result") {
          const result = msg as any;
          resultText = result.result ?? "";
          if (result.session_id) {
            newSessionId = result.session_id;
          }
        }
      }

      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      this.messageCount++;
      if (this.startedAt === 0) this.startedAt = Date.now();

      return resultText.trim() || "(no output)";
    } catch (err: any) {
      return `[Error] ${err.message ?? err}`;
    } finally {
      this.busy = false;
      this.abortController = null;
    }
  }

  async kill(): Promise<boolean> {
    if (!this.busy || !this.abortController) return false;
    this.abortController.abort();
    this.busy = false;
    this.abortController = null;
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
      cliName: "claude",
      toolName: this.tool.name,
      cwd: this.cwd,
      isBusy: this.busy,
      messageCount: this.messageCount,
      startedAt: this.startedAt,
      sessionId: this.sessionId,
    };
  }

  async cleanup(): Promise<void> {
    await this.kill();
  }
}
