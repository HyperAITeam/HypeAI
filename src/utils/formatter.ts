import { AttachmentBuilder, Message, type ChatInputCommandInteraction } from "discord.js";
import { DISCORD_MAX_LENGTH } from "../config.js";
import { sanitizeOutput } from "./sanitizeOutput.js";

/** Combine stdout/stderr into a single result string. */
export function formatOutput(
  stdout: string,
  stderr: string,
  code: number | null,
): string {
  const parts: string[] = [];
  if (stdout.trim()) parts.push(stdout.trim());
  if (stderr.trim()) parts.push(`[stderr]\n${sanitizeOutput(stderr.trim())}`);
  if (code !== null && code !== 0) parts.push(`(exit code: ${code})`);
  return parts.length > 0 ? parts.join("\n") : "(no output)";
}

/**
 * Send a result to Discord, splitting or attaching as file if too long.
 */
export async function sendResult(
  message: Message,
  content: string,
  options: { prefix?: string; lang?: string } = {},
): Promise<void> {
  const { prefix, lang } = options;
  if (prefix) content = `${prefix}\n${content}`;

  const wrapped = lang
    ? `\`\`\`${lang}\n${content}\n\`\`\``
    : `\`\`\`\n${content}\n\`\`\``;

  if (wrapped.length <= DISCORD_MAX_LENGTH) {
    await message.reply(wrapped);
    return;
  }

  // Too long — send preview + file attachment
  const maxPreview = DISCORD_MAX_LENGTH - 200;
  const preview = content.slice(0, maxPreview);
  let previewMsg = lang
    ? `\`\`\`${lang}\n${preview}\n\`\`\`\n*(truncated — full output attached)*`
    : `\`\`\`\n${preview}\n\`\`\`\n*(truncated — full output attached)*`;

  if (previewMsg.length > DISCORD_MAX_LENGTH) {
    previewMsg = "*(output too long — see attached file)*";
  }

  const file = new AttachmentBuilder(Buffer.from(content, "utf-8"), {
    name: "output.txt",
  });
  await message.reply({ content: previewMsg, files: [file] });
}

/**
 * Send a result via interaction.editReply, with file attachment for long output.
 */
export async function sendInteractionResult(
  interaction: ChatInputCommandInteraction,
  content: string,
  options: { prefix?: string; lang?: string } = {},
): Promise<void> {
  const { prefix, lang } = options;
  if (prefix) content = `${prefix}\n${content}`;

  const wrapped = lang
    ? `\`\`\`${lang}\n${content}\n\`\`\``
    : `\`\`\`\n${content}\n\`\`\``;

  if (wrapped.length <= DISCORD_MAX_LENGTH) {
    await interaction.editReply(wrapped);
    return;
  }

  const maxPreview = DISCORD_MAX_LENGTH - 200;
  const preview = content.slice(0, maxPreview);
  let previewMsg = `\`\`\`\n${preview}\n\`\`\`\n*(truncated — full output attached)*`;
  if (previewMsg.length > DISCORD_MAX_LENGTH) {
    previewMsg = "*(output too long — see attached file)*";
  }

  const file = new AttachmentBuilder(Buffer.from(content, "utf-8"), {
    name: "output.txt",
  });
  await interaction.editReply({ content: previewMsg, files: [file] });
}
