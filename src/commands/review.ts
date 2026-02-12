import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type Message,
  type MessageComponentInteraction,
  type TextChannel,
} from "discord.js";
import type { PrefixCommand, CommandContext } from "../types.js";
import { isAllowedUser } from "../utils/security.js";
import { withTyping } from "../utils/typing.js";
import { getMultiSessionManager } from "../sessions/multiSession.js";
import {
  getGitDiff,
  filterSensitiveFiles,
  filterSensitiveDiff,
  splitDiffByFile,
  type DiffFile,
  type DiffOptions,
} from "../utils/gitDiff.js";
import { diffToImage, createTextDiffSummary } from "../utils/diffRenderer.js";

const INTERACTION_TIMEOUT = 120_000; // 2 minutes

/**
 * Parse review command arguments (same as diff)
 */
function parseReviewArgs(args: string[]): DiffOptions {
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

/**
 * Get short filename from path for button labels
 */
function shortFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

/**
 * Generate AI summary of the diff changes
 */
async function generateAISummary(
  rawDiff: string,
  files: DiffFile[],
  totalAdded: number,
  totalRemoved: number,
  discordMessage: CommandContext["message"],
): Promise<string | null> {
  const multiSession = getMultiSessionManager();
  if (!multiSession) return null;

  const activeSession = multiSession.getActiveSession();
  if (!activeSession || activeSession.manager.isBusy) return null;

  const fileList = files
    .slice(0, 15)
    .map((f) => `${f.path} (+${f.additions}, -${f.deletions})`)
    .join("\n");

  const diffPreview = rawDiff.slice(0, 3000);

  const prompt = `다음 git diff를 분석하고 한국어로 2-3문장으로 요약해주세요.
변경의 목적, 영향 범위, 주의사항을 포함해주세요.
코드를 출력하지 말고 요약만 해주세요.

변경 파일 (${files.length}개, +${totalAdded} -${totalRemoved}):
${fileList}

Diff:
${diffPreview}`;

  try {
    const result = await multiSession.sendMessage(
      null,
      prompt,
      discordMessage,
    );
    // Take only the first ~500 chars to keep the embed clean
    return result.slice(0, 500);
  } catch {
    return null;
  }
}

/**
 * Render a single file's diff as a mobile-optimized image
 */
async function renderFileDiff(fileDiff: string): Promise<Buffer | null> {
  try {
    return await diffToImage(fileDiff, {
      theme: "dark",
      mobile: true,
      maxLines: 50,
      outputFormat: "line-by-line",
    });
  } catch {
    return null;
  }
}

const reviewCommand: PrefixCommand = {
  name: "review",
  aliases: ["r", "rv"],
  description:
    "Interactive code review with AI summary. Usage: !review [--staged] [file] [commit]",

  async execute(ctx: CommandContext): Promise<void> {
    if (!isAllowedUser(ctx.message.author.id)) {
      await ctx.message.reply("You are not authorized to use this bot.");
      return;
    }

    const multiSession = getMultiSessionManager();
    const activeSession = multiSession?.getActiveSession();
    const cwd = activeSession?.manager.getInfo().cwd ?? ctx.client.workingDir;

    const options = parseReviewArgs(ctx.args);

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
        await ctx.message.reply(
          "✅ No changes to display (sensitive files filtered).",
        );
        return;
      }

      // Split diff by file for per-file navigation
      const fileDiffs = splitDiffByFile(safeDiff);
      const fileNames = Array.from(fileDiffs.keys());

      // --- Stage 1: Build summary embed ---
      const embed = new EmbedBuilder()
        .setTitle("📋 코드 리뷰")
        .setColor(0x5865f2)
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

      // File list
      if (safeFiles.length > 0) {
        const fileList = safeFiles
          .slice(0, 10)
          .map((f) => {
            const icon =
              f.status === "added"
                ? "🆕"
                : f.status === "deleted"
                  ? "🗑️"
                  : "📝";
            return `${icon} \`${f.path}\` (+${f.additions}, -${f.deletions})`;
          })
          .join("\n");

        const suffix =
          safeFiles.length > 10
            ? `\n... and ${safeFiles.length - 10} more`
            : "";
        embed.addFields({ name: "📁 변경 파일", value: fileList + suffix });
      }

      // Generate AI summary (non-blocking — falls back to no summary)
      let aiSummary: string | null = null;
      if (multiSession && activeSession && !activeSession.manager.isBusy) {
        const progressMsg = await ctx.message.reply(
          "🔍 AI가 변경사항을 분석 중...",
        );
        try {
          aiSummary = await generateAISummary(
            safeDiff,
            safeFiles,
            diffResult.totalAdded,
            diffResult.totalRemoved,
            ctx.message,
          );
        } catch {
          // Silently fall back
        }
        await progressMsg.delete().catch(() => {});
      }

      if (aiSummary) {
        embed.setDescription(aiSummary);
      }

      // --- Stage 1: Send embed with action buttons ---
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("review_files")
          .setLabel("📄 파일별 보기")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("review_full")
          .setLabel("📸 전체 Diff")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("review_approve")
          .setLabel("✅ 승인")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("review_reject")
          .setLabel("❌ 수정 요청")
          .setStyle(ButtonStyle.Danger),
      );

      const reviewMsg = await ctx.message.reply({
        embeds: [embed],
        components: [buttons],
      });

      // --- Stage 2: Handle button interactions ---
      const collector = reviewMsg.createMessageComponentCollector({
        filter: (i: MessageComponentInteraction) => {
          if (i.user.id !== ctx.message.author.id) {
            i.reply({
              content: "Only the requester can interact.",
              ephemeral: true,
            });
            return false;
          }
          return true;
        },
        time: INTERACTION_TIMEOUT,
      });

      collector.on("collect", async (interaction: MessageComponentInteraction) => {
        try {
          if (interaction.customId === "review_files") {
            await handleFileSelect(
              interaction,
              fileNames,
              fileDiffs,
              safeFiles,
              ctx,
            );
          } else if (interaction.customId === "review_full") {
            await handleFullDiff(interaction, safeDiff, safeFiles, diffResult);
          } else if (interaction.customId === "review_approve") {
            await handleApprove(interaction, ctx);
          } else if (interaction.customId === "review_reject") {
            await handleRequestChanges(interaction, ctx);
          }
        } catch (err: any) {
          console.error("[Review] Interaction error:", err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: `Error: ${err.message}`,
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", async () => {
        // Disable all buttons after timeout
        const disabledButtons =
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("review_files")
              .setLabel("📄 파일별 보기")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("review_full")
              .setLabel("📸 전체 Diff")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("review_approve")
              .setLabel("✅ 승인")
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("review_reject")
              .setLabel("❌ 수정 요청")
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true),
          );

        await reviewMsg
          .edit({ components: [disabledButtons] })
          .catch(() => {});
      });
    });
  },
};

