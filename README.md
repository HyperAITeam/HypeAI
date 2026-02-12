<div align="center">

# AI CLI Gateway Bot

### 잠든 사이에도 AI가 코딩한다

Discord / LINE에서 PC의 AI CLI 도구를 원격 제어하세요

[![GitHub release](https://img.shields.io/github/v/release/OsgoodYZ/osgoodAI?style=flat-square)](../../releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat-square)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)](https://www.typescriptlang.org/)

[English](README_EN.md) · [버그 리포트](../../issues/new) · [기능 요청](../../issues/new)

<br>

![Demo](ScreenShot.gif)

</div>

---

## 💡 이런 분께 추천

- 🛏️ **자기 전에 작업 시켜놓고** 아침에 결과 확인하고 싶은 분
- 📱 **외출 중에도** 집 PC에서 AI가 코딩하게 하고 싶은 분
- 🤖 **Claude Code를 원격으로** 조작하고 싶은 분
- ⌨️ AI가 "어떻게 할까요?" 물으면 **버튼 클릭으로 응답**하고 싶은 분
- 📋 여러 작업을 **예약해두고 순차 실행**하고 싶은 분

---

## ✨ 주요 기능

<table>
<tr>
<td width="50%">

### 🤖 AI 원격 제어
Discord / LINE 메시지로 Claude Code, Gemini CLI, OpenCode를 원격으로 조작

</td>
<td width="50%">

### 💬 인터랙티브 응답
Claude가 물어보면 Discord 버튼 / LINE Quick Reply로 바로 응답

</td>
</tr>
<tr>
<td width="50%">

### 🔒 다층 보안 설계
화이트리스트 + 위험 명령어 차단 + 프롬프트 인젝션 탐지 + 출력 자동 검열

</td>
<td width="50%">

### 📦 원클릭 실행
exe 파일 더블클릭으로 바로 시작 (Node.js 자동 다운로드)

</td>
</tr>
<tr>
<td width="50%">

### 🔀 멀티세션 관리
여러 AI 세션을 동시에 이름별로 생성/전환하며 운영

</td>
<td width="50%">

### 📊 Git Diff 시각화
git diff를 PNG 이미지로 렌더링하여 Discord에서 바로 확인

</td>
</tr>
<tr>
<td width="50%">

### 📱 멀티 플랫폼
Discord와 LINE을 동시에 지원. 플랫폼 하나만 또는 둘 다 사용 가능

</td>
<td width="50%">

### 🔌 쉬운 배포
Cloudflare Tunnel 등으로 별도 서버 없이 LINE 웹훅 연동 가능

</td>
</tr>
</table>

---

## ⚡ 빠른 시작

### 1️⃣ 다운로드
[GitHub Releases](../../releases/latest)에서 `aidevelop-bot.exe`, `cli.js`, `.env.example` 다운로드

### 2️⃣ 실행
`aidevelop-bot.exe` 더블클릭 → 봇 토큰 & 유저 ID 입력

### 3️⃣ 사용
Discord에서 `!ask 코드 리뷰해줘` 입력!

> 💡 **사전 준비**: [Discord 봇 만들기](#discord-봇-만들기) 섹션 참고

---

## 📋 명령어

### AI CLI

| 명령어 | 별칭 | 설명 |
|:-------|:-----|:-----|
| `!ask [session] <메시지>` | `!a` | AI에게 메시지 전송 |

> 💡 **멀티세션**: `!a work "코드 분석해줘"` 처럼 세션 이름을 지정하면 해당 세션으로 메시지가 전달됩니다.

### 세션 관리

| 명령어 | 별칭 | 설명 |
|:-------|:-----|:-----|
| `!session create <name> [cli]` | `!s c` | 새 세션 생성 (CLI 도구 지정 가능) |
| `!session list` | `!s ls` | 모든 세션 목록 + 상태 |
| `!session switch <name>` | `!s sw` | 활성 세션 전환 |
| `!session info [name]` | `!s` | 세션 상세 정보 |
| `!session new [name]` | `!s new` | 세션 대화 초기화 |
| `!session kill [name]` | `!s stop` | 진행 중인 AI 프로세스 중단 |
| `!session delete <name>` | `!s rm` | 세션 삭제 |
| `!session stats [name]` | `!s stat` | 토큰 사용량 통계 |
| `!session history [name] [count]` | `!s h` | 대화 기록 조회 |

### 작업 큐

| 명령어 | 별칭 | 설명 |
|:-------|:-----|:-----|
| `!task add <작업>` | `!t a` | 작업 예약 추가 |
| `!task list` | `!t ls` | 예약된 작업 목록 |
| `!task run` | `!t r` | 예약된 작업 순차 실행 |
| `!task remove <번호>` | `!t rm` | 작업 삭제 |
| `!task clear` | `!t c` | 대기 중인 작업 전체 삭제 |
| `!task stop` | `!t s` | 실행 중인 작업 중단 |

### Git 도구

| 명령어 | 별칭 | 설명 |
|:-------|:-----|:-----|
| `!diff` | `!d`, `!changes` | git diff를 PNG 이미지로 시각화 |
| `!diff --staged` | `!d -s` | 스테이지된 변경사항만 표시 |
| `!diff <file>` | | 특정 파일의 diff 표시 |
| `!diff HEAD~1` | | 특정 커밋과 비교 |

### 시스템

| 명령어 | 별칭 | 설명 |
|:-------|:-----|:-----|
| `!exec <명령어>` | `!run`, `!cmd` | CMD 명령어 실행 |
| `!status` | `!sysinfo` | 시스템 정보 (CPU, 메모리, 업타임) |
| `!myid` | `!id` | Discord ID 확인 |
| `!help` | | 도움말 |

---

## 🤖 지원 AI 도구

| 도구 | 연동 방식 | 인터랙티브 | 세션 유지 |
|:-----|:---------|:----------:|:---------:|
| **Claude Code** | Agent SDK | ✅ | ✅ |
| **Gemini CLI** | Stream JSON | ✅ | ✅ |
| **OpenCode** | subprocess | ❌ | ❌ |

> **Claude Code & Gemini CLI**는 AI가 선택지를 물어보면 Discord 버튼/드롭다운 또는 LINE Quick Reply로 응답할 수 있어요!

---

## 📦 설치 방법

<details>
<summary><b>방법 1: exe 파일 (권장)</b></summary>

### 사전 요구
- **Node.js v18+** (없으면 자동 다운로드 시도)
- Claude Code 인증 (`claude login` 또는 `ANTHROPIC_API_KEY`)

### 설치
1. [Releases](../../releases/latest)에서 3개 파일 다운로드
2. **같은 폴더에 배치** (`cli.js` 없으면 Claude Code 사용 불가!)
3. `aidevelop-bot.exe` 더블클릭

### 첫 실행 화면
```
================================================
  초기 설정 — .env 파일 생성
================================================

  [1/2] Discord 봇 토큰: ████████████████████
  [2/2] Discord 유저 ID: 123456789012345678

  .env 파일이 생성되었습니다!
```

</details>

<details>
<summary><b>방법 2: 배치 파일 (Windows)</b></summary>

```bash
# 1. 초기 설정
setup.bat

# 2. 봇 실행
start_bot.bat
```

</details>

<details>
<summary><b>방법 3: 수동 설치 (Node.js)</b></summary>

```bash
npm install
npx tsx src/bot.ts
```

</details>

---

## ⚙️ 설정

### 환경 변수 (.env)

| 변수 | 필수 | 기본값 | 설명 |
|:-----|:----:|:------:|:-----|
| `DISCORD_BOT_TOKEN` | ⚡ | — | Discord 봇 토큰 (Discord 사용 시 필수) |
| `ALLOWED_USER_IDS` | ⚡ | — | 허용할 Discord 유저 ID (쉼표 구분) |
| `ANTHROPIC_API_KEY` | ❌ | — | API 키 (`claude login` 시 불필요) |
| `COMMAND_PREFIX` | ❌ | `!` | 명령어 접두사 |
| `COMMAND_TIMEOUT` | ❌ | `30` | CMD 타임아웃 (초, 범위: 5~120) |
| `AI_CLI_TIMEOUT` | ❌ | `300` | AI 타임아웃 (초, 범위: 30~1800) |
| `LINE_CHANNEL_ACCESS_TOKEN` | ⚡ | — | LINE 채널 액세스 토큰 (LINE 사용 시 필수) |
| `LINE_CHANNEL_SECRET` | ⚡ | — | LINE 채널 시크릿 (LINE 사용 시 필수) |
| `LINE_WEBHOOK_PORT` | ❌ | `3000` | LINE 웹훅 서버 포트 |
| `ALLOWED_LINE_USER_IDS` | ⚡ | — | 허용할 LINE 유저 ID (쉼표 구분) |

> ⚡ = 해당 플랫폼 사용 시 필수. Discord만 사용하면 LINE 설정은 불필요하고, LINE만 사용하면 Discord 설정은 불필요합니다.
>
> ⚠️ **보안 주의**: Discord ID는 17-19자리 **숫자**입니다 (유저네임 ❌). ID는 외부에 노출하지 마세요!

### 여러 유저 허용

```env
ALLOWED_USER_IDS=111111111111111111,222222222222222222
```

---

## 🔒 보안

<details>
<summary><b>보안 기능 상세</b></summary>

| 기능 | 설명 |
|:-----|:-----|
| **화이트리스트 접근 제어** | `ALLOWED_USER_IDS`에 등록된 유저만 봇 사용 가능 |
| **위험 명령어 차단** | `format`, `shutdown`, `del /s`, `powershell` 등 위험 명령어/실행파일 차단 |
| **프롬프트 인젝션 탐지** | 역할 변경, 시스템 프롬프트 주입, 탈옥 시도 등 의심 패턴 경고 |
| **출력 자동 검열** | API 키, 토큰, 사용자 경로 등 민감 정보 자동 마스킹 |
| **민감 파일 필터링** | diff에서 `.env`, `credentials`, `secrets` 등 민감 파일 자동 제외 |
| **보안 컨텍스트 래핑** | AI에게 작업 디렉토리 제한 규칙 자동 주입 |

자세한 보안 정책은 [SECURITY.md](SECURITY.md)를 참고하세요.

</details>

---

## 🔧 Discord 봇 만들기

<details>
<summary><b>상세 가이드 펼치기</b></summary>

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. **New Application** → 이름 입력 → 생성
3. **Bot** 탭 → **Reset Token** → 토큰 복사
4. **Bot** 탭 → **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ **Message Content Intent** (필수!)
5. **OAuth2** → **URL Generator**:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `Attach Files`
6. 생성된 URL로 서버에 봇 초대

> ⚠️ **토큰은 비밀번호입니다. 절대 공유하지 마세요!**

</details>

---

## 💚 LINE 봇 만들기

<details>
<summary><b>상세 가이드 펼치기</b></summary>

현재 LINE의 경우 수동 설치 방법만을 지원합니다.

### Step 1: LINE Official Account 생성

1. [LINE Official Account Manager](https://manager.line.biz/) 접속 → 로그인
2. **새 계정 만들기** → 계정 이름 입력 (예: `AIDevelop Bot`)
3. 카테고리 선택 → 계정 생성 완료

### Step 2: Messaging API 활성화

1. 생성된 계정의 **설정** → **Messaging API** 탭
2. **Messaging API 사용** 클릭 → LINE Developers 제공자 선택 (없으면 새로 생성)
3. 활성화 완료 후 [LINE Developers Console](https://developers.line.biz/console/) 에서 채널 확인

### Step 3: 토큰 & 시크릿 복사

[LINE Developers Console](https://developers.line.biz/console/) → 채널 선택:

1. **Basic settings** 탭 → `Channel secret` 복사
2. **Messaging API** 탭 → `Channel access token` → **Issue** 클릭 → 토큰 복사

### Step 4: .env 설정

이미 생성된 .env 파일을 열어 아래 내용을 추가

```env
LINE_CHANNEL_ACCESS_TOKEN=발급받은_액세스_토큰
LINE_CHANNEL_SECRET=발급받은_채널_시크릿
LINE_WEBHOOK_PORT=3000
ALLOWED_LINE_USER_IDS=내_LINE_유저_ID
```

> LINE 유저 ID는 [LINE Developers Console](https://developers.line.biz/console/) → Basic settings → `Your user ID`에서 확인 (U로 시작하는 문자열)

### Step 5: 웹훅 URL 설정

LINE은 웹훅 방식으로 동작하므로, 봇 서버가 외부에서 접근 가능해야 합니다.

**로컬 테스트 (Cloudflare Tunnel 무료)**:
```bash
# 1. Cloudflare Tunnel 설치 (한 번만)
winget install cloudflare.cloudflared

# 2. 터널 실행 (봇 실행 중에 별도 터미널에서)
cloudflared tunnel --url http://localhost:3000
```

터널 실행 후 표시되는 URL (예: `https://xxxx-xxxx.trycloudflare.com`)을 복사합니다.

**운영 환경**: 고정 도메인이 있는 서버에서 봇을 실행하거나, 리버스 프록시(nginx 등)를 사용하세요.

### Step 6: LINE 웹훅 등록

1. [LINE Developers Console](https://developers.line.biz/console/) → 채널 → **Messaging API** 탭
2. **Webhook URL** → `https://xxxx-xxxx.trycloudflare.com/webhook` 입력 → **Update**
3. **Use webhook** → 켜기
4. **Verify** 클릭 → `Success` 확인

### Step 7: 자동 응답 끄기

1. [LINE Official Account Manager](https://manager.line.biz/) → 계정 선택
2. **응답 설정** (또는 **Settings** → **Response settings**)
3. **응답 메시지** → **끄기**
4. **Webhook** → **켜기**

> 자동 응답이 켜져 있으면 봇 응답 대신 기본 자동 응답이 전송됩니다.

### Step 8: 봇 실행 & 테스트

```bash
npx tsx src/bot.ts
```

콘솔에 `[platform] Active: Discord + LINE` (또는 `LINE only`)이 표시되면 성공!

LINE에서 봇에게 `!ask 안녕` 메시지를 보내 테스트하세요.

</details>

---

## 🛠️ 문제 해결

<details>
<summary><b>자주 묻는 문제</b></summary>

| 증상 | 해결 |
|:-----|:-----|
| `cli.js 파일을 찾을 수 없습니다` | exe와 같은 폴더에 `cli.js` 배치 |
| `Node.js가 설치되어 있지 않습니다` | [Node.js v18+](https://nodejs.org/) 설치 |
| Claude 인증 에러 | `claude login` 실행 또는 API 키 설정 |
| `You are not authorized` | `!myid`로 ID 확인 → `.env`에 추가 |
| 봇이 반응 없음 (Discord) | **Message Content Intent** 활성화 확인 |
| LINE 봇이 반응 없음 | 1) 웹훅 URL이 `/webhook`으로 끝나는지 확인 2) **Use webhook** 켜기 3) **응답 메시지** 끄기 |
| LINE 웹훅 Verify 실패 | 봇이 실행 중인지 확인. Cloudflare Tunnel 사용 시 터널도 실행 중이어야 함 |
| LINE에서 결과가 안 와요 | `ALLOWED_LINE_USER_IDS`에 본인 ID가 등록되어 있는지 확인 |

</details>

---

## 🏗️ 빌드 (개발자용)

<details>
<summary><b>exe 빌드 방법</b></summary>

### 사전 요구
- [Bun](https://bun.sh/) 설치: `npm install -g bun`

### 빌드
```bash
# 방법 1
build.bat

# 방법 2
npm run build:exe
```

### 결과물
```
dist/
├── aidevelop-bot.exe    ← 실행파일
├── cli.js               ← Agent SDK 런타임
└── .env.example         ← 설정 템플릿
```

</details>

---

## 📚 문서

| 문서 | 설명 |
|:-----|:-----|
| [GUIDE.md](GUIDE.md) | 상세 사용자/개발자 가이드 |
| [SECURITY.md](SECURITY.md) | 보안 정책 |
| [CHANGELOG.md](CHANGELOG.md) | 버전별 변경 이력 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 기여 가이드 |

---

## 🤝 기여하기

기여를 환영합니다! [CONTRIBUTING.md](CONTRIBUTING.md)를 확인해주세요.

---

## ☕ 후원하기

이 프로젝트가 도움이 됐다면 커피 한 잔 사주세요!

<div align="center">

### 🎰 랜덤 후원 룰렛

누구에게 후원할지 고민된다면? 룰렛을 돌려보세요!

[![Random Supporter Roulette](https://img.shields.io/badge/🎰_SPIN_THE_WHEEL!-FF6B6B?style=for-the-badge&logoColor=white)](https://hyperaiteam.github.io/HypeAI/roulette.html)

---

### 직접 후원하기

| Maintainer | Support |
|:----------:|:-------:|
| **hamsik2rang** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/hamsik2rang) |
| **osgood** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/osgoodyz) |
| **0814jyinjs** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/zx4510vbm) |

</div>

---

## 📄 라이선스

[MIT](LICENSE) © 2024

---

<div align="center">

**Discord / LINE으로 어디서든 AI와 코딩하세요** 🚀

[⬆ 맨 위로](#ai-cli-gateway-bot)

</div>
