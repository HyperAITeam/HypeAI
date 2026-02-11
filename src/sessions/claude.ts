import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import type { Message, TextChannel } from "discord.js";
import type { ISessionManager, SessionInfo, SessionStats, HistoryEntry } from "./types.js";
import type { CliTool } from "../types.js";
import { handleAskUserQuestion } from "../utils/discordPrompt.js";
import { resolveNodeExecutable } from "../utils/nodeRuntime.js";

/**
 * Bun exe 환경에서 Agent SDK의 cli.js 경로를 자동 해석.
 * Bun 번들 실행 시 import.meta.url이 가상 경로(~BUN)를 반환하므로
 * exe와 같은 폴더에 배포된 cli.js를 직접 지정해야 한다.
 */
function resolveClaudeCodePath(): string | undefined {
  // exe 옆에 cli.js가 있으면 해당 경로 사용 (빌드 배포 환경)
  const exeDir = path.dirname(process.execPath);
  const candidate = path.join(exeDir, "cli.js");
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  // node_modules 내 SDK 패키지에서 직접 탐색 (개발 환경 폴백)
  const nmCandidate = path.join(
    process.cwd(),
    "node_modules",
    "@anthropic-ai",
    "claude-agent-sdk",
    "cli.js",
  );
  if (fs.existsSync(nmCandidate)) {
    return nmCandidate;
  }
  // 둘 다 없으면 SDK 기본 자동 해석에 맡김
  return undefined;
}

/**
 * Claude session using the Agent SDK.
 *
 * - Uses `query()` async generator for communication
 * - Intercepts AskUserQuestion via `canUseTool` → Discord UI
 * - Maintains session continuity via `resume` option
 */
/** 간단한 토큰 추정 (약 4자 = 1토큰) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_HISTORY_ENTRIES = 50;
const MAX_HISTORY_CONTENT_LENGTH = 500;

export class ClaudeSessionManager implements ISessionManager {
  private tool: CliTool;
  private cwd: string;
  private sessionId: string | null = null;
  private messageCount = 0;
  private startedAt = 0;
  private busy = false;
  private abortController: AbortController | null = null;

  // 토큰 및 히스토리 추적
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private history: HistoryEntry[] = [];

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
      const cliPath = resolveClaudeCodePath();
      const nodePath = await resolveNodeExecutable();
      console.log(`  [Claude] cliPath: ${cliPath ?? "(SDK default)"}`);
      console.log(`  [Claude] nodePath: ${nodePath}`);
      console.log(`  [Claude] cwd: ${this.cwd}`);

      const options: Record<string, unknown> = {
        cwd: this.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        abortController: this.abortController,
        executable: nodePath,
        ...(cliPath && { pathToClaudeCodeExecutable: cliPath }),
        stderr: (data: string) => console.error("[Claude stderr]", data),
        // pkg exe 환경에서 signal 옵션이 제대로 전달되지 않을 수 있으므로
        // 직접 spawn해서 abort는 수동으로 처리한다.
        spawnClaudeCodeProcess: (spawnOpts: {
          command: string;
          args: string[];
          cwd?: string;
          env: Record<string, string | undefined>;
          signal: AbortSignal;
        }) => {
          console.log(`  [Claude] spawn: ${spawnOpts.command} ${spawnOpts.args[0] ?? ""}`);
          const proc = spawn(spawnOpts.command, spawnOpts.args, {
            cwd: spawnOpts.cwd,
            env: spawnOpts.env as NodeJS.ProcessEnv,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          });
          proc.on("error", (err) => console.error("  [Claude] spawn error:", err.message));
          proc.on("exit", (code, sig) => console.log(`  [Claude] exit: code=${code} signal=${sig}`));
          proc.stderr?.on("data", (d: Buffer) => console.error("  [Claude] stderr:", d.toString()));

          // signal → 수동 kill
          const onAbort = () => { try { proc.kill(); } catch {} };
          spawnOpts.signal.addEventListener("abort", onAbort, { once: true });
          proc.on("exit", () => spawnOpts.signal.removeEventListener("abort", onAbort));

          return proc;
        },
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

      console.log("  [Claude] Starting query...");
      const conversation = query({ prompt: message, options: options as any });
      try {
        for await (const msg of conversation) {
          console.log(`  [Claude] msg: ${msg.type}${(msg as any).subtype ? "/" + (msg as any).subtype : ""}`);
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
      } catch (queryErr: any) {
        console.error("  [Claude] Query error:", queryErr.message ?? queryErr);
        // 이미 부분 결과가 있으면 반환, 없으면 에러 전파
        if (resultText.trim()) {
          console.log("  [Claude] Returning partial result despite error.");
        } else {
          throw queryErr;
        }
      }
      console.log("  [Claude] Query complete.");

      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      this.messageCount++;
      if (this.startedAt === 0) this.startedAt = Date.now();

      // 토큰 추정 및 히스토리 기록
      const inputTokens = estimateTokens(message);
      const outputTokens = estimateTokens(resultText);
      this.totalInputTokens += inputTokens;
      this.totalOutputTokens += outputTokens;

      this.addHistory("user", message, inputTokens);
      this.addHistory("assistant", resultText, outputTokens);

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
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.history = [];
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

  async cleanup(): Promise<void> {
    await this.kill();
  }
}
