export type PlatformType = "discord" | "line";

/** Platform-agnostic incoming message */
export interface PlatformMessage {
  platform: PlatformType;
  userId: string;
  displayName: string;
  channelId: string;
  content: string;
  raw: unknown; // Discord Message | LINE WebhookEvent
}

/** Rich message abstraction (Discord Embed / LINE Flex Message) */
export interface RichMessage {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
}

/** Interactive question (Claude AskUserQuestion bridge) */
export interface InteractiveQuestion {
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
}

/** File attachment abstraction */
export interface FileAttachment {
  name: string;
  content: Buffer;
}

/** Editable progress message handle */
export interface ProgressHandle {
  update(text: string): Promise<void>;
  delete(): Promise<void>;
}

/** Platform adapter — each platform implements this */
export interface PlatformAdapter {
  readonly platform: PlatformType;
  readonly maxMessageLength: number;
  reply(msg: PlatformMessage, text: string): Promise<void>;
  replyRich(msg: PlatformMessage, rich: RichMessage): Promise<void>;
  replyWithFile(msg: PlatformMessage, text: string, file: FileAttachment): Promise<void>;
  showTyping(msg: PlatformMessage): { stop: () => void };
  askQuestion(msg: PlatformMessage, question: InteractiveQuestion): Promise<string>;
  sendProgress(msg: PlatformMessage, text: string): Promise<ProgressHandle>;
  isAuthorized(userId: string): boolean;
}
