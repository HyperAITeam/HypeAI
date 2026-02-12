import { spawn } from "node:child_process";

export interface DiffFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

export interface DiffResult {
  files: DiffFile[];
  totalAdded: number;
  totalRemoved: number;
  raw: string;
  isGitRepo: boolean;
}

export interface DiffOptions {
  staged?: boolean;
  file?: string;
  commit?: string; // e.g., "HEAD~1"
}

/**
 * Execute a git command and return stdout
 */
async function execGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `git exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepository(cwd: string): Promise<boolean> {
  try {
    await execGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git diff with statistics
 */
export async function getGitDiff(cwd: string, options: DiffOptions = {}): Promise<DiffResult> {
  const isRepo = await isGitRepository(cwd);
  if (!isRepo) {
    return {
      files: [],
      totalAdded: 0,
      totalRemoved: 0,
      raw: "",
      isGitRepo: false,
    };
  }

  // Build diff command arguments
  const diffArgs = ["diff"];

  if (options.staged) {
    diffArgs.push("--cached");
  }

  if (options.commit) {
    diffArgs.push(options.commit);
  }

  if (options.file) {
    diffArgs.push("--", options.file);
  }

  // Get raw diff
  let raw: string;
  try {
    raw = await execGit(diffArgs, cwd);
  } catch {
    raw = "";
  }

  // Get diff statistics
  const statArgs = [...diffArgs, "--stat", "--stat-width=1000"];
  let statOutput: string;
  try {
    statOutput = await execGit(statArgs, cwd);
  } catch {
    statOutput = "";
  }

  // Parse file statistics
  const files = parseStatOutput(statOutput);

  // Include untracked files (only for default diff — no --staged, no commit, no specific file)
  if (!options.staged && !options.commit && !options.file) {
    try {
      const untrackedOutput = await execGit(
        ["ls-files", "--others", "--exclude-standard"],
        cwd,
      );
      const untrackedFiles = untrackedOutput.split("\n").filter(Boolean);

      for (const filePath of untrackedFiles) {
        // Generate diff for untracked file
        let fileDiff = "";
        try {
          fileDiff = await execGit(
            ["diff", "--no-index", "--", "/dev/null", filePath],
            cwd,
          );
        } catch (err: any) {
          // git diff --no-index exits with code 1 when there are differences (expected)
          if (err.message && !err.message.includes("exited with code")) {
            continue;
          }
          // The diff content is in the error message or we need to capture stdout
          // Actually, execGit rejects on non-zero exit, but the stdout is lost.
          // Use a different approach: read the file and build diff manually.
          fileDiff = await buildUntrackedFileDiff(filePath, cwd);
        }

        if (fileDiff) {
          raw += (raw ? "\n" : "") + fileDiff;

          // Count lines for stats
          const lineCount = fileDiff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
          files.push({
            path: filePath,
            status: "added",
            additions: lineCount,
            deletions: 0,
          });
        }
      }
    } catch {
      // Silently ignore untracked file errors
    }
  }

  // Calculate totals
  const totalAdded = files.reduce((sum, f) => sum + f.additions, 0);
  const totalRemoved = files.reduce((sum, f) => sum + f.deletions, 0);

  return {
    files,
    totalAdded,
    totalRemoved,
    raw,
    isGitRepo: true,
  };
}

/**
 * Build a unified diff string for an untracked (new) file
 */
async function buildUntrackedFileDiff(filePath: string, cwd: string): Promise<string> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const fullPath = path.join(cwd, filePath);

  try {
    const stat = await fs.stat(fullPath);
    // Skip binary / very large files
    if (stat.size > 100_000) {
      return `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1 @@\n+[File too large to display (${Math.round(stat.size / 1024)}KB)]`;
    }

    const content = await fs.readFile(fullPath, "utf-8");
    const lines = content.split("\n");
    const plusLines = lines.map((l) => `+${l}`).join("\n");

    return `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${plusLines}`;
  } catch {
    return "";
  }
}

/**
 * Get diff for unstaged changes + untracked files summary
 */
export async function getWorkingTreeStatus(cwd: string): Promise<{
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}> {
  const isRepo = await isGitRepository(cwd);
  if (!isRepo) {
    return { modified: [], added: [], deleted: [], untracked: [] };
  }

  try {
    const status = await execGit(["status", "--porcelain"], cwd);
    const lines = status.split("\n").filter(Boolean);

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const code = line.slice(0, 2);
      const file = line.slice(3);

      if (code === "??") {
        untracked.push(file);
      } else if (code.includes("M")) {
        modified.push(file);
      } else if (code.includes("A")) {
        added.push(file);
      } else if (code.includes("D")) {
        deleted.push(file);
      }
    }

    return { modified, added, deleted, untracked };
  } catch {
    return { modified: [], added: [], deleted: [], untracked: [] };
  }
}

/**
 * Parse git diff --stat output
 */
function parseStatOutput(output: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Match lines like: " src/file.ts | 10 ++++----"
    const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+-]*)/);
    if (match) {
      const [, path, , changes] = match;
      const additions = (changes.match(/\+/g) || []).length;
      const deletions = (changes.match(/-/g) || []).length;

      let status: DiffFile["status"] = "modified";
      if (line.includes("(new)") || additions > 0 && deletions === 0) {
        status = "added";
      } else if (line.includes("(gone)") || deletions > 0 && additions === 0) {
        status = "deleted";
      }

      files.push({
        path: path.trim(),
        status,
        additions,
        deletions,
      });
    }
  }

  return files;
}

/**
 * Filter out sensitive files from diff
 */
const SENSITIVE_PATTERNS = [
  /\.env$/,
  /\.env\./,
  /credentials/i,
  /secret/i,
  /password/i,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
];

export function filterSensitiveFiles(files: DiffFile[]): DiffFile[] {
  return files.filter((f) =>
    !SENSITIVE_PATTERNS.some((p) => p.test(f.path))
  );
}

/**
 * Filter sensitive content from raw diff
 */
export function filterSensitiveDiff(raw: string): string {
  const lines = raw.split("\n");
  const filtered: string[] = [];
  let skipFile = false;

  for (const line of lines) {
    // Check for new file header
    if (line.startsWith("diff --git")) {
      const filePath = line.split(" b/")[1] || "";
      skipFile = SENSITIVE_PATTERNS.some((p) => p.test(filePath));
      if (skipFile) {
        filtered.push(`${line}\n[REDACTED: Sensitive file content hidden]`);
        continue;
      }
    }

    if (!skipFile) {
      filtered.push(line);
    }
  }

  return filtered.join("\n");
}

/**
 * Split raw diff into pages that fit within Discord's message limit.
 * Tries to split on file boundaries first, then on hunk boundaries.
 * @param rawDiff - The raw diff string
 * @param maxCharsPerPage - Maximum characters per page (default 1800, leaving room for code block markers)
 */
export function splitDiffIntoPages(rawDiff: string, maxCharsPerPage: number = 1800): string[] {
  if (rawDiff.length <= maxCharsPerPage) {
    return [rawDiff];
  }

  const pages: string[] = [];
  // Split on file boundaries first
  const fileSections = rawDiff.split(/(?=^diff --git )/m);

  let currentPage = "";

  for (const section of fileSections) {
    if (!section.trim()) continue;

    if (currentPage.length + section.length <= maxCharsPerPage) {
      currentPage += section;
    } else {
      // Current section doesn't fit in current page
      if (currentPage.trim()) {
        pages.push(currentPage.trim());
      }

      if (section.length <= maxCharsPerPage) {
        currentPage = section;
      } else {
        // Section itself is too large — split by lines
        const lines = section.split("\n");
        currentPage = "";
        for (const line of lines) {
          if (currentPage.length + line.length + 1 > maxCharsPerPage) {
            if (currentPage.trim()) {
              pages.push(currentPage.trim());
            }
            currentPage = line + "\n";
          } else {
            currentPage += line + "\n";
          }
        }
      }
    }
  }

  if (currentPage.trim()) {
    pages.push(currentPage.trim());
  }

  return pages.length > 0 ? pages : [rawDiff.slice(0, maxCharsPerPage)];
}

/**
 * Split raw diff into per-file sections.
 * Each entry maps a file path to its diff content (including the header).
 */
export function splitDiffByFile(rawDiff: string): Map<string, string> {
  const result = new Map<string, string>();
  const fileSections = rawDiff.split(/(?=^diff --git )/m);

  for (const section of fileSections) {
    if (!section.trim()) continue;

    // Extract file path from "diff --git a/path b/path"
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)/m);
    if (headerMatch) {
      const filePath = headerMatch[2];
      result.set(filePath, section.trim());
    }
  }

  return result;
}
