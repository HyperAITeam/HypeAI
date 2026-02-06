╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Plan to implement                                                                                                    │
│                                                                                                                      │
│ Discord AI CLI Gateway Bot - 구현 계획                                                                               │
│                                                                                                                      │
│ Context                                                                                                              │
│                                                                                                                      │
│ OpenClaw에서 영감을 받아, Discord 메시지를 통해 내 Windows PC에서 실행 중인 AI CLI 도구(Claude Code, OpenCode,       │
│ Gemini CLI 등)에 명령을 전달하고 응답을 받아오는 봇을 Python으로 구현한다. 일반 CMD 명령 실행도 지원한다.            │
│                                                                                                                      │
│ 핵심 아이디어                                                                                                        │
│                                                                                                                      │
│ [Discord 메시지] → [내 PC의 봇] → [AI CLI 도구에 전달] → [응답을 Discord로 반환]                                     │
│                                   → [또는 CMD 명령 실행] → [결과를 Discord로 반환]                                   │
│                                                                                                                      │
│ 프로젝트 구조                                                                                                        │
│                                                                                                                      │
│ C:\Osgood\AIDevelop\                                                                                                 │
│ ├── bot.py                    # 엔트리포인트 (봇 생성, Cog 로드)                                                     │
│ ├── config.py                 # 설정 로딩 (.env, 상수, CLI 도구 설정)                                                │
│ ├── requirements.txt          # 의존성                                                                               │
│ ├── .env.example              # 환경변수 템플릿 (커밋됨)                                                             │
│ ├── .env                      # 실제 토큰/설정 (git-ignored)                                                         │
│ ├── .gitignore                                                                                                       │
│ ├── cogs/                                                                                                            │
│ │   ├── __init__.py                                                                                                  │
│ │   ├── ai_cli.py             # !claude, !gemini, !opencode - AI CLI 명령 전달                                       │
│ │   ├── executor.py           # !exec - 일반 CMD 명령 실행                                                           │
│ │   ├── status.py             # !status - PC 시스템 정보                                                             │
│ │   └── help_cmd.py           # !help - 도움말                                                                       │
│ └── utils/                                                                                                           │
│     ├── __init__.py                                                                                                  │
│     ├── session_manager.py    # AI CLI 세션 관리 (지속 대화 유지)                                                    │
│     ├── subprocess_runner.py  # 비동기 subprocess 래퍼 (타임아웃/킬)                                                 │
│     ├── output_formatter.py   # Discord 출력 포맷팅 (분할, 파일 첨부)                                                │
│     └── security.py           # 사용자 화이트리스트, 명령어 블랙리스트                                               │
│                                                                                                                      │
│ 의존성                                                                                                               │
│                                                                                                                      │
│ discord.py>=2.3.0,<3.0.0                                                                                             │
│ python-dotenv>=1.0.0                                                                                                 │
│ psutil>=5.9.0                                                                                                        │
│                                                                                                                      │
│ 핵심 기능                                                                                                            │
│                                                                                                                      │
│ 1. AI CLI 명령 (핵심 기능) - cogs/ai_cli.py                                                                          │
│ ┌────────────────────┬───────────────────────────────┬─────────────────────────────────┐                             │
│ │        명령        │             설명              │            실제 실행            │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !claude <메시지>   │ Claude Code에 메시지 전달     │ claude -p "<메시지>" --continue │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !gemini <메시지>   │ Gemini CLI에 메시지 전달      │ gemini -p "<메시지>"            │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !opencode <메시지> │ OpenCode에 메시지 전달        │ opencode -p "<메시지>"          │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !switch claude     │ 기본 CLI 도구 변경            │ 이후 !ask로 사용                │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !ask <메시지>      │ 현재 선택된 CLI에 메시지 전달 │ 기본 CLI 도구 사용              │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !session new       │ 새 세션 시작                  │ 세션 ID 초기화                  │                             │
│ ├────────────────────┼───────────────────────────────┼─────────────────────────────────┤                             │
│ │ !session info      │ 현재 세션 정보 확인           │ 세션 ID, CLI 도구 표시          │                             │
│ └────────────────────┴───────────────────────────────┴─────────────────────────────────┘                             │
│ 세션 지속 방식:                                                                                                      │
│ - Claude Code: --continue 플래그로 마지막 대화 이어감, 또는 --resume <session_id>로 특정 세션 재개                   │
│ - 각 CLI 도구별로 세션 ID를 utils/session_manager.py에서 관리                                                        │
│ - !session new로 새 대화 시작 가능                                                                                   │
│                                                                                                                      │
│ 2. 일반 CMD 실행 - cogs/executor.py                                                                                  │
│ ┌──────────────┬──────────────────────────────────┐                                                                  │
│ │     명령     │               설명               │                                                                  │
│ ├──────────────┼──────────────────────────────────┤                                                                  │
│ │ !exec <명령> │ CMD 명령 실행 (별칭: !run, !cmd) │                                                                  │
│ └──────────────┴──────────────────────────────────┘                                                                  │
│ 3. 시스템 상태 - cogs/status.py                                                                                      │
│ ┌─────────┬───────────────────────────────────────────────────┐                                                      │
│ │  명령   │                       설명                        │                                                      │
│ ├─────────┼───────────────────────────────────────────────────┤                                                      │
│ │ !status │ CPU, 메모리, 디스크, 업타임 정보 (별칭: !sysinfo) │                                                      │
│ └─────────┴───────────────────────────────────────────────────┘                                                      │
│ 4. 도움말 - cogs/help_cmd.py                                                                                         │
│ ┌───────┬───────────────────────────────────────┐                                                                    │
│ │ 명령  │                 설명                  │                                                                    │
│ ├───────┼───────────────────────────────────────┤                                                                    │
│ │ !help │ Discord Embed로 전체 명령어 목록 표시 │                                                                    │
│ └───────┴───────────────────────────────────────┘                                                                    │
│ 핵심 파일 상세 설계                                                                                                  │
│                                                                                                                      │
│ utils/session_manager.py - 세션 관리자                                                                               │
│                                                                                                                      │
│ # 각 CLI 도구별 세션 상태를 메모리에 유지                                                                            │
│ # - 현재 활성 CLI 도구 (기본: claude)                                                                                │
│ # - CLI별 세션 ID (대화 연속성)                                                                                      │
│ # - 세션 시작 시각                                                                                                   │
│ #                                                                                                                    │
│ # Claude Code 세션 연속성:                                                                                           │
│ #   첫 메시지: claude -p "msg" → 세션 ID 저장                                                                        │
│ #   이후 메시지: claude -p "msg" --resume <session_id>                                                               │
│ #   새 세션: session_id 초기화 후 --continue 없이 실행                                                               │
│                                                                                                                      │
│ config.py - CLI 도구 설정                                                                                            │
│                                                                                                                      │
│ CLI_TOOLS = {                                                                                                        │
│     "claude": {                                                                                                      │
│         "command": "claude",                                                                                         │
│         "args": ["-p", "{message}", "--continue"],  # 기본: 마지막 대화 이어감                                       │
│         "args_resume": ["-p", "{message}", "--resume", "{session_id}"],                                              │
│         "timeout": 300,  # AI 응답은 오래 걸릴 수 있음 (5분)                                                         │
│         "name": "Claude Code",                                                                                       │
│     },                                                                                                               │
│     "gemini": {                                                                                                      │
│         "command": "gemini",                                                                                         │
│         "args": ["-p", "{message}"],                                                                                 │
│         "timeout": 300,                                                                                              │
│         "name": "Gemini CLI",                                                                                        │
│     },                                                                                                               │
│     "opencode": {                                                                                                    │
│         "command": "opencode",                                                                                       │
│         "args": ["-p", "{message}"],                                                                                 │
│         "timeout": 300,                                                                                              │
│         "name": "OpenCode",                                                                                          │
│     },                                                                                                               │
│ }                                                                                                                    │
│ DEFAULT_CLI = "claude"                                                                                               │
│                                                                                                                      │
│ cogs/ai_cli.py - AI CLI Cog 동작 흐름                                                                                │
│                                                                                                                      │
│ 1. 사용자가 !claude 버그 수정해줘 입력                                                                               │
│ 2. 보안 검증 (화이트리스트 확인)                                                                                     │
│ 3. session_manager에서 현재 세션 ID 확인                                                                             │
│ 4. 세션 ID 있음 → claude -p "버그 수정해줘" --resume <session_id> 실행                                               │
│ 세션 ID 없음 → claude -p "버그 수정해줘" 실행                                                                        │
│ 5. Discord에 typing 표시하며 대기 (최대 5분)                                                                         │
│ 6. 응답을 캡처하여 Discord로 전송 (2000자 초과 시 파일 첨부)                                                         │
│ 7. 새 세션 ID가 있으면 저장                                                                                          │
│                                                                                                                      │
│ 보안 설계                                                                                                            │
│                                                                                                                      │
│ 1. 사용자 ID 화이트리스트: ALLOWED_USER_IDS에 등록된 사용자만 가능                                                   │
│ 2. 명령어 블랙리스트 (CMD 전용): format, diskpart, shutdown 등 위험 명령 차단                                        │
│ 3. stdin=DEVNULL: 대화형 명령 무한 대기 방지                                                                         │
│ 4. 토큰 보호: .env + .gitignore                                                                                      │
│                                                                                                                      │
│ 기술적 핵심 사항                                                                                                     │
│                                                                                                                      │
│ - 비동기 subprocess: asyncio.create_subprocess_shell + asyncio.wait_for                                              │
│ - Windows 프로세스 그룹: CREATE_NEW_PROCESS_GROUP으로 자식 프로세스까지 종료                                         │
│ - 인코딩 폴백: UTF-8 → cp437 → latin-1 순서로 디코딩                                                                 │
│ - Discord 2000자 제한: 초과 시 미리보기 + .txt 파일 첨부                                                             │
│ - AI CLI 긴 타임아웃: CMD는 30초, AI CLI는 300초 (5분)                                                               │
│ - typing 표시: AI 응답 대기 중 Discord에 "입력 중..." 표시                                                           │
│                                                                                                                      │
│ 설정 (.env)                                                                                                          │
│                                                                                                                      │
│ DISCORD_BOT_TOKEN=봇_토큰                                                                                            │
│ ALLOWED_USER_IDS=디스코드_유저_ID                                                                                    │
│ COMMAND_PREFIX=!                                                                                                     │
│ COMMAND_TIMEOUT=30                                                                                                   │
│ AI_CLI_TIMEOUT=300                                                                                                   │
│ DEFAULT_CLI=claude                                                                                                   │
│                                                                                                                      │
│ 구현 순서                                                                                                            │
│ ┌──────┬────────────────────────────────────────────┬───────────────────────────┐                                    │
│ │ 단계 │                    파일                    │           설명            │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 1    │ .gitignore, .env.example, requirements.txt │ 프로젝트 기반 파일        │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 2    │ config.py                                  │ 설정 로딩 + CLI 도구 정의 │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 3    │ utils/__init__.py, utils/security.py       │ 보안 유틸리티             │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 4    │ utils/subprocess_runner.py                 │ 비동기 명령 실행기        │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 5    │ utils/output_formatter.py                  │ 출력 포맷터               │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 6    │ utils/session_manager.py                   │ AI CLI 세션 관리자        │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 7    │ bot.py                                     │ 봇 엔트리포인트           │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 8    │ cogs/__init__.py, cogs/ai_cli.py           │ AI CLI 명령 (핵심)        │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 9    │ cogs/executor.py                           │ CMD 명령 실행             │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 10   │ cogs/status.py                             │ 시스템 상태               │                                    │
│ ├──────┼────────────────────────────────────────────┼───────────────────────────┤                                    │
│ │ 11   │ cogs/help_cmd.py                           │ 도움말                    │                                    │
│ └──────┴────────────────────────────────────────────┴───────────────────────────┘                                    │
│ 검증 방법                                                                                                            │
│                                                                                                                      │
│ 1. pip install -r requirements.txt 성공 확인                                                                         │
│ 2. .env 설정 후 python bot.py 실행 → 봇 연결 확인                                                                    │
│ 3. !claude 안녕하세요 → Claude Code 응답 확인                                                                        │
│ 4. !claude 이어서 설명해줘 → 이전 대화 이어가는지 확인 (세션 지속)                                                   │
│ 5. !session new → 새 세션 시작 확인                                                                                  │
│ 6. !switch gemini → CLI 전환 확인                                                                                    │
│ 7. !ask 질문 → 현재 선택된 CLI로 전달 확인                                                                           │
│ 8. !exec dir → CMD 실행 확인                                                                                         │
│ 9. !status → 시스템 정보 확인                                                                                        │
│ 10. !help → 도움말 표시 확인                                                                                         │
│ 11. 미허가 사용자 차단 확인                                                                                          │
╰────────────────────



