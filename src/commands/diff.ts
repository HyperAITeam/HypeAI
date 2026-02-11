import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import { isAllowedUser } from "../utils/security.js";
import { withTyping } from "../utils/typing.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";
import {
  getGitDiff,
  filterSensitiveFiles,
  filterSensitiveDiff,
  type DiffOptions,
} from "../utils/gitDiff.js";
import { diffToImage, createTextDiffSummary } from "../utils/diffRenderer.js";

/**
 * Parse diff command arguments
 * !diff              → all changes
 * !diff --staged     → staged only
 * !diff <file>       → specific file
 * !diff HEAD~1       → compare with commit
 */
function parseDiffArgs(args: string[]): DiffOptions {
  const options: DiffOptions = {};

  for (const arg of args) {
    if (arg === "--staged" || arg === "-s") {
      options.staged = true;
    } else if (arg.startsWith("HEAD") || arg.match(/^[a-f0-9]{7,40}$/i)) {
      options.commit = arg;
    } else if (!arg.startsWith("-")) {
      options.file = arg;
    }
  }

  return options;
}

const diffCommand: PrefixCommand = {
  name: "diff",
  aliases: ["d", "changes"],
  description: "Show git diff as an image. Usage: !diff [--staged] [file] [commit]",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    // Get current session's working directory
    const multiSession = getMultiSessionManager();
    const activeSession = multiSession?.getActiveSession();
    const cwd = activeSession?.manager.getInfo().cwd ?? ctx.client.workingDir;

    const options = parseDiffArgs(ctx.args);

    await withTyping(ctx.message, async () => {
      // Get diff data
      const diffResult = await getGitDiff(cwd, options);

      if (!diffResult.isGitRepo) {
        await ctx.message.reply("❌ Not a git repository.");
        return;
      }

      if (diffResult.files.length === 0 && !diffResult.raw) {
        await ctx.message.reply("✅ No changes detected.");
        return;
      }

      // Filter sensitive files
      const safeFiles = filterSensitiveFiles(diffResult.files);
      const safeDiff = filterSensitiveDiff(diffResult.raw);

      if (!safeDiff.trim()) {
        await ctx.message.reply("✅ No changes to display (sensitive files filtered).");
        return;
      }

      // Create summary embed
      const embed = new EmbedBuilder()
        .setTitle("📊 Git Changes")
        .setColor(0x238636) // GitHub green
        .addFields(
          {
            name: "Files Changed",
            value: `${safeFiles.length}`,
            inline: true,
          },
          {
            name: "Lines Added",
            value: `+${diffResult.totalAdded}`,
            inline: true,
          },
          {
            name: "Lines Removed",
            value: `-${diffResult.totalRemoved}`,
            inline: true,
          },
        )
        .setTimestamp();

      // Add file list (up to 10)
      if (safeFiles.length > 0) {
        const fileList = safeFiles
          .slice(0, 10)
          .map((f) => {
            const icon = f.status === "added" ? "🆕" : f.status === "deleted" ? "🗑️" : "📝";
            return `${icon} \`${f.path}\` (+${f.additions}, -${f.deletions})`;
          })
          .join("\n");

        const suffix = safeFiles.length > 10 ? `\n... and ${safeFiles.length - 10} more` : "";
        embed.addFields({ name: "Changed Files", value: fileList + suffix });
      }

      // Try to render diff as image
      try {
        const imageBuffer = await diffToImage(safeDiff, {
          theme: "dark",
          maxLines: 150,
          outputFormat: "line-by-line",
        });

        const attachment = new AttachmentBuilder(imageBuffer, {
          name: "diff.png",
        });

        await ctx.message.reply({
          embeds: [embed],
          files: [attachment],
        });
      } catch (renderError) {
        // Fallback to text if image rendering fails
        console.error("[Diff] Image render failed:", renderError);

        const textSummary = createTextDiffSummary(
          safeFiles,
          diffResult.totalAdded,
          diffResult.totalRemoved,
        );

        // Attach raw diff as file
        const diffFile = new AttachmentBuilder(Buffer.from(safeDiff, "utf-8"), {
          name: "changes.diff",
        });

        await ctx.message.reply({
          content: textSummary,
          files: [diffFile],
        });
      }
    });
  },
};

export default diffCommand;
