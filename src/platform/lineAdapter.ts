import type { messagingApi } from "@line/bot-sdk";
import type {
  PlatformAdapter,
  PlatformMessage,
  RichMessage,
  FileAttachment,
  InteractiveQuestion,
  ProgressHandle,
} from "./types.js";
import { isAllowedLineUser } from "../utils/security.js";

const LINE_MAX_LENGTH = 5000;

/** Convert a RichMessage to a LINE Flex Message bubble */
function richToFlexMessage(rich: RichMessage): messagingApi.FlexMessage {
  const bodyContents: messagingApi.FlexComponent[] = [];

  if (rich.title) {
    bodyContents.push({
      type: "text",
      text: rich.title,
      weight: "bold",
      size: "lg",
      wrap: true,
    });
    bodyContents.push({ type: "separator", margin: "md" });
  }

  if (rich.description) {
    bodyContents.push({
      type: "text",
      text: rich.description,
      wrap: true,
      size: "sm",
      margin: "md",
    });
  }

  if (rich.fields && rich.fields.length > 0) {
    bodyContents.push({ type: "separator", margin: "md" });
    for (const field of rich.fields) {
      bodyContents.push({
        type: "box",
        layout: "vertical",
        margin: "sm",
        contents: [
          {
            type: "text",
            text: field.name,
            size: "xs",
            color: "#8C8C8C",
            wrap: true,
          },
          {
            type: "text",
            text: field.value,
            size: "sm",
            wrap: true,
          },
        ],
      });
    }
  }

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents.length > 0
        ? bodyContents
        : [{ type: "text", text: "(empty)", wrap: true }],
    },
  };

  if (rich.footer) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: rich.footer,
          size: "xxs",
          color: "#8C8C8C",
          wrap: true,
        },
      ],
    };
  }

  return {
    type: "flex",
    altText: rich.title ?? rich.description ?? "Message",
    contents: bubble,
  };
}

/** Truncate text to LINE message length limit */
function truncateForLine(text: string): string {
  if (text.length <= LINE_MAX_LENGTH) return text;
  return text.slice(0, LINE_MAX_LENGTH - 30) + "\n...(truncated)";
}

export class LineAdapter implements PlatformAdapter {
  readonly platform = "line" as const;
  readonly maxMessageLength = LINE_MAX_LENGTH;

  private client: messagingApi.MessagingApiClient;
  private pendingResponses = new Map<
    string,
    { resolve: (value: string) => void; timeout: ReturnType<typeof setTimeout> }
  >();

  constructor(client: messagingApi.MessagingApiClient) {
    this.client = client;
  }

  async reply(msg: PlatformMessage, text: string): Promise<void> {
    const truncated = truncateForLine(text);
    await this.client.pushMessage({
      to: msg.channelId,
      messages: [{ type: "text", text: truncated }],
    });
  }

  async replyRich(msg: PlatformMessage, rich: RichMessage): Promise<void> {
    const flexMessage = richToFlexMessage(rich);
    await this.client.pushMessage({
      to: msg.channelId,
      messages: [flexMessage],
    });
  }

  async replyWithFile(
    msg: PlatformMessage,
    text: string,
    _file: FileAttachment,
  ): Promise<void> {
    // LINE doesn't support arbitrary file uploads via Messaging API.
    // Send the text content inline instead.
    const truncated = truncateForLine(text);
    await this.client.pushMessage({
      to: msg.channelId,
      messages: [{ type: "text", text: truncated }],
    });
  }

  showTyping(_msg: PlatformMessage): { stop: () => void } {
    // LINE doesn't have a typing indicator API
    return { stop: () => {} };
  }

  async askQuestion(
    msg: PlatformMessage,
    question: InteractiveQuestion,
  ): Promise<string> {
    // Use Quick Reply for up to 13 options
    const quickReplyItems: messagingApi.QuickReplyItem[] = question.options
      .slice(0, 13)
      .map((opt) => ({
        type: "action" as const,
        action: {
          type: "message" as const,
          label: opt.label.slice(0, 20),
          text: opt.label,
        },
      }));

    const questionText = question.header
      ? `[${question.header}]\n${question.question}`
      : question.question;

    await this.client.pushMessage({
      to: msg.channelId,
      messages: [
        {
          type: "text",
          text: truncateForLine(questionText),
          quickReply: { items: quickReplyItems },
        },
      ],
    });

    // Wait for user response
    return this.waitForUserResponse(msg.userId, 60_000);
  }

  async sendProgress(
    msg: PlatformMessage,
    text: string,
  ): Promise<ProgressHandle> {
    // LINE messages cannot be edited, so we send the initial message
    // and subsequent updates as new messages.
    await this.client.pushMessage({
      to: msg.channelId,
      messages: [{ type: "text", text: truncateForLine(text) }],
    });

    return {
      update: async (newText: string) => {
        // Send a new message (LINE doesn't support message editing)
        await this.client.pushMessage({
          to: msg.channelId,
          messages: [{ type: "text", text: truncateForLine(newText) }],
        }).catch(() => {});
      },
      delete: async () => {
        // LINE doesn't support message deletion via API — no-op
      },
    };
  }

  isAuthorized(userId: string): boolean {
    return isAllowedLineUser(userId);
  }

  /**
   * Wait for a user response via the pending response queue.
   * Called by askQuestion() — the webhook handler feeds responses via handlePendingResponse().
   */
  waitForUserResponse(userId: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(userId);
        resolve("(timeout)");
      }, timeoutMs);

      this.pendingResponses.set(userId, { resolve, timeout });
    });
  }

  /**
   * Called by the webhook handler when a user sends a message
   * while we're waiting for a response to askQuestion().
   * Returns true if the message was consumed as a pending response.
   */
  handlePendingResponse(userId: string, text: string): boolean {
    const pending = this.pendingResponses.get(userId);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pendingResponses.delete(userId);
    pending.resolve(text);
    return true;
  }

  /**
   * Reply using replyToken (immediate response, one-time use).
   * Used for the initial "processing..." acknowledgment.
   */
  async replyWithToken(replyToken: string, text: string): Promise<void> {
    await this.client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: truncateForLine(text) }],
    });
  }
}
