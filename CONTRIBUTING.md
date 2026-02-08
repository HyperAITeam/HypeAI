# Contributing / 기여 가이드

AIDevelop Bot에 기여해 주셔서 감사합니다! 🎉

## 시작하기

### 개발 환경 설정

```bash
# 1. Fork & Clone
git clone https://github.com/YOUR_USERNAME/AIDevelop.git
cd AIDevelop

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일에 값 입력

# 4. Git Hooks 설정 (권장)
setup-hooks.bat  # Windows
# 또는
git config core.hooksPath .husky

# 5. 개발 서버 실행
npx tsx src/bot.ts
```

## 코드 스타일

### TypeScript

- **TypeScript** 사용 (strict mode)
- 타입은 `src/types.ts`에 정의
- `any` 사용 지양, 명시적 타입 선언

### 네이밍 컨벤션

| 대상 | 스타일 | 예시 |
|------|--------|------|
| 파일명 | camelCase | `sessionManager.ts` |
| 함수/변수 | camelCase | `handleMessage()` |
| 클래스/인터페이스 | PascalCase | `SessionState` |
| 상수 | UPPER_SNAKE | `MAX_TIMEOUT` |

### 파일 구조

```
src/
├── bot.ts              # 진입점
├── config.ts           # 설정
├── types.ts            # 타입 정의
├── commands/           # 명령어 핸들러
├── sessions/           # 세션 관리
└── utils/              # 유틸리티 함수
```

## 커밋 메시지

### 형식

```
<타입>: <간단한 설명>

[선택] 자세한 설명
```

### 타입

| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `style` | 코드 스타일 (포맷팅 등) |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 등 |

### 예시

```
feat: Claude SDK 세션 resume 기능 추가
fix: 긴 응답 메시지 분할 오류 수정
docs: README에 설치 방법 추가
```

## Pull Request

### PR 전 체크리스트

- [ ] 코드가 정상 동작하는지 확인
- [ ] TypeScript 컴파일 오류 없음 (`npx tsc --noEmit`)
- [ ] 관련 문서 업데이트 (해당되는 경우)
- [ ] 커밋 메시지 컨벤션 준수

### PR 제목 형식

```
[feat] 새로운 기능 설명
[fix] 버그 수정 설명
[docs] 문서 변경 설명
```

### PR 내용

- 변경 사항 요약
- 관련 이슈 번호 (있는 경우)
- 테스트 방법

## 이슈 등록

버그 리포트나 기능 제안은 GitHub Issues를 사용해 주세요.

### 버그 리포트

- 발생 환경 (OS, Node.js 버전, AI CLI 도구)
- 재현 방법
- 예상 동작 vs 실제 동작
- 에러 메시지 (있는 경우)

### 기능 제안

- 기능 설명
- 사용 사례
- 구현 아이디어 (선택)

## 질문

궁금한 점이 있으시면 GitHub Issues에 질문을 남겨주세요!
