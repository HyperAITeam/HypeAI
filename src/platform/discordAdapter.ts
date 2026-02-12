import {
  AttachmentBuilder,
  EmbedBuilder,
  type Message,
  type TextChannel,
} from "discord.js";
import type {
  PlatformAdapter,
  PlatformMessage,
  RichMessage,
  FileAttachment,
  InteractiveQuestion,
  ProgressHandle,
} from "./types.js";
import { DISCORD_MAX_LENGTH } from "../config.js";
import { isAllowedUser } from "../utils/security.js";
import { handleAskUserQuestion } from "../utils/discordPrompt.js";

/** Convert a Discord Message to a PlatformMessage */
export function discordToPlatformMessage(msg: Message): PlatformMessage {
  return {
    platform: "discord",
    userId: msg.author.id,
    displayName: msg.author.displayName ?? msg.author.username,
    channelId: msg.channelId,
    content: msg.content,
    raw: msg,
  };
}

class DiscordAdapter implements PlatformAdapter {
  readonly platform = "discord" as const;
  readonly maxMessageLength = DISCORD_MAX_LENGTH;

  async reply(msg: PlatformMessage, text: string): Promise<void> {
    const discordMsg = msg.raw as Message;

    if (text.length <= DISCORD_MAX_LENGTH) {
      await discordMsg.reply(text);
      return;
    }

    // Truncate + file attachment for long messages
    const preview = text.slice(0, DISCORD_MAX_LENGTH - 100);
    const file = new AttachmentBuilder(Buffer.from(text, "utf-8"), {
      name: "output.txt",
    });
    await discordMsg.reply({
      content: preview + "\n*(truncated — full output attached)*",
      files: [file],
    });
  }

  async replyRich(msg: PlatformMessage, rich: RichMessage): Promise<void> {
    const discordMsg = msg.raw as Message;
    const embed = new EmbedBuilder();

    if (rich.title) embed.setTitle(rich.title);
    if (rich.description) embed.setDescription(rich.description);
    if (rich.color !== undefined) embed.setColor(rich.color);
    if (rich.footer) embed.setFooter({ text: rich.footer });
    if (rich.fields) {
      embed.addFields(
        rich.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline ?? false,
        })),
      );
    }

    await discordMsg.reply({ embeds: [embed] });
  }

  async replyWithFile(
    msg: PlatformMessage,
    text: string,
    file: FileAttachment,
  ): Promise<void> {
    const discordMsg = msg.raw as Message;
    const attachment = new AttachmentBuilder(file.content, {
      name: file.name,
    });

    const content = text.length > DISCORD_MAX_LENGTH
      ? text.slice(0, DISCORD_MAX_LENGTH - 60) + "\n*(truncated)*"
      : text;

    await discordMsg.reply({ content, files: [attachment] });
  }

  showTyping(msg: PlatformMessage): { stop: () => void } {
    const discordMsg = msg.raw as Message;
    const channel = discordMsg.channel;

    const doTyping = () => {
      if ("sendTyping" in channel && typeof channel.sendTyping === "function") {
        (channel.sendTyping as () => Promise<void>)().catch(() => {});
      }
    };

    doTyping();
    const interval = setInterval(doTyping, 8_000);

    return {
      stop: () => clearInterval(interval),
    };
  }

  async askQuestion(
    msg: PlatformMessage,
    question: InteractiveQuestion,
  ): Promise<string> {
    const discordMsg = msg.raw as Message;
    const result = await handleAskUserQuestion(
      {
        questions: [
          {
            question: question.question,
            header: question.header,
            options: question.options,
            multiSelect: question.multiSelect,
          },
        ],
      },
      discordMsg.channel as TextChannel,
      msg.userId,
    );

    // Return the first answer
    const answers = result.answers ?? {};
    return Object.values(answers)[0] ?? question.options[0]?.label ?? "";
  }

  async sendProgress(
    msg: PlatformMessage,
    text: string,
  ): Promise<ProgressHandle> {
    const discordMsg = msg.raw as Message;
    const progressMsg = await discordMsg.reply(text);

    return {
      update: async (newText: string) => {
        await progressMsg.edit(newText).catch(() => {});
      },
      delete: async () => {
        await progressMsg.delete().catch(() => {});
      },
    };
  }

  isAuthorized(userId: string): boolean {
    return isAllowedUser(userId);
  }
}

// Singleton instance
let discordAdapterInstance: DiscordAdapter | null = null;

export function getDiscordAdapter(): PlatformAdapter {
  if (!discordAdapterInstance) {
    discordAdapterInstance = new DiscordAdapter();
  }
  return discordAdapterInstance;
}
