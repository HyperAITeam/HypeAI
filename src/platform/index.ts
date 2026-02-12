export type {
  PlatformType,
  PlatformMessage,
  RichMessage,
  InteractiveQuestion,
  FileAttachment,
  ProgressHandle,
  PlatformAdapter,
} from "./types.js";

export type { CrossPlatformContext } from "./context.js";

export { discordToPlatformMessage, getDiscordAdapter } from "./discordAdapter.js";
export { LineAdapter } from "./lineAdapter.js";
