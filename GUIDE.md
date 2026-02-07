# AIDevelop — Discord AI CLI Gateway Bot

Discord 메시지를 통해 내 Windows PC에서 실행 중인 AI CLI 도구(Claude Code, Gemini CLI, OpenCode)에
명령을 전달하고 응답을 받아오는 봇입니다.

```
[Discord 메시지] → [내 PC의 봇] → [AI CLI 도구에 전달] → [응답을 Discord로 반환]
```

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Discord 봇 생성](#2-discord-봇-생성)
3. [프로젝트 설치](#3-프로젝트-설치)
4. [환경 설정 (.env)](#4-환경-설정-env)
5. [봇 실행](#5-봇-실행)
6. [명령어 사용법](#6-명령어-사용법)
7. [세션 관리](#7-세션-관리)
8. [프로젝트 구조](#8-프로젝트-구조)
9. [동작 원리](#9-동작-원리)
10. [보안](#10-보안)
11. [FAQ / 문제 해결](#11-faq--문제-해결)

---

## 1. 사전 준비

아래 프로그램들이 설치되어 있어야 합니다:

| 프로그램 | 확인 명령 | 설치 방법 |
|----------|-----------|-----------|
| **Python 3.10+** | `python --version` | https://www.python.org/downloads/ |
| **AI CLI 도구** (1개 이상) | 아래 참고 | 각 도구 공식 문서 |

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

> ⚠️ 토큰은 비밀번호와 같습니다. 절대 공유하지 마세요!

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
- 의존성 설치 (`pip install`)
- `.env` 파일 생성 (토큰, 유저ID 입력)

### 방법 B: 수동 설치

```bash
# 1. 의존성 설치
pip install -r requirements.txt

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
| `DISCORD_BOT_TOKEN` | ✅ | — | Discord 봇 토큰 |
| `ALLOWED_USER_IDS` | ✅ | — | 봇 사용 허가 유저 ID (쉼표 구분) |
| `COMMAND_PREFIX` | | `!` | 명령어 접두사 |
| `COMMAND_TIMEOUT` | | `30` | `!exec` 명령 타임아웃 (초) |
| `AI_CLI_TIMEOUT` | | `300` | AI CLI 응답 타임아웃 (초) |

---

## 5. 봇 실행

### 방법 A: start_bot.bat 더블클릭

```
start_bot.bat
```

### 방법 B: 직접 실행

```bash
python bot.py
```

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
4. **Discord 연결** — 봇이 서버에 접속

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

| 명령어 | 별칭 | 설명 | 예시 |
|--------|------|------|------|
| `!ask <메시지>` | `!a` | AI CLI에 메시지 전달 | `!ask 안녕하세요` |

```
!ask 이 프로젝트의 구조를 설명해줘
!a index.html 파일 만들어줘
!ask 방금 만든 파일에 CSS 스타일 추가해줘
```

- 첫 번째 메시지에서 새 대화가 시작됩니다
- 이후 메시지는 **이전 대화를 이어갑니다** (세션 유지)
- AI가 응답하는 동안 Discord에 "입력 중..." 표시됩니다
- AI CLI 타임아웃: 기본 5분 (`.env`에서 변경 가능)
- AI가 이미 처리 중일 때 `!ask`를 보내면 "이미 처리 중" 안내가 나옵니다

### CMD 명령 실행

| 명령어 | 별칭 | 설명 | 예시 |
|--------|------|------|------|
| `!exec <명령>` | `!run`, `!cmd` | Windows CMD 명령 실행 | `!exec dir` |

```
!exec dir
!exec git status
!run python --version
!cmd ipconfig
```

- 위험한 명령은 차단됩니다 (`format`, `diskpart`, `shutdown` 등)
- 타임아웃: 기본 30초

### 시스템 상태

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `!status` | `!sysinfo` | PC 시스템 정보 표시 |

표시 정보: OS, CPU 사용률, 메모리, 디스크, 업타임, Python 버전

### 도움말

| 명령어 | 설명 |
|--------|------|
| `!help` | 전체 명령어 목록 표시 |

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
!ask 이어서 설명해줘  ← 같은 세션 이어감 (--resume session_id)
!ask 코드 고쳐줘     ← 같은 세션 이어감

!session new       ← 세션 초기화 (프로세스 종료 + session_id 리셋)

!ask 새로운 주제     ← 새 세션 시작
```

### 프로세스 관리

AI CLI가 응답하는 동안 별도의 프로세스가 실행됩니다:

- **실행 중 확인**: `!session info`에서 상태가 "Processing..."으로 표시
- **중복 방지**: AI가 처리 중일 때 `!ask`를 보내면 "이미 처리 중" 안내
- **강제 종료**: `!session kill`로 실행 중인 프로세스를 즉시 종료
- **자동 정리**: 봇 종료 시 (`Ctrl+C`) 실행 중인 CLI 프로세스도 자동 종료

### 세션 상태

`!session info` 에서 표시되는 상태:

| 상태 | 의미 |
|------|------|
| **New** | 아직 메시지를 보내지 않은 초기 상태 |
| **Active** | 대화가 진행 중인 세션 (이전 대화 이어가기 가능) |
| **Processing...** | AI CLI가 현재 응답을 생성하는 중 |

내부적으로:
- 첫 메시지: `claude -p "메시지" --output-format json`
- 이후 메시지: `claude -p "메시지" --resume <session_id> --output-format json`
- `!session new`: 프로세스 종료 + session_id 초기화
- `!session kill`: 프로세스만 종료 (세션은 유지)

---

## 8. 프로젝트 구조

```
C:\Osgood\AIDevelop\
├── bot.py                    # 엔트리포인트 (봇 시작, CLI/폴더 선택, 규칙파일 생성)
├── config.py                 # 설정 (.env 로딩, CLI 도구 정의, 차단 명령어)
├── requirements.txt          # Python 의존성
├── .env.example              # 환경변수 템플릿
├── .env                      # 실제 토큰/설정 (git-ignored)
├── setup.bat                 # Windows 설치 스크립트
├── start_bot.bat             # Windows 실행 스크립트
├── .gitignore
│
├── cogs/                     # Discord 명령어 모듈
│   ├── ai_cli.py             # !ask, !session — AI CLI 대화
│   ├── executor.py           # !exec — CMD 명령 실행
│   ├── status.py             # !status — 시스템 정보
│   └── help_cmd.py           # !help — 도움말
│
└── utils/                    # 유틸리티
    ├── session_manager.py    # AI CLI 세션 관리 (-p + --resume)
    ├── subprocess_runner.py  # 비동기 subprocess 래퍼
    ├── output_formatter.py   # Discord 출력 포맷 (2000자 제한 처리)
    └── security.py           # 유저 화이트리스트, 명령어 블랙리스트
```

---

## 9. 동작 원리

### AI CLI 흐름

```
유저: !ask 파일 만들어줘
         │
         ▼
    [cogs/ai_cli.py]
    Discord 메시지 수신, 권한 확인
    (이미 처리 중이면 → "이미 처리 중" 안내 후 종료)
         │
         ▼
    [utils/session_manager.py]
    명령어 생성:
      claude -p "파일 만들어줘"
             --output-format json
             --dangerously-skip-permissions
             --resume <session_id>
         │
         ▼
    [subprocess 실행 — 프로세스 추적]
    Claude Code가 작업 수행 → JSON 응답 반환
    (타임아웃 시 프로세스 자동 종료)
    (!session kill 시 프로세스 강제 종료)
         │
         ▼
    [JSON 파싱]
    { "result": "파일을 생성했습니다...", "session_id": "abc123" }
         │
         ▼
    [utils/output_formatter.py]
    2000자 초과 시 → .txt 파일 첨부
         │
         ▼
    Discord에 응답 전송
```

### 프로세스 생명주기

```
봇 실행
  │
  ├─ !ask → subprocess 생성 (self._proc에 추적)
  │         ├─ 정상 완료 → _proc = None
  │         ├─ 타임아웃 → 프로세스 kill → 에러 반환
  │         └─ !session kill → 프로세스 kill
  │
  ├─ !session new → 프로세스 kill + 세션 초기화
  │
  └─ 봇 종료 (Ctrl+C) → cog_unload → cleanup() → 프로세스 kill
```

### 규칙 파일 자동 생성

봇 실행 시 작업 폴더에 규칙 파일을 자동 생성합니다:

| 선택한 CLI | 생성 파일 | 용도 |
|-----------|-----------|------|
| Claude Code | `CLAUDE.md` | Claude Code가 읽는 프로젝트 규칙 |
| Gemini CLI | `GEMINI.md` | Gemini CLI가 읽는 프로젝트 규칙 |
| OpenCode | `AGENTS.md` | OpenCode가 읽는 프로젝트 규칙 |

규칙 내용:
- AI가 해당 폴더 안에서만 파일 작업
- 쉘 명령도 해당 폴더 내에서만 실행
- 웹 검색은 허용

---

## 10. 보안

### 3단계 보안 구조

```
[1층] Discord 유저 화이트리스트
       └─ ALLOWED_USER_IDS에 등록된 사용자만 명령 가능

[2층] 명령어 블랙리스트 (!exec 전용)
       └─ format, diskpart, shutdown 등 위험 명령 차단

[3층] AI 작업 디렉토리 제한
       └─ CLAUDE.md 규칙으로 지정 폴더 내에서만 작업
```

### 차단되는 CMD 명령어

`!exec`로 실행할 수 없는 명령어:

```
format, diskpart, shutdown, restart,
del /s, rd /s, rmdir /s,
reg delete, bcdedit, cipher /w,
net user, net localgroup
```

### `--dangerously-skip-permissions` 플래그

AI CLI 도구가 파일 생성/수정 시 TUI에서 권한을 요청하는데,
Discord에서는 TUI를 볼 수 없으므로 이 플래그로 자동 승인합니다.

- **범위**: 해당 subprocess 실행 동안만 유효
- **보안**: Discord 유저 화이트리스트 + 규칙 파일로 보완
- **OS 권한**: Windows 사용자 계정 권한을 넘지 않음

---

## 11. FAQ / 문제 해결

### Q: 봇이 응답하지 않아요
- `.env`의 `DISCORD_BOT_TOKEN`이 올바른지 확인
- Discord Developer Portal에서 `MESSAGE CONTENT INTENT`가 켜져 있는지 확인
- `ALLOWED_USER_IDS`에 내 ID가 등록되어 있는지 확인

### Q: `!ask` 명령 시 "not installed or not in PATH" 에러
- 선택한 AI CLI 도구가 설치되어 있는지 확인
  ```bash
  claude --version
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

### Q: 여러 사용자가 동시에 사용할 수 있나요?
- 현재 1개의 세션만 지원합니다 (모든 유저가 같은 대화를 공유)
- 여러 유저의 메시지가 같은 AI 대화에 섞일 수 있습니다

### Q: AI가 너무 오래 걸려요. 중간에 취소할 수 있나요?
- `!session kill` (또는 `!s stop`)로 실행 중인 프로세스를 즉시 종료할 수 있습니다
- 세션은 유지되므로 다음 `!ask`에서 이전 대화를 이어갈 수 있습니다

### Q: 봇을 종료해도 CLI 프로세스가 남아있나요?
- 아닙니다. 봇 종료 시 (`Ctrl+C`) 실행 중인 CLI 프로세스도 자동으로 종료됩니다

### Q: 봇을 종료하려면?
- CMD 창에서 `Ctrl+C`를 누르세요
- 실행 중인 AI CLI 프로세스가 있으면 자동으로 정리됩니다
