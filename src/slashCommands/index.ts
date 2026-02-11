import { REST, Routes, Collection, type ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "../types.js";

import askSlash from "./askSlash.js";
import sessionSlash from "./sessionSlash.js";
import execSlash from "./execSlash.js";
import taskSlash from "./taskSlash.js";
import statusSlash from "./statusSlash.js";
import helpSlash from "./helpSlash.js";

export interface SlashCommand {
  data: { toJSON(): unknown; name: string };
  execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
}

const allSlashCommands: SlashCommand[] = [
  askSlash,
  sessionSlash,
  execSlash,
  taskSlash,
  statusSlash,
  helpSlash,
];

export function getAllSlashCommands(): SlashCommand[] {
  return allSlashCommands;
}

export function buildSlashCollection(): Collection<string, SlashCommand> {
  const col = new Collection<string, SlashCommand>();
  for (const cmd of allSlashCommands) {
    col.set(cmd.data.name, cmd);
  }
  return col;
}

export async function registerSlashCommands(
  appId: string,
  token: string,
  guildId?: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = allSlashCommands.map((cmd) => cmd.data.toJSON());

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
    console.log(`  [slash] Registered ${body.length} guild commands (guild: ${guildId})`);
  } else {
    await rest.put(Routes.applicationCommands(appId), { body });
    console.log(`  [slash] Registered ${body.length} global commands`);
  }
}
