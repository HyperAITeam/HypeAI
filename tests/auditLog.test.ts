import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AuditLogger, AuditEvent, initAuditLogger, getAuditLogger, audit } from "../src/utils/auditLog.js";

describe("AuditLog", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
  });

  afterEach(async () => {
    const logger = getAuditLogger();
    if (logger) await logger.shutdown();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should write JSONL entries", async () => {
    const logger = new AuditLogger(tmpDir);
    logger.log({
      event: AuditEvent.COMMAND_EXECUTED,
      userId: "123",
      command: "ask",
      success: true,
    });
    await logger.shutdown();

    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.jsonl$/);

    const content = fs.readFileSync(path.join(tmpDir, files[0]), "utf-8").trim();
    const entry = JSON.parse(content);
    expect(entry.event).toBe("COMMAND_EXECUTED");
    expect(entry.userId).toBe("123");
    expect(entry.command).toBe("ask");
    expect(entry.success).toBe(true);
    expect(entry.timestamp).toBeDefined();
  });

  it("should produce valid JSONL with multiple entries", async () => {
    const logger = new AuditLogger(tmpDir);
    logger.log({ event: AuditEvent.COMMAND_EXECUTED, userId: "1", success: true });
    logger.log({ event: AuditEvent.RATE_LIMITED, userId: "2", success: false });
    logger.log({ event: AuditEvent.SESSION_CREATED, userId: "3", sessionName: "work", success: true });
    await logger.shutdown();

    const files = fs.readdirSync(tmpDir);
    const lines = fs.readFileSync(path.join(tmpDir, files[0]), "utf-8").trim().split("\n");
    expect(lines.length).toBe(3);

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("should use date-based filename", async () => {
    const logger = new AuditLogger(tmpDir);
    logger.log({ event: AuditEvent.COMMAND_EXECUTED, userId: "1", success: true });
    await logger.shutdown();

    const today = new Date().toISOString().slice(0, 10);
    const files = fs.readdirSync(tmpDir);
    expect(files[0]).toBe(`audit-${today}.jsonl`);
  });

  it("should create log directory recursively", () => {
    const nestedDir = path.join(tmpDir, "nested", "deep", "logs");
    const logger = new AuditLogger(nestedDir);
    expect(fs.existsSync(nestedDir)).toBe(true);
    logger.shutdown();
  });

  it("audit() should no-op when logger is not initialized", () => {
    // Should not throw
    expect(() => audit(AuditEvent.COMMAND_EXECUTED, "123")).not.toThrow();
  });

  it("audit() should work after initAuditLogger", async () => {
    initAuditLogger(tmpDir);
    audit(AuditEvent.COMMAND_EXECUTED, "456", { command: "test" });
    const logger = getAuditLogger();
    expect(logger).not.toBeNull();
    await logger!.shutdown();

    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
  });
});