/**
 * Handle "파일별 보기" — show file selector then per-file diff
 */
async function handleFileSelect(
  interaction: MessageComponentInteraction,
  fileNames: string[],
  fileDiffs: Map<string, string>,
  safeFiles: DiffFile[],
  ctx: CommandContext,
): Promise<void> {
  if (fileNames.length === 0) {
    await interaction.reply({
      content: "No files to display.",
      ephemeral: true,
    });
    return;
  }

  // Defer since rendering may take a while
  await interaction.deferReply();

  if (fileNames.length <= 5) {
    // Show file buttons
    const fileButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      fileNames.map((name, i) =>
        new ButtonBuilder()
          .setCustomId(`file_${i}`)
          .setLabel(shortFileName(name).slice(0, 80))
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    const fileMsg = await interaction.editReply({
      content: "📁 **파일을 선택하세요:**",
      components: [fileButtons],
    });

    // Wait for file selection
    try {
      const fileInteraction = await fileMsg.awaitMessageComponent({
        filter: (i: MessageComponentInteraction) =>
          i.user.id === ctx.message.author.id,
        componentType: ComponentType.Button,
        time: INTERACTION_TIMEOUT,
      });

      const fileIndex = parseInt(
        fileInteraction.customId.replace("file_", ""),
        10,
      );
      await showFileDiff(
        fileInteraction,
        fileNames,
        fileDiffs,
        fileIndex,
        ctx,
      );
    } catch {
      await interaction
        .editReply({ content: "⏰ Selection timed out.", components: [] })
        .catch(() => {});
    }
  } else {
    // Show dropdown menu for many files
    const select = new StringSelectMenuBuilder()
      .setCustomId("file_select")
      .setPlaceholder("파일을 선택하세요...")
      .setMinValues(1)
      .setMaxValues(1);

    for (const [i, name] of fileNames.entries()) {
      const file = safeFiles.find((f) => f.path === name);
      const stats = file
        ? `+${file.additions}, -${file.deletions}`
        : "";
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(shortFileName(name).slice(0, 100))
          .setValue(String(i))
          .setDescription(
            (name.length > 100 ? "..." + name.slice(-97) : name).slice(0, 100) +
              (stats ? ` (${stats})` : ""),
          ),
      );
    }

    const selectRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const selectMsg = await interaction.editReply({
      content: "📁 **파일을 선택하세요:**",
      components: [selectRow],
    });

    try {
      const selectInteraction = await selectMsg.awaitMessageComponent({
        filter: (i: MessageComponentInteraction) =>
          i.user.id === ctx.message.author.id,
        componentType: ComponentType.StringSelect,
        time: INTERACTION_TIMEOUT,
      });

      const fileIndex = parseInt(selectInteraction.values[0], 10);
      await showFileDiff(
        selectInteraction,
        fileNames,
        fileDiffs,
        fileIndex,
        ctx,
      );
    } catch {
      await interaction
        .editReply({ content: "⏰ Selection timed out.", components: [] })
        .catch(() => {});
    }
  }
}

