import { spawn, type ChildProcess } from "node:child_process";
import type { Message } from "discord.js";
import type { ISessionManager, SessionInfo } from "./types.js";
import type { CliTool } from "../types.js";

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

    return new Promise<string>((resolve) => {
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

      proc.stdout?.on("data", (d: Buffer) => chunks.push(d));
      proc.stderr?.on("data", (d: Buffer) => errChunks.push(d));

      proc.on("close", (code) => {
        this.proc = null;

        const stdout = Buffer.concat(chunks).toString("utf-8");
        const stderr = Buffer.concat(errChunks).toString("utf-8");

        console.log(`  [${this.cliName}] exit: code=${code}`);
        if (stderr.trim()) console.error(`  [${this.cliName}] stderr: ${stderr.trim().slice(0, 200)}`);

        if (code !== 0) {
          const err = stderr.trim() || stdout.trim() || "CLI exited with error";
          resolve(`[Error] ${err}`);
          return;
        }

        const [result, newSid] = this.parseOutput(stdout);
        if (newSid) this.sessionId = newSid;

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

  private buildCommand(message: string): string[] {
    const cmd = [this.tool.command, "-p", message, ...this.tool.extraFlags];
    if (this.sessionId && this.tool.resumeFlag) {
      cmd.push(this.tool.resumeFlag, this.sessionId);
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
