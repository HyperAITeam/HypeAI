import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  saveSessionStore,
  loadSessionStore,
  getSessionStorePath,
  type SessionStoreData,
} from "../src/utils/sessionStore.js";

describe("SessionStore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeStoreData(): SessionStoreData {
    return {
      version: 1,
      activeSessionName: "default",
      workingDir: tmpDir,
      savedAt: Date.now(),
      sessions: [
        {
          name: "default",
          cliName: "claude",
          sessionId: "sess-abc123",
          createdAt: 1000,
          lastUsedAt: 2000,
          messageCount: 5,
          startedAt: 1000,
          totalInputTokens: 100,
          totalOutputTokens: 200,
          history: [
            { role: "user", content: "hello", timestamp: 1000, tokens: 1 },
            { role: "assistant", content: "hi", timestamp: 1001, tokens: 1 },
          ],
        },
      ],
    };
  }

  it("should round-trip save/load", () => {
    const storePath = path.join(tmpDir, "test.json");
    const data = makeStoreData();

    saveSessionStore(storePath, data);
    const loaded = loadSessionStore(storePath);

    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.activeSessionName).toBe("default");
    expect(loaded!.sessions.length).toBe(1);
    expect(loaded!.sessions[0].name).toBe("default");
    expect(loaded!.sessions[0].sessionId).toBe("sess-abc123");
    expect(loaded!.sessions[0].messageCount).toBe(5);
    expect(loaded!.sessions[0].history.length).toBe(2);
  });

  it("should return null for nonexistent file", () => {
    const storePath = path.join(tmpDir, "nonexistent.json");
    expect(loadSessionStore(storePath)).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    const storePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(storePath, "{ invalid json", "utf-8");
    expect(loadSessionStore(storePath)).toBeNull();
  });

  it("should return null for wrong version", () => {
    const storePath = path.join(tmpDir, "old.json");
    fs.writeFileSync(storePath, JSON.stringify({ version: 99 }), "utf-8");
    expect(loadSessionStore(storePath)).toBeNull();
  });

  it("should use atomic write (temp file + rename)", () => {
    const storePath = path.join(tmpDir, "atomic.json");
    const data = makeStoreData();

    saveSessionStore(storePath, data);

    // After save, there should be no .tmp file left
    expect(fs.existsSync(storePath + ".tmp")).toBe(false);
    expect(fs.existsSync(storePath)).toBe(true);
  });

  it("getSessionStorePath should return correct path", () => {
    const result = getSessionStorePath("/some/dir");
    expect(result).toContain(".hypeai-sessions.json");
    expect(result).toContain(path.join("/some/dir"));
  });
});
