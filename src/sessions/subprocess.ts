import { spawn, type ChildProcess } from "node:child_process";
import type { Message } from "discord.js";
import type { ISessionManager, SessionInfo } from "./types.js";
import type { CliTool } from "../types.js";

/** ANSI escape code 제거 (터미널 색상/커서 코드 → Discord에선 깨짐) */
function stripAnsi(s: string): string {
  return s.replace(/\x1B(?:\[[0-9;]*[A-Za-z]|\][^\x07]*\x07)/g, "");
}

/**
 * Subprocess-based session for CLIs without an SDK (Gemini, OpenCode).
 *
 * Runs `cli -p "message"` per request. Session resume is supported only
 * if the tool defines a `resumeFlag` (currently only Claude, which uses
 * the Agent SDK instead).
 */
/** 대화 히스토리 최대 길이 (characters) — 프롬프트에 주입할 때 */
const MAX_HISTORY_CHARS = 4000;

export class SubprocessSessionManager implements ISessionManager {
  private cliName: string;
  private tool: CliTool;
  private cwd: string;
  private sessionId: string | null = null;
  private messageCount = 0;
  private startedAt = 0;
  private proc: ChildProcess | null = null;
  /** continueFlag가 없는 도구용 대화 히스토리 (Gemini 등) */
  private history: Array<{ role: "user" | "assistant"; content: string }> = [];

  constructor(cliName: string, tool: CliTool, cwd: string) {
    this.cliName = cliName;
    this.tool = tool;
    this.cwd = cwd;
  }

  get isBusy(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  async sendMessage(message: string, _discordMessage: Message): Promise<string> {
    const cmd = this.buildCommand(message);
    const shellCmd = cmd.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
    const useStdinHistory = !this.tool.continueFlag && this.history.length > 0;

    return new Promise<string>((resolve) => {
      console.log(`  [${this.cliName}] exec: ${shellCmd}`);
      console.log(`  [${this.cliName}] cwd: ${this.cwd}`);
      if (useStdinHistory) console.log(`  [${this.cliName}] piping ${this.history.length} history entries via stdin`);
      const proc = spawn(shellCmd, {
        shell: true,
        cwd: this.cwd,
        stdio: [useStdinHistory ? "pipe" : "ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      // stdin으로 대화 히스토리 전달 (Gemini 등 continueFlag 없는 도구)
      if (useStdinHistory && proc.stdin) {
        const stdinText = this.buildStdinHistory();
        proc.stdin.write(stdinText);
        proc.stdin.end();
      }
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
          resolve(`[Error] ${err}`);
          return;
        }

        const [result, newSid] = this.parseOutput(stdout);
        if (newSid) this.sessionId = newSid;

        // continueFlag가 없는 도구는 히스토리로 세션 유지
        if (!this.tool.continueFlag) {
          this.history.push({ role: "user", content: message });
          this.history.push({ role: "assistant", content: result.trim().slice(0, 1000) });
        }

        this.messageCount++;
        if (this.startedAt === 0) this.startedAt = Date.now();

        resolve(result.trim() || "(no output)");
      });

      proc.on("error", (err) => {
        console.error(`  [${this.cliName}] spawn error: ${err.message}`);
        this.proc = null;
        if (err.message.includes("ENOENT")) {
          resolve(`[Error] \`${this.cliName}\` is not installed or not in PATH.`);
        } else {
          resolve(`[Error] Failed to run \`${this.cliName}\`: ${err.message}`);
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
    };
  }

  async cleanup(): Promise<void> {
    if (this.isBusy) this.proc?.kill();
    this.proc = null;
  }

  // --- internals ---

  /**
   * stdin으로 보낼 대화 히스토리 문자열 생성 (Gemini 등 continueFlag 없는 도구).
   * Gemini CLI는 `-p` 플래그와 함께 stdin 입력을 앞에 붙여주므로,
   * 대화 히스토리를 stdin으로 보내면 셸 이스케이프 문제 없이 세션이 유지된다.
   */
  private buildStdinHistory(): string {
    const lines: string[] = [];
    let len = 0;
    for (let i = this.history.length - 1; i >= 0; i -= 2) {
      const a = this.history[i];     // assistant
      const u = this.history[i - 1]; // user
      if (!u || !a) break;
      const pair = `User: ${u.content}\nAssistant: ${a.content}`;
      if (len + pair.length > MAX_HISTORY_CHARS) break;
      lines.unshift(pair);
      len += pair.length;
    }
    return lines.join("\n\n") + "\n";
  }

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
