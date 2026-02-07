# AI CLI Gateway Bot

Discord 메시지로 PC에 설치된 AI CLI 도구(Claude Code, Gemini CLI, OpenCode)를 원격 제어하는 봇.

## 요구 사항

- **Node.js** v18 이상 ([다운로드](https://nodejs.org/))
- **Discord Bot Token** ([Discord Developer Portal](https://discord.com/developers/applications)에서 생성)
- AI CLI 도구 중 하나 이상 설치:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @anthropic-ai/gemini-cli`
  - [OpenCode](https://opencode.ai/)

## 설치

### 방법 1: 배치 파일 (Windows)

`setup.bat` 더블클릭 — Node.js 확인, 의존성 설치, `.env` 파일 생성까지 자동으로 진행.

### 방법 2: 수동 설치

```bash
npm install
```

`.env.example`을 `.env`로 복사 후 값 입력:

```
DISCORD_BOT_TOKEN=여기에_봇_토큰
ALLOWED_USER_IDS=여기에_디스코드_유저ID
COMMAND_PREFIX=!
COMMAND_TIMEOUT=30
```

> Discord User ID를 모르면? 봇 실행 후 `!myid` 입력하면 알려줍니다.

## 실행

### 방법 1: 배치 파일

`start_bot.bat` 더블클릭

### 방법 2: 명령어

```bash
npx tsx src/bot.ts
```

실행하면 콘솔에서 두 가지를 선택합니다:

```
[1/2] Select AI CLI tool:
    1) Claude Code  (claude)
    2) Gemini CLI   (gemini)
    3) OpenCode     (opencode)

[2/2] Enter working directory:
    Path (default: C:\현재경로):
```

- **AI CLI 도구** — 어떤 AI를 사용할지 선택
- **작업 디렉토리** — AI가 코드를 읽고 수정할 폴더 경로

선택 완료 후 봇이 Discord에 접속합니다.

## 명령어

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `!ask <메시지>` | `!a` | AI에게 메시지 전송 |
| `!session info` | `!s` | 현재 세션 상태 확인 |
| `!session new` | `!s new` | 새 대화 시작 (세션 초기화) |
| `!session kill` | `!s stop` | 진행 중인 AI 프로세스 중단 |
| `!exec <명령어>` | `!run`, `!cmd` | CMD 명령어 실행 |
| `!status` | `!sysinfo` | 시스템 정보 표시 |
| `!myid` | `!id` | 내 Discord User ID 확인 |
| `!help` | | 도움말 표시 |

## 사용 예시

### AI에게 질문하기

```
!ask 이 프로젝트의 구조를 설명해줘
```

```
!a src/index.ts 파일에 에러 핸들링 추가해줘
```

### AI가 선택지를 물어볼 때 (Claude Code)

Claude가 작업 중 선택이 필요하면 Discord에 버튼이 나타납니다:

```
Claude가 질문합니다:
"어떤 방식으로 리팩토링할까요?"

[파일 분리] [함수 추출] [클래스 전환]  ← 버튼 클릭으로 응답
```

60초 내에 선택하지 않으면 첫 번째 옵션이 자동 선택됩니다.

### 세션 관리

```
!session info     ← 현재 상태 확인
!session new      ← 새 대화 시작
!session kill     ← 오래 걸리는 작업 중단
```

### CMD 명령어 실행

```
!exec dir
!run git status
!cmd npm test
```

## 설정 (.env)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `DISCORD_BOT_TOKEN` | O | — | Discord 봇 토큰 |
| `ALLOWED_USER_IDS` | O | — | 허용할 유저 ID (쉼표로 여러 명 가능) |
| `COMMAND_PREFIX` | X | `!` | 명령어 접두사 |
| `COMMAND_TIMEOUT` | X | `30` | CMD 명령어 타임아웃 (초) |
| `AI_CLI_TIMEOUT` | X | `300` | AI CLI 타임아웃 (초) |

### 여러 유저 허용

```
ALLOWED_USER_IDS=111111111111111111,222222222222222222
```

## Discord 봇 생성 방법

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. **New Application** → 이름 입력 → 생성
3. **Bot** 탭 → **Reset Token** → 토큰 복사 → `.env`에 붙여넣기
4. **Bot** 탭 → **Privileged Gateway Intents** 에서 아래 3개 활성화:
   - Presence Intent
   - Server Members Intent
   - **Message Content Intent** (필수)
5. **OAuth2** → **URL Generator** → Scopes: `bot` → Permissions: `Send Messages`, `Read Message History`, `Attach Files` → 생성된 URL로 서버에 초대

## 지원 CLI 도구

| 도구 | 방식 | TUI 응답 | 세션 유지 |
|------|------|----------|-----------|
| Claude Code | Agent SDK | O (Discord 버튼) | O (resume) |
| Gemini CLI | subprocess | X | X |
| OpenCode | subprocess | X | X |

- **Claude Code**: Agent SDK를 통해 직접 통신. AI가 질문하면 Discord 버튼으로 응답 가능.
- **Gemini CLI / OpenCode**: 서브프로세스로 실행. `-p "메시지"` 형태로 전달하고 출력을 수집.

## 문제 해결

| 증상 | 해결 |
|------|------|
| `You are not authorized` | `!myid`로 ID 확인 → `.env`의 `ALLOWED_USER_IDS`에 입력 → 봇 재시작 |
| `is not installed or not in PATH` | 해당 CLI 도구가 설치되어 있는지 확인 |
| 봇이 아무 반응 없음 | Discord Developer Portal에서 **Message Content Intent** 활성화했는지 확인 |
| 응답이 너무 길어서 잘림 | 2000자 초과 시 자동으로 `.txt` 파일로 첨부됨 |
