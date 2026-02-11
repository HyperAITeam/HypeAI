import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Attachment } from "discord.js";
import { FILE_UPLOAD } from "../config.js";
import { checkPromptInjection } from "./promptGuard.js";

export interface UploadResult {
  success: boolean;
  filePath?: string;
  /** Randomized safe filename (no user input) */
  fileName?: string;
  /** Original filename from Discord (for display only) */
  originalName?: string;
  error?: string;
  /** Warning if file content looks suspicious */
  contentWarning?: string;
}

/** Maximum number of attachments per single message */
const MAX_FILES_PER_MESSAGE = 5;

/** Maximum filename length (NTFS limit = 255) */
const MAX_FILENAME_LENGTH = 200;

/** File signatures for known binary/executable formats */
const BINARY_SIGNATURES: { name: string; magic: number[] }[] = [
  { name: "EXE/DLL (MZ)", magic: [0x4d, 0x5a] },
  { name: "ELF", magic: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "Mach-O (32)", magic: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "Mach-O (64)", magic: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: "Java class", magic: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "ZIP/JAR/APK", magic: [0x50, 0x4b, 0x03, 0x04] },
  { name: "RAR", magic: [0x52, 0x61, 0x72, 0x21] },
  { name: "7z", magic: [0x37, 0x7a, 0xbc, 0xaf] },
  { name: "CAB", magic: [0x4d, 0x53, 0x43, 0x46] },
];

/**
 * Check buffer for known binary/executable file signatures.
 */
function detectBinarySignature(buffer: Buffer): string | null {
  for (const sig of BINARY_SIGNATURES) {
    if (buffer.length >= sig.magic.length) {
      const match = sig.magic.every((byte, i) => buffer[i] === byte);
      if (match) return sig.name;
    }
  }
  return null;
}

/**
 * Scan text file content for prompt injection patterns.
 */
function scanFileContent(buffer: Buffer): string | null {
  // Only scan text files (skip if binary-looking)
  const nullByteCount = buffer.slice(0, 8192).filter((b) => b === 0).length;
  if (nullByteCount > 10) return null; // binary file, skip text scan

  const text = buffer.slice(0, 16384).toString("utf-8");
  const check = checkPromptInjection(text);
  if (check.detected) {
    return `파일 내용에서 의심스러운 패턴 감지: ${check.warnings.join(", ")}`;
  }
  return null;
}

/**
 * Validate file attachment before download.
 */
export function validateAttachment(attachment: Attachment): { valid: boolean; error?: string } {
  // Check file size
  if (attachment.size > FILE_UPLOAD.maxSize) {
    const maxMB = FILE_UPLOAD.maxSize / (1024 * 1024);
    return { valid: false, error: `파일 크기가 ${maxMB}MB를 초과합니다.` };
  }

  const originalName = attachment.name ?? "";

  // Check filename length
  if (originalName.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: `파일명이 너무 깁니다 (최대 ${MAX_FILENAME_LENGTH}자).` };
  }

  // Check file extension
  const ext = path.extname(originalName).toLowerCase();
  if (!ext) {
    return { valid: false, error: "파일 확장자가 없습니다." };
  }
  if (!FILE_UPLOAD.allowedExtensions.has(ext)) {
    return { valid: false, error: `허용되지 않는 파일 형식입니다: ${ext}` };
  }

  return { valid: true };
}

/**
 * Download and save attachment to the uploads folder.
 * Filename is randomized to prevent path traversal and shell injection.
 */