----



 ---
  사용법 (처음부터 끝까지)

  Step 1: Discord 봇 생성

  1. https://discord.com/developers/applications 접속
  2. New Application 클릭 → 이름 입력 (예: AI CLI Gateway)
  3. 왼쪽 메뉴 Bot 클릭
  4. Reset Token 클릭 → 봇 토큰 복사 (이후 사용)
  5. 아래쪽 Privileged Gateway Intents 에서 Message Content Intent 켜기
  6. 왼쪽 메뉴 OAuth2 → URL Generator:
    - Scopes: bot
    - Bot Permissions: Send Messages, Read Message History, Attach Files, Embed Links
  7. 생성된 URL을 브라우저에 붙여넣고 → 원하는 서버에 봇 초대

  Step 2: 본인 Discord 유저 ID 확인

  1. Discord 설정 → 고급 → 개발자 모드 켜기
  2. 본인 프로필 우클릭 → ID 복사

  Step 3: 초기 설정

  setup.bat 더블클릭
  - Python 확인 → 의존성 설치 → 봇 토큰 + 유저 ID 입력하면 .env 자동 생성

  Step 4: 봇 실행

  start_bot.bat 더블클릭

  Step 5: Discord에서 사용
  ┌───────────────────────┬────────────────────────┐
  │         명령          │          설명          │
  ├───────────────────────┼────────────────────────┤
  │ !claude 버그 수정해줘 │ Claude Code에 전달     │
  ├───────────────────────┼────────────────────────┤
  │ !gemini 코드 리뷰해줘 │ Gemini CLI에 전달      │
  ├───────────────────────┼────────────────────────┤
  │ !ask 질문             │ 현재 선택된 CLI에 전달 │
  ├───────────────────────┼────────────────────────┤
  │ !switch gemini        │ CLI 도구 전환          │
  ├───────────────────────┼────────────────────────┤
  │ !session new          │ 새 대화 세션 시작      │
  ├───────────────────────┼────────────────────────┤
  │ !session info         │ 세션 정보 확인         │
  ├───────────────────────┼────────────────────────┤
  │ !exec dir             │ CMD 명령 실행          │
  ├───────────────────────┼────────────────────────┤
  │ !status               │ PC 시스템 상태         │
  ├───────────────────────┼────────────────────────┤
  │ !help                 │ 전체 명령어 목록       │
  └───────────────────────┴────────────────────────┘
  파일 구조 최종

  C:\Osgood\AIDevelop\
  ├── setup.bat          ← 더블클릭: 초기 설정
  ├── start_bot.bat      ← 더블클릭: 봇 실행
  ├── bot.py
  ├── config.py
  ├── requirements.txt
  ├── .env.example
  ├── .env               ← setup.bat이 생성 (git-ignored)
  ├── cogs/
  │   ├── ai_cli.py      ← !claude, !gemini, !opencode, !ask, !switch, !session
  │   ├── executor.py    ← !exec, !run, !cmd
  │   ├── status.py      ← !status
  │   └── help_cmd.py    ← !help
  └── utils/
      ├── session_manager.py
      ├── subprocess_runner.py
      ├── output_formatter.py
      └── security.py