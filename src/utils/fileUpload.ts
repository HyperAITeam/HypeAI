import fs from "node:fs";
import path from "node:path";
import { Attachment } from "discord.js";
import { FILE_UPLOAD } from "../config.js";

export interface UploadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

/**
 * Validate file attachment before download
 */
export function validateAttachment(attachment: Attachment): { valid: boolean; error?: string } {
  // Check file size
  if (attachment.size > FILE_UPLOAD.maxSize) {
    const maxMB = FILE_UPLOAD.maxSize / (1024 * 1024);
    return { valid: false, error: `파일 크기가 ${maxMB}MB를 초과합니다.` };
  }

  // Check file extension
  const ext = path.extname(attachment.name ?? "").toLowerCase();
  if (!ext) {
    return { valid: false, error: "파일 확장자가 없습니다." };
  }
  if (!FILE_UPLOAD.allowedExtensions.has(ext)) {
    return { valid: false, error: `허용되지 않는 파일 형식입니다: ${ext}` };
  }

  return { valid: true };
}

/**
 * Download and save attachment to the uploads folder
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
    // Create uploads folder if it doesn't exist
    const uploadDir = path.join(workingDir, FILE_UPLOAD.uploadFolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = attachment.name ?? "unknown";
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const fileName = `${baseName}_${timestamp}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Download file
    const response = await fetch(attachment.url);
    if (!response.ok) {
      return { success: false, error: `다운로드 실패: ${response.statusText}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return {
      success: true,
      filePath,
      fileName,
    };
  } catch (err: any) {
    return { success: false, error: `파일 저장 실패: ${err.message}` };
  }
}

/**
 * Process multiple attachments and return results
 */
export async function processAttachments(
  attachments: Attachment[],
  workingDir: string,
): Promise<{ uploaded: UploadResult[]; errors: string[] }> {
  const uploaded: UploadResult[] = [];
  const errors: string[] = [];

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
 * Build prompt with file information
 */
export function buildFilePrompt(uploadedFiles: UploadResult[], userMessage: string): string {
  if (uploadedFiles.length === 0) {
    return userMessage;
  }

  const fileInfo = uploadedFiles
    .map((f) => `- ${f.filePath}`)
    .join("\n");

  return `[첨부 파일]\n${fileInfo}\n\n${userMessage}`;
}
