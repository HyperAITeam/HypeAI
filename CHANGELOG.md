# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-08

### Added

- Discord 봇을 통한 AI CLI 도구 원격 제어
- **Claude Code** 지원 (Agent SDK 기반)
  - 세션 유지 및 resume 기능
  - TUI 대화형 응답 (Discord 버튼/셀렉트 메뉴)
- **Gemini CLI** 지원 (subprocess 방식)
- **OpenCode** 지원 (subprocess 방식)
- 명령어 시스템
  - `!ask` - AI에게 메시지 전송
  - `!session` - 세션 관리 (info, new, kill)
  - `!exec` - CMD 명령어 실행
  - `!status` - 시스템 정보 표시
  - `!myid` - Discord User ID 확인
  - `!help` - 도움말
- 보안 기능
  - 사용자 화이트리스트 (`ALLOWED_USER_IDS`)
  - 위험 명령어 블랙리스트
  - 명령어 타임아웃
- exe 빌드 지원 (Bun 기반, Node.js 불필요)
- MIT 라이센스
- CI/CD 자동화 (GitHub Actions)

### Technical

- TypeScript 기반 (strict mode)
- discord.js v14
- @anthropic-ai/claude-agent-sdk v0.1.1

---

## [Unreleased]

### Planned

- 추가 AI CLI 도구 지원
- 다국어 지원
- 테스트 코드 추가

---

## Version History

| 버전 | 날짜 | 설명 |
|------|------|------|
| 1.0.0 | 2025-02-08 | 첫 정식 릴리즈 |
