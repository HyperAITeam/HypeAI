# AIDevelop — Discord AI CLI Gateway Bot

Discord 메시지를 통해 내 Windows PC에서 실행 중인 AI CLI 도구(Claude Code, Gemini CLI, OpenCode)에
명령을 전달하고 응답을 받아오는 봇입니다.

```
[Discord 메시지] → [내 PC의 봇] → [AI CLI 도구에 전달] → [응답을 Discord로 반환]
```

**Claude Code**는 Agent SDK를 통해 직접 통신하며, AI가 질문할 때 Discord 버튼/셀렉트 메뉴로 응답할 수 있습니다.
**Gemini CLI / OpenCode**는 subprocess 방식으로 동작합니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Discord 봇 생성](#2-discord-봇-생성)
3. [프로젝트 설치](#3-프로젝트-설치)
4. [환경 설정 (.env)](#4-환경-설정-env)
5. [봇 실행](#5-봇-실행)
6. [명령어 사용법](#6-명령어-사용법)
7. [세션 관리](#7-세션-관리)
8. [TUI 대화형 응답 (Claude 전용)](#8-tui-대화형-응답-claude-전용)
9. [프로젝트 구조](#9-프로젝트-구조)
10. [동작 원리](#10-동작-원리)
11. [보안](#11-보안)
12. [FAQ / 문제 해결](#12-faq--문제-해결)

---

## 1. 사전 준비

아래 프로그램들이 설치되어 있어야 합니다:

| 프로그램 | 확인 명령 | 설치 방법 |
|----------|-----------|-----------|
| **Node.js 18+** | `node --version` | https://nodejs.org/ |
| **AI CLI 도구** (1개 이상) | 아래 참고 | 각 도구 공식 문서 |

> **중요**: exe 파일로 실행하더라도 **Node.js는 반드시 설치**되어 있어야 합니다.
> Claude Code Agent SDK가 내부적으로 `node cli.js`를 subprocess로 실행하기 때문입니다.

### Claude Code 사용 시 추가 요구사항

| 항목 | 설명 |
|------|------|
| **ANTHROPIC_API_KEY** | Anthropic API 키. `.env` 파일 또는 시스템 환경변수에 설정 |
| **cli.js** | Agent SDK 런타임 파일. exe 실행 시 exe와 같은 폴더에 있어야 함 |

```bash
# API 키 설정 (시스템 환경변수)
set ANTHROPIC_API_KEY=sk-ant-xxxxx

# 또는 .env 파일에 추가
echo ANTHROPIC_API_KEY=sk-ant-xxxxx >> .env
```

### AI CLI 도구 설치 확인

사용할 CLI 도구가 설치되어 있는지 확인:

```bash
# Claude Code
claude --version

# Gemini CLI
gemini --version

# OpenCode
opencode --version
```

> 최소 1개 이상 설치되어 있어야 합니다.

---

## 2. Discord 봇 생성

### 2-1. 봇 애플리케이션 만들기

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속
2. **New Application** 클릭 → 이름 입력 (예: `AIDevelop`) → **Create**
3. 왼쪽 메뉴에서 **Bot** 클릭
4. **Reset Token** 클릭 → 토큰 복사 (이후 `.env`에 사용)

> 토큰은 비밀번호와 같습니다. 절대 공유하지 마세요!

### 2-2. 봇 권한 설정

**Bot** 페이지에서:

- `MESSAGE CONTENT INTENT` → **켜기** (필수!)
- `PRESENCE INTENT` → 켜기 (선택)
- `SERVER MEMBERS INTENT` → 켜기 (선택)

### 2-3. 봇을 서버에 초대

1. 왼쪽 메뉴에서 **OAuth2** 클릭
2. **OAuth2 URL Generator** 에서:
   - **SCOPES**: `bot` 체크
   - **BOT PERMISSIONS**: `Send Messages`, `Read Message History`, `Attach Files`, `Embed Links` 체크
3. 생성된 URL을 브라우저에서 열어 서버에 초대

### 2-4. 내 Discord 유저 ID 확인

1. Discord 설정 → 고급 → **개발자 모드** 켜기
2. 내 프로필 우클릭 → **ID 복사**

---

## 3. 프로젝트 설치

### 방법 A: setup.bat 사용 (간편)

```
setup.bat
```

자동으로:
- Node.js 확인
- 의존성 설치 (`npm install`)
- `.env` 파일 생성 (토큰, 유저ID 입력)

### 방법 B: 수동 설치

```bash
# 1. 의존성 설치
npm install

# 2. .env 파일 생성
copy .env.example .env

# 3. .env 파일 편집 (메모장 등으로)
notepad .env
```

---

## 4. 환경 설정 (.env)

`.env` 파일을 열어 아래 값들을 설정합니다:

```ini
# [필수] Discord 봇 토큰 (2단계에서 복사한 값)
DISCORD_BOT_TOKEN=여기에_봇_토큰_붙여넣기

# [필수] 허가된 Discord 유저 ID (여러 명이면 쉼표로 구분)
ALLOWED_USER_IDS=123456789012345678

# [Claude 사용 시 필수] Anthropic API 키 (시스템 환경변수로도 설정 가능)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# [선택] 명령어 접두사 (기본: !)
COMMAND_PREFIX=!

# [선택] CMD 명령 타임아웃 - 초 (기본: 30)
COMMAND_TIMEOUT=30

# [선택] AI CLI 타임아웃 - 초 (기본: 300 = 5분)
AI_CLI_TIMEOUT=300
```

### 설정값 설명

| 변수 | 필수 | 기본값 | 설명 |
|------|:----:|--------|------|
| `DISCORD_BOT_TOKEN` | O | — | Discord 봇 토큰 |
| `ALLOWED_USER_IDS` | O | — | 봇 사용 허가 유저 ID (쉼표 구분) |
| `ANTHROPIC_API_KEY` | Claude 사용 시 | — | Anthropic API 키 (시스템 환경변수로도 설정 가능) |
| `COMMAND_PREFIX` | | `!` | 명령어 접두사 |
| `COMMAND_TIMEOUT` | | `30` | `!exec` 명령 타임아웃 (초) |
| `AI_CLI_TIMEOUT` | | `300` | AI CLI 응답 타임아웃 (초) |

---

## 5. 봇 실행

### 방법 A: exe 파일 실행 (권장)

[GitHub Releases](../../releases/latest)에서 다운로드 후 실행합니다.

**필요한 파일** (같은 폴더에 배치):
```
my-bot-folder/
├── aidevelop-bot.exe    ← 실행파일
├── cli.js               ← Claude Agent SDK 런타임 (필수!)
└── .env                 ← 설정 파일 (첫 실행 시 자동 생성)
```

> `cli.js`가 없으면 Claude Code 선택 시 에러가 발생합니다.
> Gemini CLI / OpenCode만 사용한다면 `cli.js`는 필요 없습니다.

### 방법 B: start_bot.bat 더블클릭

```
start_bot.bat
```

### 방법 C: 직접 실행

```bash
npx tsx src/bot.ts
```

### 첫 실행 시 자동 셋업

`.env` 파일이 없으면 자동으로 초기 설정 화면이 표시됩니다:

```
================================================
  초기 설정 — .env 파일 생성
================================================

  .env 파일이 없습니다. 필수 정보를 입력해주세요.

  [1/2] Discord 봇 토큰: MTIz...
  [2/2] Discord 유저 ID: 123456789012345678

  .env 파일이 생성되었습니다!
```

설정 완료 후 바로 아래 CLI 선택 화면으로 이어집니다.
이미 `.env`가 있으면 이 단계는 자동으로 건너뜁니다.

### 실행 시 설정 화면

```
================================================
  AI CLI Gateway Bot
================================================

  [1/2] Select AI CLI tool:

    1) Claude Code  (claude)
    2) Gemini CLI   (gemini)
    3) OpenCode     (opencode)

  Enter number [1-3] (default: 1): 1
  -> Claude Code selected!

  [2/2] Enter working directory:
        (The folder where Claude Code will run)

  Path (default: C:\Osgood\AIDevelop): C:\MyProject
  -> Working directory: C:\MyProject

================================================
  Claude Code  @  C:\MyProject
================================================

  [CLAUDE.md] Created C:\MyProject\CLAUDE.md
```

봇이 시작되면:
1. **AI CLI 도구 선택** — 사용할 도구 번호 입력 (기본: 1번 Claude)
2. **작업 폴더 입력** — AI가 작업할 프로젝트 폴더 경로 입력
3. **규칙 파일 자동 생성** — 선택한 CLI에 맞는 규칙 파일 생성 (CLAUDE.md / GEMINI.md / AGENTS.md)
4. **Discord 연결** — 봇이 서버에 접속, 상태에 `Claude Code @ MyProject` 표시

> 규칙 파일은 AI가 해당 폴더 안에서만 작업하도록 제한합니다.

---

## 6. 명령어 사용법

### 전체 명령어 목록

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `!ask <메시지>` | `!a` | AI CLI에 메시지 전달 |
| `!session info` | `!s info`, `!s` | 현재 세션 정보 |
| `!session new` | `!s new` | 세션 초기화 (새 대화 시작) |
| `!session kill` | `!s kill`, `!s stop` | 실행 중인 CLI 프로세스 강제 종료 |
| `!exec <명령>` | `!run`, `!cmd` | Windows CMD 명령 실행 |
| `!status` | `!sysinfo` | PC 시스템 정보 표시 |
| `!help` | — | 전체 명령어 목록 표시 |

### AI CLI 명령

```
!ask 이 프로젝트의 구조를 설명해줘
!a index.html 파일 만들어줘
!ask 방금 만든 파일에 CSS 스타일 추가해줘
```

- 첫 번째 메시지에서 새 대화가 시작됩니다
- 이후 메시지는 **이전 대화를 이어갑니다** (세션 유지, Claude 전용)
- AI가 응답하는 동안 Discord에 "입력 중..." 표시됩니다
- 응답에 현재 **작업 폴더명**이 함께 표시됩니다 (예: `Claude Code @ MyProject`)
- AI가 이미 처리 중일 때 `!ask`를 보내면 "이미 처리 중" 안내가 나옵니다

### CMD 명령 실행

```
!exec dir
!exec git status
!run node --version
!cmd ipconfig
```

- 위험한 명령은 차단됩니다 (`format`, `diskpart`, `shutdown` 등)
- 타임아웃: 기본 30초

### 시스템 상태

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `!status` | `!sysinfo` | PC 시스템 정보 표시 |

표시 정보: OS, CPU 사용률, 메모리, 업타임, Node.js 버전

---

## 7. 세션 관리

AI와의 대화는 **세션** 단위로 관리됩니다.

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `!session info` | `!s info`, `!s` | 현재 세션 정보 (상태, 메시지 수, 경과 시간, 세션ID) |
| `!session new` | `!s new` | 세션 초기화 (실행 중인 프로세스 종료 + 새 대화 시작) |
| `!session kill` | `!s kill`, `!s stop` | 실행 중인 CLI 프로세스 강제 종료 |

### 세션 동작 방식

```
!ask 안녕         ← 새 세션 시작 (session_id 저장)
!ask 이어서 설명해줘  ← 같은 세션 이어감 (resume session_id)
!ask 코드 고쳐줘     ← 같은 세션 이어감

!session new       ← 세션 초기화 (session_id 리셋)

!ask 새로운 주제     ← 새 세션 시작
```

> Gemini CLI / OpenCode는 세션 재개를 지원하지 않으므로, 매 `!ask`가 독립된 대화입니다.

### 세션 상태

`!session info` 에서 표시되는 상태:

| 상태 | 의미 |
|------|------|
| **New** | 아직 메시지를 보내지 않은 초기 상태 |
| **Active** | 대화가 진행 중인 세션 (이전 대화 이어가기 가능) |
| **Processing...** | AI CLI가 현재 응답을 생성하는 중 |

---

## 8. TUI 대화형 응답 (Claude 전용)

Claude Code를 사용할 때, AI가 사용자에게 질문을 하면 (예: "어떤 방식으로 할까요?")
Discord에서 **버튼** 또는 **셀렉트 메뉴**로 선택지가 표시됩니다.

### 동작 흐름

```
!ask 이 프로젝트를 리팩토링해줘
         │
         ▼
   Claude가 질문 생성 (AskUserQuestion)
         │
         ▼
   ┌─────────────────────────────────┐
   │ Claude asks:                     │
   │ "어떤 방식으로 리팩토링할까요?"    │
   │                                 │
   │ [파일 분리] [함수 추출] [클래스 전환] │  ← Discord 버튼
   └─────────────────────────────────┘
         │
   사용자가 [함수 추출] 클릭
         │
         ▼
   Claude가 함수 추출 방식으로 진행
         │
         ▼
   최종 결과를 Discord에 전송
```

- 선택지가 **4개 이하**: 버튼으로 표시
- 선택지가 **5개 이상**: 셀렉트 메뉴(드롭다운)로 표시
- **60초 타임아웃**: 시간 내에 선택하지 않으면 첫 번째 옵션이 자동 선택됩니다
- 선택 후 버튼이 비활성화되고 어떤 옵션을 선택했는지 표시됩니다

> Gemini CLI / OpenCode는 이 기능을 지원하지 않습니다 (subprocess 방식).

---

## 9. 프로젝트 구조

```
C:\Osgood\AIDevelop\
├── package.json              # Node.js 의존성
├── tsconfig.json             # TypeScript 설정
├── .env.example              # 환경변수 템플릿
├── .env                      # 실제 토큰/설정 (git-ignored)
├── setup.bat                 # Windows 설치 스크립트
├── start_bot.bat             # Windows 실행 스크립트
├── .gitignore
│
└── src/
    ├── bot.ts                # 엔트리포인트 (봇 시작, CLI/폴더 선택, 커맨드 디스패치)
    ├── config.ts             # 설정 (.env 로딩, CLI 도구 정의)
    ├── types.ts              # 타입 정의 (PrefixCommand, BotClient, ISessionManager)
    │
    ├── commands/             # Discord 명령어 모듈
    │   ├── ask.ts            # !ask — AI CLI에 메시지 전달
    │   ├── session.ts        # !session — 세션 관리 (info/new/kill)
    │   ├── exec.ts           # !exec — CMD 명령 실행
    │   ├── status.ts         # !status — 시스템 정보
    │   └── help.ts           # !help — 도움말
    │
    ├── sessions/             # AI CLI 세션 관리
    │   ├── types.ts          # ISessionManager 인터페이스
    │   ├── claude.ts         # Claude Agent SDK 세션 (TUI 대응)
    │   └── subprocess.ts     # Gemini/OpenCode subprocess 세션
    │
    └── utils/                # 유틸리티
        ├── discordPrompt.ts  # AskUserQuestion → Discord 버튼/셀렉트 메뉴
        ├── formatter.ts      # Discord 출력 포맷 (2000자 제한 처리)
        ├── security.ts       # 유저 화이트리스트, 명령어 블랙리스트
        ├── subprocess.ts     # 비동기 subprocess 래퍼 (!exec 용)
        └── typing.ts         # 타이핑 인디케이터 헬퍼
```

---

## 10. 동작 원리

### Claude Code 흐름 (Agent SDK)

```
유저: !ask 파일 만들어줘
         │
         ▼
    [commands/ask.ts]
    권한 확인 + 중복 요청 방지
         │
         ▼
    [sessions/claude.ts]
    Agent SDK query() 호출:
      - prompt: "파일 만들어줘"
      - cwd: 작업 디렉토리
      - resume: session_id (있으면)
      - canUseTool 콜백 등록
         │
         ▼
    Claude Code가 작업 수행
         │
    ┌────┴────┐
    │         │
  질문 발생   작업 완료
    │         │
    ▼         ▼
  [canUseTool]  [result message]
  Discord 버튼   최종 텍스트 추출
  사용자 선택     session_id 저장
    │         │
    └────┬────┘
         │
         ▼
    [utils/formatter.ts]
    2000자 초과 시 → .txt 파일 첨부
         │
         ▼
    Discord에 응답 전송
    (접두사: Claude Code @ 폴더명)
```

### Gemini CLI / OpenCode 흐름 (subprocess)

```
유저: !ask 파일 만들어줘
         │
         ▼
    [commands/ask.ts]
    권한 확인 + 중복 요청 방지
         │
         ▼
    [sessions/subprocess.ts]
    명령어 생성:
      gemini -p "파일 만들어줘" --yolo
         │
         ▼
    [child_process.spawn — shell: true]
    CLI가 작업 수행 → 텍스트 출력 반환
    (타임아웃 시 프로세스 자동 종료)
         │
         ▼
    Discord에 응답 전송
```

### CLI별 통신 방식 비교

| | Claude Code | Gemini CLI | OpenCode |
|---|---|---|---|
| **통신** | Agent SDK (`query()`) | subprocess | subprocess |
| **세션 재개** | O (`resume`) | X | X |
| **TUI 질문 대응** | O (Discord 버튼) | X | X |
| **권한 자동 승인** | `bypassPermissions` | `--yolo` 플래그 | — |
| **출력 형식** | SDK 메시지 스트림 | plain text | plain text |

### 규칙 파일 자동 생성

봇 실행 시 작업 폴더에 규칙 파일을 자동 생성합니다:

| 선택한 CLI | 생성 파일 | 용도 |
|-----------|-----------|------|
| Claude Code | `CLAUDE.md` | Claude Code가 읽는 프로젝트 규칙 |
| Gemini CLI | `GEMINI.md` | Gemini CLI가 읽는 프로젝트 규칙 |
| OpenCode | `AGENTS.md` | OpenCode가 읽는 프로젝트 규칙 |

---

## 11. 보안

### 3단계 보안 구조

```
[1층] Discord 유저 화이트리스트
       └─ ALLOWED_USER_IDS에 등록된 사용자만 명령 가능

[2층] 명령어 블랙리스트 (!exec 전용)
       └─ format, diskpart, shutdown 등 위험 명령 차단

[3층] AI 작업 디렉토리 제한
       └─ 규칙 파일(CLAUDE.md 등)으로 지정 폴더 내에서만 작업
```

### 차단되는 CMD 명령어

`!exec`로 실행할 수 없는 명령어:

```
format, diskpart, shutdown, restart,
del /s, rd /s, rmdir /s,
reg delete, bcdedit, cipher /w,
net user, net localgroup
```

### 권한 자동 승인

| CLI | 방식 | 설명 |
|-----|------|------|
| Claude Code | Agent SDK `bypassPermissions` | SDK 레벨에서 모든 도구 사용 자동 승인 |
| Gemini CLI | `--yolo` 플래그 | 모든 도구 호출 자동 승인 |
| OpenCode | — | 추가 플래그 없음 |

---

## 12. FAQ / 문제 해결

### Q: exe 실행 시 "cli.js 파일을 찾을 수 없습니다" 에러
- `cli.js` 파일이 exe와 **같은 폴더**에 있어야 합니다
- [GitHub Releases](../../releases/latest)에서 `cli.js`를 함께 다운로드하세요
- 직접 빌드하는 경우 `build.bat`이 자동으로 `dist/` 폴더에 복사합니다
- Gemini CLI / OpenCode만 사용한다면 `cli.js`는 필요 없습니다

### Q: exe 실행 시 "Node.js가 설치되어 있지 않습니다" 에러
- Claude Code는 Agent SDK가 내부적으로 `node cli.js`를 실행하므로 **Node.js v18+** 필수
- https://nodejs.org/ 에서 설치 후 새 CMD 창에서 exe를 다시 실행하세요
- `node --version`으로 정상 설치 확인

### Q: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다" 경고
- Claude Code 사용 시 Anthropic API 키가 필요합니다
- 설정 방법 (택 1):
  - `.env` 파일에 `ANTHROPIC_API_KEY=sk-ant-xxxxx` 추가
  - Windows 시스템 환경변수에 `ANTHROPIC_API_KEY` 등록

### Q: exe만 있으면 아무것도 설치 안 해도 되나요?
- **아닙니다.** exe는 Discord 봇 부분만 포함합니다
- Claude Code 사용 시 필요한 것:
  1. `cli.js` — exe와 같은 폴더에 배치
  2. **Node.js v18+** — 시스템에 설치
  3. **ANTHROPIC_API_KEY** — 환경변수 설정
- Gemini CLI / OpenCode 사용 시에는 해당 CLI가 전역 설치되어 있어야 합니다

### Q: 봇이 응답하지 않아요
- `.env`의 `DISCORD_BOT_TOKEN`이 올바른지 확인
- Discord Developer Portal에서 `MESSAGE CONTENT INTENT`가 켜져 있는지 확인
- `ALLOWED_USER_IDS`에 내 ID가 등록되어 있는지 확인

### Q: `!ask` 명령 시 "not installed or not in PATH" 에러
- 선택한 AI CLI 도구가 설치되어 있는지 확인
  ```bash
  claude --version
  gemini --version
  ```
- 설치 후 새 CMD 창에서 봇을 실행해야 PATH가 적용됩니다

### Q: AI 응답이 잘려요
- 2000자 초과 시 자동으로 `.txt` 파일로 첨부됩니다
- AI_CLI_TIMEOUT을 늘려야 할 수도 있습니다 (`.env`에서 변경)

### Q: "Request timed out" 에러
- `.env`에서 `AI_CLI_TIMEOUT` 값을 늘려주세요 (기본: 300초 = 5분)
- 복잡한 작업은 시간이 오래 걸릴 수 있습니다

### Q: 다른 폴더에서 작업하고 싶어요
- 봇을 종료 (`Ctrl+C`) 후 다시 실행하면 폴더를 다시 선택할 수 있습니다

### Q: 새 대화를 시작하고 싶어요
- `!session new` 명령으로 세션을 초기화하세요
- 다음 `!ask` 메시지부터 새 대화가 시작됩니다

### Q: Claude가 질문했는데 버튼이 안 보여요
- Claude Code를 사용할 때만 TUI 대화형 응답이 지원됩니다
- Gemini CLI / OpenCode에서는 AI가 자체적으로 판단하여 진행합니다

### Q: Claude 질문에 응답 안 하면 어떻게 되나요?
- 60초 타임아웃 후 첫 번째 옵션이 자동 선택되고 "(timeout)" 표시됩니다
- Claude는 자동 선택된 옵션을 기반으로 계속 진행합니다

### Q: AI가 너무 오래 걸려요. 중간에 취소할 수 있나요?
- `!session kill` (또는 `!s stop`)로 실행 중인 프로세스를 즉시 종료할 수 있습니다
- 세션은 유지되므로 다음 `!ask`에서 이전 대화를 이어갈 수 있습니다

### Q: 봇을 종료해도 CLI 프로세스가 남아있나요?
- 아닙니다. 봇 종료 시 (`Ctrl+C`) 실행 중인 CLI 프로세스도 자동으로 종료됩니다

### Q: 봇을 종료하려면?
- CMD 창에서 `Ctrl+C`를 누르세요
- 실행 중인 AI CLI 프로세스가 있으면 자동으로 정리됩니다

### Q: 여러 사용자가 동시에 사용할 수 있나요?
- 현재 1개의 세션만 지원합니다 (모든 유저가 같은 대화를 공유)
- 여러 유저의 메시지가 같은 AI 대화에 섞일 수 있습니다

---

# 개발자 가이드

이 섹션부터는 코드를 수정하거나 확장하려는 개발자를 위한 내용입니다.

---

## 13. 핵심 인터페이스

### PrefixCommand — 커맨드 정의

```typescript
interface PrefixCommand {
  name: string;           // "ask"
  aliases?: string[];     // ["a"]
  description: string;    // 도움말에 표시
  execute: (ctx: CommandContext) => Promise<void>;
}
```

모든 커맨드 파일은 `PrefixCommand`를 `default export` 한다.

### BotClient — 확장된 Discord Client

```typescript
interface BotClient extends Client {
  commands: Collection<string, PrefixCommand>;
  aliases: Collection<string, string>;   // alias → command name 매핑
  selectedCli: string;                   // "claude" | "gemini" | "opencode"
  workingDir: string;                    // AI가 작업할 디렉토리 경로
}
```

### CliTool — CLI 도구 설정

```typescript
interface CliTool {
  command: string;          // 실행할 CLI 명령어명
  maxTimeout: number;       // 최대 실행 시간 (초)
  name: string;             // 표시 이름
  rulesFile: string;        // 규칙 파일명 (CLAUDE.md 등)
  extraFlags: string[];     // 추가 CLI 플래그
  resumeFlag: string | null; // 세션 재개 플래그 (Claude만 "--resume")
  jsonOutput: boolean;      // JSON 출력 파싱 여부
  useAgentSdk: boolean;     // true=Agent SDK, false=subprocess
}
```

### ISessionManager — 세션 관리 인터페이스

```typescript
interface ISessionManager {
  readonly isBusy: boolean;
  sendMessage(message: string, discordMessage: Message): Promise<string>;
  kill(): Promise<boolean>;
  newSession(): Promise<void>;
  getInfo(): SessionInfo;
  cleanup(): Promise<void>;
}
```

`bot.ts`의 `createSession()`이 `useAgentSdk` 값에 따라 `ClaudeSessionManager` 또는 `SubprocessSessionManager`를 반환한다.

---

## 14. 세션 내부 구조

### ClaudeSessionManager (Agent SDK)

`@anthropic-ai/claude-agent-sdk`의 async generator를 통해 통신한다.

```
sendMessage(prompt)
 ├─ AbortController 생성 (취소용)
 ├─ query(prompt, { resume: sessionId, canUseTool })
 │   ├─ canUseTool 콜백에서 AskUserQuestion 감지
 │   │   └─ handleAskUserQuestion() → Discord 버튼/셀렉트
 │   └─ 나머지 도구는 기본 허용
 ├─ 응답에서 session_id 추출 → 저장 (다음 호출 시 resume에 전달)
 └─ result 텍스트 반환
```

- **세션 유지**: `sessionId`를 저장 → 다음 `query()` 호출 시 `resume` 옵션으로 전달
- **취소**: `AbortController`로 진행 중인 쿼리 중단 (`!session kill`)
- **동시 실행 방지**: `isBusy` 플래그로 동시 요청 차단

### SubprocessSessionManager (Gemini/OpenCode)

매 메시지마다 CLI를 서브프로세스로 실행한다.

```
sendMessage(prompt)
 ├─ buildCommand() → ["gemini", "-p", "prompt", "--yolo"]
 ├─ spawn(command, { shell: true, cwd })
 ├─ stdout/stderr 버퍼 수집
 ├─ parseOutput() → { result, sessionId }
 └─ result 텍스트 반환
```

- **Windows 호환**: `shell: true` 필수 — npm 패키지의 `.cmd` 래퍼 때문
- **JSON 파싱**: `jsonOutput: true`이면 stdout에서 JSON 추출 (Claude subprocess용)
- **세션 재개**: `resumeFlag`가 null이면 세션 유지 불가 (Gemini/OpenCode)

---

## 15. Discord UI 브릿지 (discordPrompt.ts)

Claude의 `AskUserQuestion` 도구를 Discord 인터랙티브 컴포넌트로 변환하는 모듈.

```
handleAskUserQuestion(input, channel, userId)
 └─ for each question:
     └─ askSingleQuestion(question, channel, userId)
         ├─ 옵션 ≤ 4개 → 버튼 (ButtonBuilder)
         └─ 옵션 > 4개 → 셀렉트 메뉴 (StringSelectMenuBuilder)
```

| 항목 | 동작 |
|------|------|
| 타임아웃 | 60초, 초과 시 첫 번째 옵션 자동 선택 |
| 유저 검증 | 요청자만 클릭 가능 (interaction.user.id 체크) |
| 멀티셀렉트 | `multiSelect: true`이면 `setMaxValues()` 적용 |
| 반환값 | `{ questions, answers: { [question]: selectedLabel } }` |

---

## 16. 유틸리티 함수

### formatter.ts

| 함수 | 설명 |
|------|------|
| `formatOutput(stdout, stderr, code)` | stdout + stderr 결합, 종료 코드 포함 |
| `sendResult(message, content, options)` | ≤2000자: 코드블록 전송, >2000자: 미리보기 + `.txt` 파일 첨부 |

### security.ts

| 함수 | 설명 |
|------|------|
| `isAllowedUser(userId)` | `ALLOWED_USER_IDS` 화이트리스트 체크 (빈 Set = 전체 허용) |
| `isCommandBlocked(command)` | `BLOCKED_COMMANDS`에 포함된 위험 명령어 차단 |

### typing.ts

| 함수 | 설명 |
|------|------|
| `withTyping<T>(message, fn)` | 비동기 함수 실행 동안 타이핑 인디케이터 표시 (8초 간격 갱신, Discord 10초 만료 대응) |

### subprocess.ts (utils/)

| 함수 | 설명 |
|------|------|
| `runCommand(command, options)` | 셸 명령어 실행 → `{ code, stdout, stderr }` 반환, 타임아웃 지원 |

---

## 17. 커맨드 추가 방법

### 1단계: 커맨드 파일 생성

`src/commands/ping.ts`:

```typescript
import type { PrefixCommand, CommandContext } from "../types.js";

const command: PrefixCommand = {
  name: "ping",
  aliases: ["p"],
  description: "봇 응답 확인",
  async execute(ctx: CommandContext) {
    await ctx.message.reply("Pong!");
  },
};

export default command;
```

### 2단계: bot.ts에 정적 import 추가

```typescript
// 상단 import 영역
import pingCommand from "./commands/ping.js";
```

### 3단계: allCommands 배열에 등록

```typescript
const allCommands: PrefixCommand[] = [
  askCommand, sessionCommand, execCommand,
  statusCommand, helpCommand, myidCommand,
  pingCommand,  // ← 추가
];
```

> 커맨드 로딩은 정적 import 방식이다.
> .exe 번들링 호환을 위해 동적 import를 제거했으므로 `bot.ts`에 직접 등록해야 한다.

---

## 18. CLI 도구 추가 방법

`src/config.ts`의 `CLI_TOOLS`에 새 항목을 추가한다:

```typescript
export const CLI_TOOLS: Record<string, CliTool> = {
  // ... 기존 도구들 ...
  aider: {
    command: "aider",
    maxTimeout: AI_CLI_TIMEOUT,
    name: "Aider",
    rulesFile: ".aider.conf.yml",
    extraFlags: ["--yes"],
    resumeFlag: null,        // 세션 재개 미지원
    jsonOutput: false,       // plain text 출력
    useAgentSdk: false,      // Agent SDK 없음 → subprocess
  },
};
```

| 필드 | 선택 기준 |
|------|----------|
| `useAgentSdk` | 전용 SDK가 있으면 `true`, 없으면 `false` (subprocess) |
| `resumeFlag` | CLI가 세션 재개를 지원하면 해당 플래그 (예: `"--resume"`), 미지원 시 `null` |
| `jsonOutput` | CLI가 JSON 출력을 지원하면 `true`, plain text면 `false` |
| `extraFlags` | CLI 실행 시 항상 붙일 플래그 (자동 승인 등) |

---

## 19. 빌드 & 배포

### 개발 모드

```bash
npm run dev          # tsx watch — 파일 변경 시 자동 재시작
npm run start        # tsx — 일반 실행
```

### TypeScript 타입 체크

```bash
npm run build        # tsc — 컴파일 (타입 에러 확인용)
```

### exe 빌드 (Bun --compile)

```bash
npm run build:exe    # bun build --compile → dist/aidevelop-bot.exe
# 또는
build.bat            # 배치 파일 (dist/ 생성 + cli.js 복사 + .env.example 복사)
```

#### 사전 요구

- [Bun](https://bun.sh/) — `npm install -g bun`

#### 배포 시 사용자 PC 필수 조건

| 항목 | 필요 여부 | 설명 |
|------|-----------|------|
| **Node.js v18+** | Claude Code 사용 시 필수 | Agent SDK가 `node cli.js`를 subprocess로 실행 |
| **ANTHROPIC_API_KEY** | Claude Code 사용 시 필수 | Anthropic API 인증용 환경변수 |
| **cli.js** | Claude Code 사용 시 필수 | exe와 같은 폴더에 배치해야 함 |

#### Bun을 사용하는 이유

| 후보 | ESM 지원 | 네이티브 모듈 | 상태 |
|------|---------|-------------|------|
| pkg | X | 문제多 | 유지보수 중단 |
| nexe | X | 문제多 | 오래됨 |
| Node.js SEA | X (CJS만) | 가능 | ESM 미지원 |
| **Bun --compile** | **O** | **O** | **활발** |

이 프로젝트는 ESM(`"type": "module"`)이고 네이티브 모듈(Agent SDK의 ripgrep.node, discord.js의 sharp.node)이 있으므로 Bun이 유일하게 현실적인 선택이다.

#### 빌드 시 고려사항

- **동적 import 제거**: .exe 번들에는 파일시스템이 없으므로 모든 커맨드를 정적 import로 전환 (완료)
- **dotenv 경로**: `process.cwd()` 기준으로 `.env`를 읽음 → .exe와 같은 폴더에 `.env` 필요
- **네이티브 모듈**: Bun --compile이 `.node` 파일을 자동으로 번들에 포함
- **cli.js 복사**: Agent SDK의 `cli.js`는 subprocess로 실행되므로 exe에 번들링되지 않음 → `build.bat`이 자동으로 `dist/`에 복사

#### 배포 산출물

```
dist/
├── aidevelop-bot.exe    # 실행파일 (~110MB)
├── cli.js               # Claude Agent SDK 런타임 (exe와 같은 폴더 필수)
└── .env.example         # 설정 템플릿
```

> **왜 cli.js가 별도 파일인가?**
> Agent SDK는 내부적으로 `node cli.js`를 자식 프로세스로 실행하여 Claude Code를 구동합니다.
> Bun이 exe를 빌드할 때 `import.meta.url`이 가상 경로(`~BUN/root/`)로 변환되어
> SDK가 자동으로 `cli.js`를 찾지 못합니다. 따라서 exe 옆에 물리적 파일이 필요합니다.

### GitHub Actions 자동 릴리스

`v*` 태그를 push하면 GitHub Actions가 자동으로 빌드 → Release 생성 → exe 업로드를 수행한다.

#### 워크플로우 (`/.github/workflows/release.yml`)

```
git tag v1.0.0 → git push origin v1.0.0
    │
    ▼
GitHub Actions (ubuntu-latest)
    ├─ oven-sh/setup-bun@v2
    ├─ bun install
    ├─ bun build --compile --target bun-windows-x64
    │   └─ Linux에서 Windows exe 크로스 컴파일
    └─ softprops/action-gh-release@v2
        └─ Release 생성 + aidevelop-bot.exe, cli.js, .env.example 업로드
```

- **러너**: `ubuntu-latest` — Bun의 `--target bun-windows-x64`로 Linux에서 Windows exe 크로스 컴파일 가능
- **트리거**: `v*` 패턴의 태그 push (예: `v1.0.0`, `v2.1.0-beta`)
- **권한**: `permissions: contents: write` — Release 생성에 필요

#### 릴리스 생성 방법

```bash
# 1. 태그 생성
git tag v1.0.0

# 2. 태그 push → GitHub Actions 자동 실행
git push origin v1.0.0
```

GitHub Actions 탭에서 빌드 진행 상황을 확인할 수 있으며, 완료 후 Releases 페이지에서 exe를 다운로드할 수 있다.

### CI 워크플로우 (`/.github/workflows/ci.yml`)

`main` 브랜치에 push 또는 PR이 올라오면 자동으로 타입 체크 + 테스트를 실행한다.

```
PR 생성 / push to main
    │
    ▼
GitHub Actions (ubuntu-latest, Node 18)
    ├─ npm ci
    ├─ tsc --noEmit     (타입 체크)
    └─ npm test         (vitest)
```

PR에 ✅/❌ 상태가 표시되어 코드 품질을 자동으로 검증한다.

---

## 20. 자동 셋업 & 설정 재로드

### setupEnv() — 첫 실행 자동 설정

`bot.ts`의 `setupEnv()`는 `.env` 파일이 없을 때 대화형으로 필수 값을 입력받아 생성한다.

```
main()
 ├─ setupEnv()
 │   ├─ .env 존재? → return (스킵)
 │   ├─ Discord 봇 토큰 입력
 │   ├─ Discord 유저 ID 입력
 │   ├─ .env 파일 생성
 │   └─ reloadConfig() 호출
 ├─ DISCORD_BOT_TOKEN 체크
 ├─ startupSetup() (CLI 선택 + 작업폴더)
 └─ client.login()
```

### reloadConfig() — ES 모듈 live binding

`config.ts`의 env 변수들은 `export let`으로 선언되어 있다.
ES 모듈에서 `export let`은 **live binding**을 생성하므로, 내보낸 모듈에서 값을 재할당하면 가져온 모듈에서도 즉시 반영된다.

```typescript
// config.ts
export let DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";

export function reloadConfig(): void {
  dotenv.config({ override: true });
  DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? ""; // 재할당 → 즉시 반영
}

// bot.ts
import { DISCORD_BOT_TOKEN, reloadConfig } from "./config.js";
reloadConfig(); // 호출 후 DISCORD_BOT_TOKEN이 새 값으로 갱신됨
```

이 방식으로 `.env` 파일 생성 후 프로세스 재시작 없이 모든 설정값이 갱신된다.

---

## 21. 주의사항 & 패턴

### Discord.js 타입 가드

```typescript
// TextChannel을 사용해야 .send()가 존재
import { TextChannel } from "discord.js";

// sendTyping()은 모든 채널 타입에 없으므로 런타임 가드 필요
if ("sendTyping" in channel) {
  await channel.sendTyping();
}
```

### Windows 서브프로세스

```typescript
// npm 패키지 CLI(.cmd 래퍼)는 shell: true 필수
spawn(command, args, { shell: true, windowsHide: true });

// 경로에 공백 포함 시 따옴표 처리
const escaped = arg.includes(" ") ? `"${arg}"` : arg;
```

### 세션 공유 패턴

`ask.ts`가 세션 참조를 갖고 있고, `session.ts`가 `getSession()`으로 같은 인스턴스에 접근한다:

```typescript
// ask.ts
let session: ISessionManager;
export function setSession(s: ISessionManager) { session = s; }
export function getSession() { return session; }

// bot.ts — 시작 시 연결
const session = createSession(cliName, workingDir);
setSession(session);

// session.ts — 세션 상태 조회
import { getSession } from "./ask.js";
const session = getSession();
```

### 데이터 흐름 요약

```
[Discord 메시지]
     │
     ▼
 bot.ts (MessageCreate 이벤트)
     │ cmdName + args 파싱
     ▼
 commands/*.ts (execute)
     │ 보안 체크 (security.ts)
     │ 타이핑 표시 (typing.ts)
     ▼
 sessions/*.ts (sendMessage)
     │ Claude: Agent SDK query()
     │ Others: subprocess spawn()
     ▼
 utils/formatter.ts (sendResult)
     │ ≤2000자: 코드블록
     │ >2000자: .txt 첨부
     ▼
 [Discord 응답]
```
