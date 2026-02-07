import os
from dotenv import load_dotenv

load_dotenv()

# Discord
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
COMMAND_PREFIX = os.getenv("COMMAND_PREFIX", "!")

# Security
ALLOWED_USER_IDS: set[int] = set()
_raw_ids = os.getenv("ALLOWED_USER_IDS", "")
if _raw_ids.strip():
    for uid in _raw_ids.split(","):
        uid = uid.strip()
        if uid.isdigit():
            ALLOWED_USER_IDS.add(int(uid))

# Timeouts
COMMAND_TIMEOUT = int(os.getenv("COMMAND_TIMEOUT", "30"))
AI_CLI_TIMEOUT = int(os.getenv("AI_CLI_TIMEOUT", "300"))
IDLE_TIMEOUT = float(os.getenv("IDLE_TIMEOUT", "8"))

# Default CLI tool
DEFAULT_CLI = os.getenv("DEFAULT_CLI", "claude")

# CLI tool definitions
#   extra_flags  : flags appended after `-p <message>`
#   resume_flag  : flag for session resume (None = not supported)
#   json_output  : whether the CLI outputs JSON (affects parsing)
CLI_TOOLS: dict[str, dict] = {
    "claude": {
        "command": "claude",
        "max_timeout": AI_CLI_TIMEOUT,
        "name": "Claude Code",
        "rules_file": "CLAUDE.md",
        "extra_flags": ["--output-format", "json", "--dangerously-skip-permissions"],
        "resume_flag": "--resume",
        "json_output": True,
    },
    "gemini": {
        "command": "gemini",
        "max_timeout": AI_CLI_TIMEOUT,
        "name": "Gemini CLI",
        "rules_file": "GEMINI.md",
        "extra_flags": ["--yolo"],
        "resume_flag": None,
        "json_output": False,
    },
    "opencode": {
        "command": "opencode",
        "max_timeout": AI_CLI_TIMEOUT,
        "name": "OpenCode",
        "rules_file": "AGENTS.md",
        "extra_flags": [],
        "resume_flag": None,
        "json_output": False,
    },
}

# Blocked commands for !exec
BLOCKED_COMMANDS = {
    "format", "diskpart", "shutdown", "restart",
    "del /s", "rd /s", "rmdir /s",
    "reg delete", "bcdedit", "cipher /w",
    "net user", "net localgroup",
}

# Discord message limit
DISCORD_MAX_LENGTH = 2000
