import type { PlatformMessage, PlatformAdapter } from "./types.js";

export interface CrossPlatformContext {
  message: PlatformMessage;
  args: string[];
  adapter: PlatformAdapter;
  selectedCli: string;
  workingDir: string;
}
