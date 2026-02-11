import { describe, it, expect } from "vitest";
import {
  filterSensitiveFiles,
  filterSensitiveDiff,
  type DiffFile,
} from "../src/utils/gitDiff.js";

describe("gitDiff", () => {
  describe("filterSensitiveFiles", () => {
    it("should filter out .env files", () => {
      const files: DiffFile[] = [
        { path: "src/config.ts", status: "modified", additions: 5, deletions: 2 },
        { path: ".env", status: "modified", additions: 1, deletions: 0 },
        { path: ".env.local", status: "added", additions: 3, deletions: 0 },
      ];

      const filtered = filterSensitiveFiles(files);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].path).toBe("src/config.ts");
    });

    it("should filter out credential files", () => {
      const files: DiffFile[] = [
        { path: "src/app.ts", status: "modified", additions: 10, deletions: 5 },
        { path: "credentials.json", status: "added", additions: 20, deletions: 0 },
        { path: "secret.key", status: "modified", additions: 1, deletions: 1 },
      ];

      const filtered = filterSensitiveFiles(files);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].path).toBe("src/app.ts");
    });

    it("should keep regular files", () => {
      const files: DiffFile[] = [
        { path: "src/utils/helper.ts", status: "modified", additions: 3, deletions: 1 },
        { path: "README.md", status: "modified", additions: 10, deletions: 5 },
        { path: "package.json", status: "modified", additions: 2, deletions: 1 },
      ];

      const filtered = filterSensitiveFiles(files);
      expect(filtered).toHaveLength(3);
    });
  });

  describe("filterSensitiveDiff", () => {
    it("should redact .env file content", () => {
      const rawDiff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,5 @@
+// new config
 export const config = {};
diff --git a/.env b/.env
--- a/.env
+++ b/.env
@@ -1,2 +1,3 @@
+SECRET_KEY=abc123
 TOKEN=xyz`;

      const filtered = filterSensitiveDiff(rawDiff);
      expect(filtered).toContain("src/config.ts");
      expect(filtered).toContain("[REDACTED: Sensitive file content hidden]");
      expect(filtered).not.toContain("SECRET_KEY");
      expect(filtered).not.toContain("abc123");
    });

    it("should keep non-sensitive file content", () => {
      const rawDiff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,5 @@
+// new feature
 console.log("hello");`;

      const filtered = filterSensitiveDiff(rawDiff);
      expect(filtered).toContain("new feature");
      expect(filtered).toContain('console.log("hello")');
    });
  });
});
