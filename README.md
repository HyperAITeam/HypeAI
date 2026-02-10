<div align="center">

# AI CLI Gateway Bot

### 잠든 사이에도 AI가 코딩한다

Discord에서 PC의 AI CLI 도구를 원격 제어하세요

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

## ✨ 주요 기능

<table>
<tr>
<td width="50%">

### 🤖 AI 원격 제어
Discord 메시지로 Claude Code, Gemini CLI, OpenCode를 원격으로 조작

</td>
<td width="50%">

### 💬 인터랙티브 응답
Claude가 물어보면 Discord 버튼으로 바로 응답

</td>
</tr>
<tr>
<td width="50%">

### 🔒 보안 설계
화이트리스트 기반 접근 제어 + 위험 명령어 차단

</td>
<td width="50%">

### 📦 원클릭 실행
exe 파일 더블클릭으로 바로 시작

</td>
</tr>
<tr>
<td width="50%">

### 📁 파일 업로드
Discord에 파일 첨부하면 AI가 분석

</td>
<td width="50%">

### 📋 작업 예약
여러 작업 예약 후 순차 실행

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

| 명령어 | 별칭 | 설명 |
|:-------|:-----|:-----|
| `!ask <메시지>` | `!a` | AI에게 메시지 전송 (파일 첨부 가능) |
| `!session info` | `!s` | 현재 세션 상태 확인 |
| `!session new` | `!s new` | 새 대화 시작 |
| `!session kill` | `!s stop` | 진행 중인 AI 중단 |
| `!task add <작업>` | `!t a` | 작업 예약 추가 |
| `!task list` | `!t ls` | 예약된 작업 목록 |
| `!task run` | `!t r` | 예약된 작업 순차 실행 |
| `!task remove <번호>` | `!t rm` | 작업 삭제 |
| `!task clear` | `!t c` | 대기 중인 작업 전체 삭제 |
| `!task stop` | `!t s` | 실행 중인 작업 중단 |
| `!exec <명령어>` | `!run`, `!cmd` | CMD 명령어 실행 |
| `!status` | `!sysinfo` | 시스템 정보 |
| `!myid` | `!id` | Discord ID 확인 |
| `!help` | | 도움말 |

---

## 🤖 지원 AI 도구

| 도구 | 연동 방식 | 인터랙티브 | 세션 유지 |
|:-----|:---------|:----------:|:---------:|
| **Claude Code** | Agent SDK | ✅ | ✅ |
| **Gemini CLI** | subprocess | ❌ | ❌ |
| **OpenCode** | subprocess | ❌ | ❌ |

> **Claude Code**는 Agent SDK를 통해 직접 통신합니다. AI가 선택지를 물어보면 Discord 버튼으로 응답할 수 있어요!

---

## 📦 설치 방법

<details>
<summary><b>방법 1: exe 파일 (권장)</b></summary>

### 사전 요구
- **Node.js v18+** (Claude Code 사용 시 필수)
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
| `DISCORD_BOT_TOKEN` | ✅ | — | Discord 봇 토큰 |
| `ALLOWED_USER_IDS` | ✅ | — | 허용할 유저 ID (쉼표 구분) |
| `ANTHROPIC_API_KEY` | ❌ | — | API 키 (`claude login` 시 불필요) |
| `COMMAND_PREFIX` | ❌ | `!` | 명령어 접두사 |
| `COMMAND_TIMEOUT` | ❌ | `30` | CMD 타임아웃 (초) |
| `AI_CLI_TIMEOUT` | ❌ | `300` | AI 타임아웃 (초) |

### 여러 유저 허용

```env
ALLOWED_USER_IDS=111111111111111111,222222222222222222
```

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

## 🛠️ 문제 해결

<details>
<summary><b>자주 묻는 문제</b></summary>

| 증상 | 해결 |
|:-----|:-----|
| `cli.js 파일을 찾을 수 없습니다` | exe와 같은 폴더에 `cli.js` 배치 |
| `Node.js가 설치되어 있지 않습니다` | [Node.js v18+](https://nodejs.org/) 설치 |
| Claude 인증 에러 | `claude login` 실행 또는 API 키 설정 |
| `You are not authorized` | `!myid`로 ID 확인 → `.env`에 추가 |
| 봇이 반응 없음 | **Message Content Intent** 활성화 확인 |

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

## 🤝 기여하기

기여를 환영합니다! [CONTRIBUTING.md](CONTRIBUTING.md)를 확인해주세요.

---

## ☕ 후원하기

이 프로젝트가 도움이 됐다면 커피 한 잔 사주세요!

<div align="center">

| Maintainer | Support |
|:----------:|:-------:|
| **hamsik2rang** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/hamsik2rang) |
| **osgood** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/osgoodyz) |

</div>

---

## 📄 라이선스

[MIT](LICENSE) © 2024

---

<div align="center">

**Discord로 어디서든 AI와 코딩하세요** 🚀

[⬆ 맨 위로](#ai-cli-gateway-bot)

</div>
