import fs from "node:fs";
import path from "node:path";

/**
 * Path validation utility for secure working directory management.
 * Prevents path traversal attacks and access to sensitive system directories.
 */

export interface PathValidationResult {
  valid: boolean;
  normalizedPath: string;
  error?: string;
}

/**
 * System directories that should never be used as working directories.
 * These are blocked regardless of other settings.
 */
const BLOCKED_PATHS_WINDOWS = [
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\ProgramData",
  "C:\\Users\\Default",
  "C:\\Recovery",
  "C:\\$Recycle.Bin",
];

const BLOCKED_PATHS_UNIX = [
  "/etc",
  "/root",
  "/var",
  "/usr",
  "/bin",
  "/sbin",
  "/boot",
  "/dev",
  "/proc",
  "/sys",
  "/lib",
  "/lib64",
];

/**
 * Get blocked paths for the current platform.
 */
function getBlockedPaths(): string[] {
  return process.platform === "win32" ? BLOCKED_PATHS_WINDOWS : BLOCKED_PATHS_UNIX;
}

/**
 * Normalize a path, resolving relative paths against a base path.
 * @param inputPath - The path to normalize (can be relative or absolute)
 * @param basePath - The base path for resolving relative paths
 * @returns Normalized absolute path
 */
export function normalizePath(inputPath: string, basePath: string): string {
  // Remove quotes if present
  const cleaned = inputPath.replace(/^["']|["']$/g, "").trim();

  // Resolve to absolute path
  const resolved = path.isAbsolute(cleaned)
    ? path.resolve(cleaned)
    : path.resolve(basePath, cleaned);

  return resolved;
}

/**
 * Check if a path is under one of the allowed root directories.
 * @param targetPath - The path to check (should be normalized)
 * @param allowedRoots - List of allowed root directories
 * @returns true if path is under an allowed root
 */
export function isPathUnderAllowedRoots(targetPath: string, allowedRoots: string[]): boolean {
  if (allowedRoots.length === 0) return true; // No restriction if no roots specified

  const normalizedTarget = path.resolve(targetPath).toLowerCase();

  return allowedRoots.some((root) => {
    const normalizedRoot = path.resolve(root).toLowerCase();
    // Path must start with root and either be equal or followed by separator
    return (
      normalizedTarget === normalizedRoot ||
      normalizedTarget.startsWith(normalizedRoot + path.sep)
    );
  });
}

/**
 * Check if a path is in the blocked list.
 * @param targetPath - The path to check (should be normalized)
 * @returns true if path is blocked
 */
export function isPathBlocked(targetPath: string): boolean {
  const normalizedTarget = path.resolve(targetPath).toLowerCase();
  const blockedPaths = getBlockedPaths();

  return blockedPaths.some((blocked) => {
    const normalizedBlocked = path.resolve(blocked).toLowerCase();
    return (
      normalizedTarget === normalizedBlocked ||
      normalizedTarget.startsWith(normalizedBlocked + path.sep)
    );
  });
}

/**
 * Validate a path for use as a working directory.
 * @param inputPath - The path to validate
 * @param basePath - Base path for resolving relative paths
 * @param allowedRoots - Optional list of allowed root directories
 * @returns Validation result with normalized path or error
 */
export function validateWorkingDir(
  inputPath: string,
  basePath: string,
  allowedRoots?: string[],
): PathValidationResult {
  try {
    // 1. Normalize the path
    const normalizedPath = normalizePath(inputPath, basePath);

    // 2. Check if path exists
    if (!fs.existsSync(normalizedPath)) {
      return {
        valid: false,
        normalizedPath,
        error: `Directory does not exist: ${normalizedPath}`,
      };
    }

    // 3. Check if it's a directory
    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        normalizedPath,
        error: `Not a directory: ${normalizedPath}`,
      };
    }

    // 4. Resolve symlinks and check real path
    let realPath: string;
    try {
      realPath = fs.realpathSync(normalizedPath);
    } catch (err: any) {
      return {
        valid: false,
        normalizedPath,
        error: `Cannot resolve path: ${err.message}`,
      };
    }

    // 5. Check if path is blocked (system directories)
    if (isPathBlocked(realPath)) {
      return {
        valid: false,
        normalizedPath: realPath,
        error: `Access to system directory is not allowed: ${realPath}`,
      };
    }

    // 6. Check if path is under allowed roots (if specified)
    if (allowedRoots && allowedRoots.length > 0) {
      if (!isPathUnderAllowedRoots(realPath, allowedRoots)) {
        return {
          valid: false,
          normalizedPath: realPath,
          error: `Path is not under allowed directories. Allowed: ${allowedRoots.join(", ")}`,
        };
      }
    }

    // 7. Check read/write permissions
    try {
      fs.accessSync(realPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err: any) {
      return {
        valid: false,
        normalizedPath: realPath,
        error: `Insufficient permissions for directory: ${realPath}`,
      };
    }

    return {
      valid: true,
      normalizedPath: realPath,
    };
  } catch (err: any) {
    return {
      valid: false,
      normalizedPath: inputPath,
      error: `Validation error: ${err.message}`,
    };
  }
}

/**
 * Get the parent directory that should be used as the allowed root.
 * For a working directory like D:\SubDev\HypeAI, returns D:\SubDev
 * This allows access to sibling project directories.
 * @param workingDir - The initial working directory
 * @returns Parent directory path
 */
export function getDefaultAllowedRoot(workingDir: string): string {
  return path.dirname(path.resolve(workingDir));
}

/**
 * Check if a path is safe for use as working directory.
 * Convenience function that combines all checks.
 * @param inputPath - Path to check
 * @param basePath - Base path for resolution
 * @param allowedRoots - Optional allowed roots
 * @returns true if path is safe
 */
export function isPathSafe(
  inputPath: string,
  basePath: string,
  allowedRoots?: string[],
): boolean {
  const result = validateWorkingDir(inputPath, basePath, allowedRoots);
  return result.valid;
}