/**
 * Show a single file's diff with navigation buttons
 */
async function showFileDiff(
  interaction: MessageComponentInteraction,
  fileNames: string[],
  fileDiffs: Map<string, string>,
  currentIndex: number,
  ctx: CommandContext,
): Promise<void> {
  const fileName = fileNames[currentIndex];
  const fileDiff = fileDiffs.get(fileName);

  if (!fileDiff) {
    await interaction.reply({
      content: "File diff not found.",
      ephemeral: true,
    });
    return;
  }

  // Defer since rendering takes time
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }

  // Render mobile-optimized diff image
  const imageBuffer = await renderFileDiff(fileDiff);

  // Navigation buttons
  const navButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`nav_prev_${currentIndex}`)
      .setLabel("⬅️ 이전")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === 0),
    new ButtonBuilder()
      .setCustomId(`nav_next_${currentIndex}`)
      .setLabel("➡️ 다음")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex >= fileNames.length - 1),
    new ButtonBuilder()
      .setCustomId(`nav_comment_${currentIndex}`)
      .setLabel("💬 코멘트")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`nav_back`)
      .setLabel("↩️ 목록")
      .setStyle(ButtonStyle.Secondary),
  );

  const fileLabel = `📝 **${fileName}** (${currentIndex + 1}/${fileNames.length})`;

  if (imageBuffer) {
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "diff.png",
    });

    const msg = await interaction.editReply({
      content: fileLabel,
      files: [attachment],
      components: [navButtons],
    });

    // Handle navigation
    try {
      const navInteraction = await msg.awaitMessageComponent({
        filter: (i: MessageComponentInteraction) =>
          i.user.id === ctx.message.author.id,
        time: INTERACTION_TIMEOUT,
      });

      if (navInteraction.customId.startsWith("nav_prev_")) {
        await showFileDiff(
          navInteraction,
          fileNames,
          fileDiffs,
          currentIndex - 1,
          ctx,
        );
      } else if (navInteraction.customId.startsWith("nav_next_")) {
        await showFileDiff(
          navInteraction,
          fileNames,
          fileDiffs,
          currentIndex + 1,
          ctx,
        );
      } else if (navInteraction.customId.startsWith("nav_comment_")) {
        await handleFileComment(navInteraction, fileName, ctx);
      } else if (navInteraction.customId === "nav_back") {
        await navInteraction.update({
          content: "↩️ 목록으로 돌아갑니다.",
          files: [],
          components: [],
        });
      }
    } catch {
      // Timeout — disable buttons
      await interaction
        .editReply({ components: [] })
        .catch(() => {});
    }
  } else {
    // Fallback: code block
    const codeBlock = `\`\`\`diff\n${fileDiff.slice(0, 1800)}\n\`\`\``;
    await interaction.editReply({
      content: fileLabel + "\n" + codeBlock,
      components: [navButtons],
    });
  }
}

