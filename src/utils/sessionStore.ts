import fs from "node:fs";
import path from "node:path";
import type { HistoryEntry } from "../types.js";

export interface PersistedSession {
  name: string;
  cliName: string;
  cwd: string; // Session-specific working directory
  sessionId: string | null;
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
  startedAt: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  history: HistoryEntry[];
}

export interface SessionStoreData {
  version: 1;
  activeSessionName: string;
  workingDir: string;
  sessions: PersistedSession[];
  savedAt: number;
}

const STORE_FILENAME = ".hypeai-sessions.json";

export function getSessionStorePath(workingDir: string): string {
  return path.join(workingDir, STORE_FILENAME);
}

export function saveSessionStore(storePath: string, data: SessionStoreData): void {
  const tmpPath = storePath + ".tmp";
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, storePath);
  } catch {
    // Clean up tmp file on failure
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

export function loadSessionStore(storePath: string): SessionStoreData | null {
  try {
    if (!fs.existsSync(storePath)) return null;
    const raw = fs.readFileSync(storePath, "utf-8");
    const data = JSON.parse(raw) as SessionStoreData;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}
