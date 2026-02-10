import { Client, Collection, Message, TextBasedChannel } from "discord.js";

// --- Command system (discord.py Cog 대응) ---

export interface CommandContext {
  message: Message;
  args: string[];
  client: BotClient;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  execute: (ctx: CommandContext) => Promise<void>;
}

// --- Bot client (커스텀 속성 확장) ---

export interface BotClient extends Client {
  commands: Collection<string, PrefixCommand>;
  aliases: Collection<string, string>;
  selectedCli: string;
  workingDir: string;
}

// --- CLI tool config ---

export interface CliTool {
  command: string;
  maxTimeout: number;
  name: string;
  rulesFile: string;
  /** 메시지 전달 방식: ["-p"] → `cli -p "msg"`, ["run"] → `cli run "msg"` */
  promptArgs: string[];
  extraFlags: string[];
  resumeFlag: string | null;
  /** 두 번째 메시지부터 추가할 세션 계속 플래그 (e.g. "-c") */
  continueFlag: string | null;
  jsonOutput: boolean;
  /** true = use Agent SDK instead of subprocess */
  useAgentSdk: boolean;
  /** true = use stream-json output format (Gemini CLI) */
  useStreamJson?: boolean;
}

// --- Session stats & history ---

export interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  history: HistoryEntry[];
}

// --- Session manager interface ---

export interface SessionInfo {
  name?: string; // 멀티세션용 세션 이름
  cliName: string;
  toolName: string;
  cwd: string;
  isBusy: boolean;
  messageCount: number;
  startedAt: number;
  sessionId: string | null;
  stats?: SessionStats;
}

// --- Multi-session manager interface ---

export interface NamedSession {
  name: string; // 세션 이름 (예: "work", "default")
  cliName: string; // CLI 도구 (예: "claude", "opencode")
  manager: ISessionManager; // 실제 세션 매니저
  createdAt: number; // 생성 시간
  lastUsedAt: number; // 마지막 사용 시간
}

export interface ISessionManager {
  readonly isBusy: boolean;
  sendMessage(message: string, discordMessage: Message): Promise<string>;
  kill(): Promise<boolean>;
  newSession(): Promise<void>;
  getInfo(): SessionInfo;
  getStats(): SessionStats;
  getHistory(limit?: number): HistoryEntry[];
  cleanup(): Promise<void>;
}