/**
 * Handle "전체 Diff" — render full diff as image (desktop style)
 */
async function handleFullDiff(
  interaction: MessageComponentInteraction,
  safeDiff: string,
  safeFiles: DiffFile[],
  diffResult: { totalAdded: number; totalRemoved: number },
): Promise<void> {
  await interaction.deferReply();

  try {
    const imageBuffer = await diffToImage(safeDiff, {
      theme: "dark",
      maxLines: 150,
      outputFormat: "line-by-line",
    });

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "diff.png",
    });

    await interaction.editReply({ files: [attachment] });
  } catch {
    // Fallback to text summary
    const textSummary = createTextDiffSummary(
      safeFiles,
      diffResult.totalAdded,
      diffResult.totalRemoved,
    );

    const codeBlock = `\`\`\`diff\n${safeDiff.slice(0, 1800)}\n\`\`\``;
    await interaction.editReply({
      content: textSummary + "\n" + codeBlock,
    });
  }
}

/**
 * Handle "승인" — approve changes and optionally commit
 */
async function handleApprove(
  interaction: MessageComponentInteraction,
  ctx: CommandContext,
): Promise<void> {
  const confirmButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("approve_commit")
      .setLabel("✅ 커밋하기")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("approve_done")
      .setLabel("👍 승인만 (커밋 안 함)")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: "변경사항을 승인합니다. 커밋하시겠습니까?",
    components: [confirmButtons],
    ephemeral: true,
  });

  try {
    const confirmInteraction =
      await interaction.channel!.awaitMessageComponent({
        filter: (i: MessageComponentInteraction) =>
          i.user.id === ctx.message.author.id &&
          (i.customId === "approve_commit" ||
            i.customId === "approve_done"),
        time: INTERACTION_TIMEOUT,
      });

    if (confirmInteraction.customId === "approve_commit") {
      // Ask AI to commit
      const multiSession = getMultiSessionManager();
      if (multiSession && !multiSession.getActiveSession().manager.isBusy) {
        await confirmInteraction.update({
          content: "⏳ AI에게 커밋을 요청 중...",
          components: [],
        });

        try {
          await multiSession.sendMessage(
            null,
            "현재 변경사항을 모두 stage하고 적절한 커밋 메시지로 커밋해주세요. git add 후 git commit을 실행하세요.",
            ctx.message,
          );
          await (ctx.message.channel as TextChannel).send(
            "✅ 커밋이 완료되었습니다.",
          );
        } catch (err: any) {
          await (ctx.message.channel as TextChannel).send(
            `❌ 커밋 실패: ${err.message}`,
          );
        }
      } else {
        await confirmInteraction.update({
          content: "❌ AI 세션이 사용 중이거나 없습니다.",
          components: [],
        });
      }
    } else {
      await confirmInteraction.update({
        content: "👍 변경사항이 승인되었습니다.",
        components: [],
      });
    }
  } catch {
    // Timeout
  }
}

