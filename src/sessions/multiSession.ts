import type { Message } from "discord.js";
import type { ISessionManager } from "./types.js";
import type { NamedSession } from "../types.js";
import { CLI_TOOLS } from "../config.js";
import { createSession } from "../bot.js";
import { wrapWithSecurityContext } from "../utils/promptGuard.js";
import {
  saveSessionStore,
  loadSessionStore,
  getSessionStorePath,
  type SessionStoreData,
  type PersistedSession,
} from "../utils/sessionStore.js";
import { audit, AuditEvent } from "../utils/auditLog.js";
import { validateWorkingDir, getDefaultAllowedRoot } from "../utils/pathValidator.js";

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
   * Get allowed root directories for path validation.
   * By default, allows sibling directories of the initial workingDir.
   */
  private getAllowedRoots(): string[] {
    return [getDefaultAllowedRoot(this.workingDir)];
  }

  /**
   * 새 세션 생성
   * @param name - 세션 이름
   * @param cliName - CLI 도구 이름 (claude, gemini, opencode)
   * @param cwd - 작업 디렉터리 (선택, 미지정 시 기본 workingDir 사용)
   */
  createSession(name: string, cliName: string, cwd?: string): NamedSession {
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

    // Validate and normalize the working directory
    let sessionCwd = this.workingDir;
    if (cwd) {
      const validation = validateWorkingDir(cwd, this.workingDir, this.getAllowedRoots());
      if (!validation.valid) {
        throw new Error(`Invalid working directory: ${validation.error}`);
      }
      sessionCwd = validation.normalizedPath;
    }

    const manager = createSession(cliName, sessionCwd);

    const namedSession: NamedSession = {
      name,
      cliName,
      cwd: sessionCwd,
      manager,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    this.sessions.set(name, namedSession);
    this.schedulePersist();
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

    this.schedulePersist();
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
    onProgress?: (status: string) => void,
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
    // Use session-specific cwd for security context
    const sessionCwd = session.cwd;
    const wrappedMessage = wrapWithSecurityContext(message, sessionCwd);
    const result = await session.manager.sendMessage(wrappedMessage, discordMessage, onProgress);
    this.schedulePersist();
    return result;
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
    this.schedulePersist();
  }

  /**
   * 모든 세션 정리
   */
  async cleanup(): Promise<void> {
    const cleanups = Array.from(this.sessions.values()).map((s) => s.manager.cleanup());
    await Promise.all(cleanups);
    this.sessions.clear();
  }

  // --- Session Persistence ---

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debounced auto-save (2 seconds) */
  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistToDisk();
      this.persistTimer = null;
    }, 2000);
  }

  /** Save all sessions to disk */
  persistToDisk(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    const sessions: PersistedSession[] = [];
    for (const [, ns] of this.sessions) {
      const state = ns.manager.getPersistedState();
      sessions.push({
        name: ns.name,
        cliName: ns.cliName,
        cwd: ns.cwd,
        sessionId: state.sessionId,
        createdAt: ns.createdAt,
        lastUsedAt: ns.lastUsedAt,
        messageCount: state.messageCount,
        startedAt: state.startedAt,
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        history: state.history,
      });
    }

    const data: SessionStoreData = {
      version: 1,
      activeSessionName: this.activeSessionName,
      workingDir: this.workingDir,
      sessions,
      savedAt: Date.now(),
    };

    const storePath = getSessionStorePath(this.workingDir);
    saveSessionStore(storePath, data);
    audit(AuditEvent.SESSION_PERSISTED, "system", {
      details: { sessionCount: sessions.length },
    });
  }

  /** Restore sessions from disk. Returns number of restored sessions. */
  restoreFromDisk(): number {
    const storePath = getSessionStorePath(this.workingDir);
    const data = loadSessionStore(storePath);
    if (!data) return 0;

    let restored = 0;
    for (const ps of data.sessions) {
      if (!CLI_TOOLS[ps.cliName]) continue;
      if (this.sessions.has(ps.name)) continue;

      try {
        // Validate persisted cwd, fall back to default workingDir if invalid
        let sessionCwd = ps.cwd || this.workingDir;
        const validation = validateWorkingDir(sessionCwd, this.workingDir, this.getAllowedRoots());
        if (!validation.valid) {
          console.warn(`  [persist] Session '${ps.name}' cwd invalid (${validation.error}), using default`);
          sessionCwd = this.workingDir;
        } else {
          sessionCwd = validation.normalizedPath;
        }

        const manager = createSession(ps.cliName, sessionCwd);
        manager.restoreFromState({
          sessionId: ps.sessionId,
          messageCount: ps.messageCount,
          startedAt: ps.startedAt,
          totalInputTokens: ps.totalInputTokens,
          totalOutputTokens: ps.totalOutputTokens,
          history: ps.history,
        });

        const namedSession: NamedSession = {
          name: ps.name,
          cliName: ps.cliName,
          cwd: sessionCwd,
          manager,
          createdAt: ps.createdAt,
          lastUsedAt: ps.lastUsedAt,
        };

        this.sessions.set(ps.name, namedSession);
        restored++;
      } catch (err: any) {
        console.error(`  [persist] Failed to restore session '${ps.name}': ${err.message}`);
      }
    }

    if (data.activeSessionName && this.sessions.has(data.activeSessionName)) {
      this.activeSessionName = data.activeSessionName;
    }

    if (restored > 0) {
      audit(AuditEvent.SESSION_RESTORED, "system", {
        details: { restoredCount: restored },
      });
    }

    return restored;
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
