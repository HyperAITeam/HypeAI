import { spawn } from "node:child_process";
import { sanitizeOutput } from "./sanitizeOutput.js";

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run a shell command asynchronously with timeout.
 * Returns { code, stdout, stderr }.
 */
export function runCommand(
  command: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<RunResult> {
  const { timeout = 30_000, cwd } = options;

  return new Promise((resolve) => {
    const proc = spawn(command, {
      shell: true,
      cwd,
      windowsHide: true,
    });

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr.on("data", (d: Buffer) => errChunks.push(d));

    const timer = setTimeout(() => {
      proc.kill();
      resolve({
        code: null,
        stdout: "",
        stderr: `Command timed out after ${timeout / 1000}s`,
      });
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(chunks).toString("utf-8"),
        stderr: Buffer.concat(errChunks).toString("utf-8"),
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        code: null,
        stdout: "",
        stderr: `Failed to execute: ${sanitizeOutput(err.message)}`,
      });
    });
  });
}
