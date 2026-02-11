import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  validateWorkingDir,
  normalizePath,
  isPathUnderAllowedRoots,
  isPathBlocked,
  getDefaultAllowedRoot,
} from "../src/utils/pathValidator.js";

describe("pathValidator", () => {
  let testDir: string;
  let subDir: string;

  beforeAll(() => {
    // Create temp test directories
    testDir = path.join(os.tmpdir(), "hypeai-test-" + Date.now());
    subDir = path.join(testDir, "subproject");
    fs.mkdirSync(subDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("normalizePath", () => {
    it("should resolve absolute paths", () => {
      const result = normalizePath("/foo/bar", "/base");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should resolve relative paths against base", () => {
      const result = normalizePath("subdir", testDir);
      expect(result).toBe(path.join(testDir, "subdir"));
    });

    it("should handle quoted paths", () => {
      const result = normalizePath('"some/path"', testDir);
      expect(result).toBe(path.join(testDir, "some/path"));
    });
  });

  describe("isPathUnderAllowedRoots", () => {
    it("should return true if no roots specified", () => {
      expect(isPathUnderAllowedRoots("/any/path", [])).toBe(true);
    });

    it("should return true for path under allowed root", () => {
      expect(isPathUnderAllowedRoots(subDir, [testDir])).toBe(true);
    });

    it("should return false for path outside allowed root", () => {
      const otherDir = path.join(os.tmpdir(), "other-dir");
      expect(isPathUnderAllowedRoots(otherDir, [testDir])).toBe(false);
    });

    it("should handle exact match", () => {
      expect(isPathUnderAllowedRoots(testDir, [testDir])).toBe(true);
    });
  });

  describe("isPathBlocked", () => {
    it("should block system directories on Windows", () => {
      if (process.platform === "win32") {
        expect(isPathBlocked("C:\\Windows")).toBe(true);
        expect(isPathBlocked("C:\\Windows\\System32")).toBe(true);
        expect(isPathBlocked("C:\\Program Files")).toBe(true);
      }
    });

    it("should block system directories on Unix", () => {
      if (process.platform !== "win32") {
        expect(isPathBlocked("/etc")).toBe(true);
        expect(isPathBlocked("/etc/passwd")).toBe(true);
        expect(isPathBlocked("/root")).toBe(true);
      }
    });

    it("should not block regular directories", () => {
      expect(isPathBlocked(testDir)).toBe(false);
    });
  });

  describe("validateWorkingDir", () => {
    it("should validate existing directory", () => {
      const result = validateWorkingDir(testDir, testDir);
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBeTruthy();
    });

    it("should reject non-existent directory", () => {
      const result = validateWorkingDir("/nonexistent/path/12345", testDir);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should reject file instead of directory", () => {
      const filePath = path.join(testDir, "testfile.txt");
      fs.writeFileSync(filePath, "test");

      const result = validateWorkingDir(filePath, testDir);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Not a directory");

      fs.unlinkSync(filePath);
    });

    it("should reject paths outside allowed roots", () => {
      const otherDir = path.join(os.tmpdir(), "other-test-" + Date.now());
      fs.mkdirSync(otherDir, { recursive: true });

      try {
        const result = validateWorkingDir(otherDir, testDir, [testDir]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("not under allowed");
      } finally {
        fs.rmSync(otherDir, { recursive: true, force: true });
      }
    });

    it("should accept subdirectory with allowed root", () => {
      const result = validateWorkingDir(subDir, testDir, [testDir]);
      expect(result.valid).toBe(true);
    });

    it("should handle relative paths", () => {
      const result = validateWorkingDir("subproject", testDir);
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe(subDir);
    });
  });

  describe("getDefaultAllowedRoot", () => {
    it("should return parent directory", () => {
      const result = getDefaultAllowedRoot("/foo/bar/project");
      expect(result).toBe(path.resolve("/foo/bar"));
    });

    it("should handle Windows paths", () => {
      if (process.platform === "win32") {
        const result = getDefaultAllowedRoot("D:\\SubDev\\HypeAI");
        expect(result).toBe("D:\\SubDev");
      }
    });
  });
});
