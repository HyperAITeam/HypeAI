import type { Message } from "discord.js";

/**
 * Run `fn` while showing a typing indicator in the channel.
 * Typing is refreshed every 8 s (Discord auto-expires after 10 s).
 */
export async function withTyping<T>(
  message: Message,
  fn: () => Promise<T>,
): Promise<T> {
  const channel = message.channel;

  // sendTyping may not exist on all channel types; guard it
  const doTyping = () => {
    if ("sendTyping" in channel && typeof channel.sendTyping === "function") {
      (channel.sendTyping as () => Promise<void>)().catch(() => {});
    }
  };

  doTyping();
  const interval = setInterval(doTyping, 8_000);

  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}
