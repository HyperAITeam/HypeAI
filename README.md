# AI CLI Gateway Bot

Discord 메시지로 PC에 설치된 AI CLI 도구(Claude Code, Gemini CLI, OpenCode)를 원격 제어하는 봇.

## 요구 사항

- **Node.js** v18 이상 ([다운로드](https://nodejs.org/))
- **Discord Bot Token** ([Discord Developer Portal](https://discord.com/developers/applications)에서 생성)
- AI CLI 도구 중 하나 이상 설치:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @anthropic-ai/gemini-cli`
  - [OpenCode](https://opencode.ai/)

## 사전 준비: Discord 봇 만들기

봇을 사용하려면 먼저 Discord 봇을 만들어야 합니다:

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속 → **New Application** → 이름 입력 → 생성
2. **Bot** 탭 → **Reset Token** → 토큰 복사 (나중에 입력합니다)
3. **Bot** 탭 → **Privileged Gateway Intents**에서 **Message Content Intent** 켜기 (필수!)
4. **OAuth2** → **URL Generator** → Scopes: `bot` 체크 → Permissions: `Send Messages`, `Read Message History`, `Attach Files` 체크 → 생성된 URL을 브라우저에서 열어 서버에 초대

> 토큰은 비밀번호와 같습니다. 절대 공유하지 마세요!

## 설치 & 실행

### 방법 1: exe 파일 (권장 — Node.js 불필요)

빌드된 `.exe` 파일을 사용하면 Node.js 설치 없이 바로 실행할 수 있습니다.

1. [GitHub Releases](../../releases/latest)에서 `aidevelop-bot.exe` 다운로드
2. `aidevelop-bot.exe` 더블클릭하여 실행
3. 첫 실행 시 자동으로 설정 화면이 표시됩니다:

```
================================================
  초기 설정 — .env 파일 생성
================================================

  .env 파일이 없습니다. 필수 정보를 입력해주세요.

  [1/2] Discord 봇 토큰: (위에서 복사한 토큰 붙여넣기)
  [2/2] Discord 유저 ID: (내 Discord ID 입력)

  .env 파일이 생성되었습니다!
```

4. 이어서 AI CLI 도구 선택 → 작업 폴더 입력 → 봇 시작

> **Discord 유저 ID 확인 방법**: Discord 설정 → 고급 → 개발자 모드 켜기 → 내 프로필 우클릭 → ID 복사.
> 또는 봇 실행 후 `!myid` 입력하면 알려줍니다.

### 방법 2: 배치 파일 (Windows — Node.js 필요)

`setup.bat` 더블클릭 — Node.js 확인, 의존성 설치, `.env` 파일 생성까지 자동으로 진행.

실행: `start_bot.bat` 더블클릭

### 방법 3: 수동 설치 (Node.js 필요)

```bash
npm install
npx tsx src/bot.ts
```

> `.env` 파일이 없으면 첫 실행 시 자동으로 설정 화면이 표시됩니다.
> 수동으로 만들려면 `.env.example`을 `.env`로 복사 후 값을 입력하세요.

## 실행 흐름

봇을 실행하면 콘솔에서 두 가지를 선택합니다:

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

## exe 빌드 (배포용)

[Bun](https://bun.sh/)을 사용해 단일 `.exe` 파일로 빌드합니다. 받는 사람은 Node.js 설치 없이 `.exe`와 `.env`만으로 실행할 수 있습니다.

### 빌드 방법

```bash
# 방법 1: 배치 파일
build.bat

# 방법 2: npm 스크립트 (Bun 필요)
npm run build:exe
```

### 빌드 결과

```
dist/
├── aidevelop-bot.exe    ← 단일 실행파일
└── .env.example         ← 설정 템플릿
```

### 사전 요구

- [Bun](https://bun.sh/) 설치 — `npm install -g bun`

## 문제 해결

| 증상 | 해결 |
|------|------|
| `You are not authorized` | `!myid`로 ID 확인 → `.env`의 `ALLOWED_USER_IDS`에 입력 → 봇 재시작 |
| `is not installed or not in PATH` | 해당 CLI 도구가 설치되어 있는지 확인 |
| 봇이 아무 반응 없음 | Discord Developer Portal에서 **Message Content Intent** 활성화했는지 확인 |
| 응답이 너무 길어서 잘림 | 2000자 초과 시 자동으로 `.txt` 파일로 첨부됨 |

## 개발자 참고

### Git Hooks 설정 (권장)

`.env` 파일 실수로 커밋하는 걸 방지하는 pre-commit hook이 포함되어 있습니다.

```bash
# Windows
setup-hooks.bat

# 또는 수동 설정
git config core.hooksPath .husky
```

설정 후 `.env` 파일을 커밋하려고 하면 자동으로 차단됩니다.

## License

[MIT](LICENSE)
