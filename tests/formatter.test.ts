import { describe, it, expect } from "vitest";

// formatOutput 함수 재구현 (테스트용)
function formatOutput(
  stdout: string,
  stderr: string,
  code: number | null
): string {
  const parts: string[] = [];
  if (stdout.trim()) parts.push(stdout.trim());
  if (stderr.trim()) parts.push(`[stderr]\n${stderr.trim()}`);
  if (code !== null && code !== 0) parts.push(`(exit code: ${code})`);
  return parts.length > 0 ? parts.join("\n") : "(no output)";
}

describe("Formatter Utils", () => {
  describe("formatOutput", () => {
    it("should format stdout only", () => {
      const result = formatOutput("Hello World", "", 0);
      expect(result).toBe("Hello World");
    });

    it("should format stderr with label", () => {
      const result = formatOutput("", "Error occurred", 0);
      expect(result).toBe("[stderr]\nError occurred");
    });

    it("should combine stdout and stderr", () => {
      const result = formatOutput("Output", "Warning", 0);
      expect(result).toBe("Output\n[stderr]\nWarning");
    });

    it("should include exit code when non-zero", () => {
      const result = formatOutput("", "", 1);
      expect(result).toBe("(exit code: 1)");
    });

    it("should include exit code with output", () => {
      const result = formatOutput("Output", "", 1);
      expect(result).toBe("Output\n(exit code: 1)");
    });

    it("should not include exit code when zero", () => {
      const result = formatOutput("Output", "", 0);
      expect(result).toBe("Output");
    });

    it("should not include exit code when null", () => {
      const result = formatOutput("Output", "", null);
      expect(result).toBe("Output");
    });

    it("should return (no output) when empty", () => {
      const result = formatOutput("", "", 0);
      expect(result).toBe("(no output)");
    });

    it("should trim whitespace from stdout and stderr", () => {
      const result = formatOutput("  Hello  ", "  Error  ", 0);
      expect(result).toBe("Hello\n[stderr]\nError");
    });

    it("should handle multiline output", () => {
      const stdout = "Line 1\nLine 2\nLine 3";
      const result = formatOutput(stdout, "", 0);
      expect(result).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should handle full output with all parts", () => {
      const result = formatOutput("stdout", "stderr", 127);
      expect(result).toBe("stdout\n[stderr]\nstderr\n(exit code: 127)");
    });
  });
});