/**
 * Handle "수정 요청" — collect feedback and send to AI
 */
async function handleRequestChanges(
  interaction: MessageComponentInteraction,
  ctx: CommandContext,
): Promise<void> {
  await interaction.reply({
    content:
      "📝 **수정 의견을 다음 메시지로 입력하세요.**\n(60초 내에 입력해주세요)",
    ephemeral: true,
  });

  try {
    // Wait for user's text message
    const channel = ctx.message.channel as TextChannel;
    const collected = await channel.awaitMessages({
      filter: (m: Message) => m.author.id === ctx.message.author.id,
      max: 1,
      time: 60_000,
    });

    const feedback = collected.first()?.content;
    if (!feedback) {
      await channel.send("⏰ 시간이 초과되었습니다.");
      return;
    }

    // Send feedback to AI
    const multiSession = getMultiSessionManager();
    if (multiSession && !multiSession.getActiveSession().manager.isBusy) {
      const progressMsg = await (ctx.message.channel as TextChannel).send(
        "⏳ AI가 수정 요청을 처리 중...",
      );

      try {
        await multiSession.sendMessage(
          null,
          `사용자가 코드 리뷰에서 다음과 같은 수정을 요청했습니다:\n\n"${feedback}"\n\n위 요청에 따라 코드를 수정해주세요.`,
          ctx.message,
        );
        await progressMsg.edit("✅ 수정이 완료되었습니다. `!review`로 다시 확인하세요.");
      } catch (err: any) {
        await progressMsg.edit(`❌ 수정 실패: ${err.message}`);
      }
    } else {
      await (ctx.message.channel as TextChannel).send(
        "❌ AI 세션이 사용 중이거나 없습니다.",
      );
    }
  } catch {
    await (ctx.message.channel as TextChannel)
      .send("⏰ 시간이 초과되었습니다.")
      .catch(() => {});
  }
}

/**
 * Handle file-level comment — collect comment and send to AI with context
 */
async function handleFileComment(
  interaction: MessageComponentInteraction,
  fileName: string,
  ctx: CommandContext,
): Promise<void> {
  await interaction.reply({
    content: `💬 **\`${shortFileName(fileName)}\`에 대한 의견을 입력하세요.**\n(60초 내에 입력해주세요)`,
    ephemeral: true,
  });

  try {
    const channel = ctx.message.channel as TextChannel;
    const collected = await channel.awaitMessages({
      filter: (m: Message) => m.author.id === ctx.message.author.id,
      max: 1,
      time: 60_000,
    });

    const comment = collected.first()?.content;
    if (!comment) {
      await channel.send("⏰ 시간이 초과되었습니다.");
      return;
    }

    const multiSession = getMultiSessionManager();
    if (multiSession && !multiSession.getActiveSession().manager.isBusy) {
      const progressMsg = await channel.send(
        `⏳ \`${shortFileName(fileName)}\`에 대한 의견을 AI에게 전달 중...`,
      );

      try {
        await multiSession.sendMessage(
          null,
          `사용자가 파일 "${fileName}"에 대해 다음과 같은 코멘트를 남겼습니다:\n\n"${comment}"\n\n이 의견을 반영하여 해당 파일을 수정해주세요.`,
          ctx.message,
        );
        await progressMsg.edit(
          `✅ \`${shortFileName(fileName)}\` 수정이 완료되었습니다.`,
        );
      } catch (err: any) {
        await progressMsg.edit(`❌ 수정 실패: ${err.message}`);
      }
    } else {
      await channel.send("❌ AI 세션이 사용 중이거나 없습니다.");
    }
  } catch {
    // Timeout
  }
}

export default reviewCommand;