export async function downloadAttachment(
  attachment: Attachment,
  workingDir: string,
): Promise<UploadResult> {
  // Validate first
  const validation = validateAttachment(attachment);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // Create uploads folder (idempotent, no TOCTOU)
    const uploadDir = path.join(workingDir, FILE_UPLOAD.uploadFolder);
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
    }

    // Generate randomized filename — completely ignores user-supplied name
    const originalName = attachment.name ?? "unknown";
    const ext = path.extname(originalName).toLowerCase();
    const randomId = crypto.randomBytes(16).toString("hex");
    const fileName = `${randomId}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Verify the resolved path is still inside uploadDir (defense in depth)
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(uploadDir);
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep) && resolvedPath !== resolvedUploadDir) {
      return { success: false, error: "잘못된 파일 경로입니다." };
    }

    // Download with Content-Length pre-check
    const response = await fetch(attachment.url);
    if (!response.ok) {
      return { success: false, error: `다운로드 실패: ${response.statusText}` };
    }

    const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10);
    if (contentLength > FILE_UPLOAD.maxSize) {
      return { success: false, error: `서버 응답 크기가 제한을 초과합니다.` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Double-check actual size
    if (buffer.length > FILE_UPLOAD.maxSize) {
      return { success: false, error: `다운로드된 파일 크기가 제한을 초과합니다.` };
    }

    // Check for disguised binary/executable
    const binarySig = detectBinarySignature(buffer);
    if (binarySig) {
      return { success: false, error: `실행 파일 형식이 감지되었습니다 (${binarySig}). 업로드가 차단됩니다.` };
    }

    // Write file
    fs.writeFileSync(filePath, buffer, { mode: 0o600 });

    // Scan text content for prompt injection
    const contentWarning = scanFileContent(buffer) ?? undefined;

    return {
      success: true,
      filePath,
      fileName,
      originalName,
      contentWarning,
    };
  } catch (err: any) {
    return { success: false, error: `파일 저장 실패: ${err.message}` };
  }
}

/**
 * Process multiple attachments with per-message count limit.
 */
export async function processAttachments(
  attachments: Attachment[],
  workingDir: string,
): Promise<{ uploaded: UploadResult[]; errors: string[] }> {
  const uploaded: UploadResult[] = [];
  const errors: string[] = [];

  if (attachments.length > MAX_FILES_PER_MESSAGE) {
    errors.push(`메시지당 최대 ${MAX_FILES_PER_MESSAGE}개의 파일만 첨부할 수 있습니다.`);
    // Process only up to the limit
    attachments = attachments.slice(0, MAX_FILES_PER_MESSAGE);
  }

  for (const attachment of attachments) {
    const result = await downloadAttachment(attachment, workingDir);
    if (result.success) {
      uploaded.push(result);
    } else {
      errors.push(`${attachment.name}: ${result.error}`);
    }
  }

  return { uploaded, errors };
}

/**
 * Build prompt with file information.
 * Uses relative paths only — never exposes absolute paths.
 */
export function buildFilePrompt(
  uploadedFiles: UploadResult[],
  userMessage: string,
  workingDir: string,
): string {
  if (uploadedFiles.length === 0) {
    return userMessage;
  }

  const fileInfo = uploadedFiles
    .map((f) => {
      const displayName = f.originalName ?? f.fileName ?? "unknown";
      const relativePath = path.relative(workingDir, f.filePath!).replace(/\\/g, "/");
      return `- ${relativePath} (원본: ${displayName})`;
    })
    .join("\n");

  const contentWarnings = uploadedFiles
    .filter((f) => f.contentWarning)
    .map((f) => `  ⚠️ ${f.originalName}: ${f.contentWarning}`)
    .join("\n");

  let prompt = `[첨부 파일]\n${fileInfo}\n`;
  if (contentWarnings) {
    prompt += `\n[보안 경고]\n${contentWarnings}\n`;
  }
  prompt += `\n${userMessage}`;
  return prompt;
}

/**
 * Clean up uploaded files older than the given max age (ms).
 * Default: 1 hour.
 */
export function cleanupUploads(workingDir: string, maxAgeMs: number = 3600000): number {
  const uploadDir = path.join(workingDir, FILE_UPLOAD.uploadFolder);
  if (!fs.existsSync(uploadDir)) return 0;

  let cleaned = 0;
  const now = Date.now();

  try {
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      try {
        const stat = fs.lstatSync(filePath);
        // Skip non-files (symlinks, directories)
        if (!stat.isFile()) {
          // Remove symlinks or unexpected items
          fs.unlinkSync(filePath);
          cleaned++;
          continue;
        }
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return cleaned;
}
