import type { Message } from "discord.js";
import type { ISessionManager } from "./types.js";
import type { NamedSession } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { createSession } from "../bot.js";
import { wrapWithSecurityContext } from "../utils/promptGuard.js";
import { cleanupUploads } from "../utils/fileUpload.js";

/**
 * 멀티 세션 매니저
 * 여러 개의 명명된 세션을 동시에 관리
 */
export class MultiSessionManager {
  private sessions: Map<string, NamedSession> = new Map();
  private activeSessionName: string = "default";
  private workingDir: string;

  constructor(workingDir: string) {
    this.workingDir = workingDir;
  }

  /**
   * 세션 이름 유효성 검사
   */
  private isValidSessionName(name: string): boolean {
    if (!name || name.trim() === "") return false;
    if (name.length > 32) return false;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return false;
    return true;
  }

  /**
   * 새 세션 생성
   */
  createSession(name: string, cliName: string): NamedSession {
    if (!this.isValidSessionName(name)) {
      throw new Error(
        `Invalid session name: '${name}'. Use only letters, numbers, hyphens, underscores (max 32 chars).`,
      );
    }

    if (this.sessions.has(name)) {
      throw new Error(`Session '${name}' already exists.`);
    }

    if (!CLI_TOOLS[cliName]) {
      const available = Object.keys(CLI_TOOLS).join(", ");
      throw new Error(`Unknown CLI: '${cliName}'. Available: ${available}`);
    }

    const manager = createSession(cliName, this.workingDir);

    const namedSession: NamedSession = {
      name,
      cliName,
      manager,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    this.sessions.set(name, namedSession);
    return namedSession;
  }

  /**
   * 세션 조회
   */
  getSession(name: string): NamedSession | undefined {
    return this.sessions.get(name);
  }

  /**
   * 세션 존재 여부 확인
   */
  hasSession(name: string): boolean {
    return this.sessions.has(name);
  }

  /**
   * 세션 삭제
   */
  async deleteSession(name: string): Promise<boolean> {
    const session = this.sessions.get(name);
    if (!session) return false;

    await session.manager.cleanup();
    this.sessions.delete(name);

    // 삭제된 세션이 활성 세션이었다면 default로 변경
    if (this.activeSessionName === name) {
      this.activeSessionName = "default";
    }

    return true;
  }

  /**
   * 모든 세션 목록
   */
  listSessions(): NamedSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 현재 활성 세션 조회 (없으면 default 생성)
   */
  getActiveSession(): NamedSession {
    let session = this.sessions.get(this.activeSessionName);

    // 활성 세션이 없으면 default 생성
    if (!session) {
      session = this.createSession("default", "claude");
      this.activeSessionName = "default";
    }

    return session;
  }

  /**
   * 활성 세션 변경
   */
  setActiveSession(name: string): void {
    if (!this.sessions.has(name)) {
      throw new Error(`Session '${name}' not found.`);
    }
    this.activeSessionName = name;
  }

  /**
   * 활성 세션 이름 조회
   */
  getActiveSessionName(): string {
    return this.activeSessionName;
  }

  /**
   * 메시지 전송
   * @param sessionName 세션 이름 (null이면 활성 세션 사용)
   */
  async sendMessage(
    sessionName: string | null,
    message: string,
    discordMessage: Message,
  ): Promise<string> {
    const targetName = sessionName ?? this.activeSessionName;
    let session = this.sessions.get(targetName);

    // 지정된 세션이 없고 default라면 lazy 생성
    if (!session && targetName === "default") {
      session = this.createSession("default", "claude");
    }

    if (!session) {
      throw new Error(
        `Session '${targetName}' not found. Create with: !session create ${targetName} <cli>`,
      );
    }

    if (session.manager.isBusy) {
      throw new Error(
        `Session '${targetName}' is processing. Use \`!session kill ${targetName}\` to cancel.`,
      );
    }

    session.lastUsedAt = Date.now();
    const wrappedMessage = wrapWithSecurityContext(message, this.workingDir);
    return session.manager.sendMessage(wrappedMessage, discordMessage);
  }

  /**
   * 특정 세션 프로세스 종료
   */
  async killSession(name: string): Promise<boolean> {
    const session = this.sessions.get(name);
    if (!session) return false;
    return session.manager.kill();
  }

  /**
   * 특정 세션 초기화 (새 세션으로)
   */
  async newSession(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (!session) {
      throw new Error(`Session '${name}' not found.`);
    }
    await session.manager.newSession();
  }

  /**
   * 모든 세션 정리 + 오래된 업로드 파일 삭제
   */
  async cleanup(): Promise<void> {
    const cleanups = Array.from(this.sessions.values()).map((s) => s.manager.cleanup());
    await Promise.all(cleanups);
    this.sessions.clear();

    // Clean up uploaded files (delete all — age 0)
    const cleaned = cleanupUploads(this.workingDir, 0);
    if (cleaned > 0) {
      console.log(`[cleanup] Deleted ${cleaned} uploaded file(s).`);
    }
  }
}

// 전역 멀티세션 매니저 인스턴스
let multiSessionManager: MultiSessionManager | null = null;

export function setMultiSessionManager(manager: MultiSessionManager): void {
  multiSessionManager = manager;
}

export function getMultiSessionManager(): MultiSessionManager | null {
  return multiSessionManager;
}
