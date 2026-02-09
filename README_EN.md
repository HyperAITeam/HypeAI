# AI CLI Gateway Bot

> [한국어](README.md)

A bot that remotely controls AI CLI tools (Claude Code, Gemini CLI, OpenCode) installed on your PC via Discord messages.

![ScreenShot](ScreenShot.gif)

## Requirements

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Discord Bot Token** (Create one at [Discord Developer Portal](https://discord.com/developers/applications))
- At least one AI CLI tool installed:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @anthropic-ai/gemini-cli`
  - [OpenCode](https://opencode.ai/)

## Prerequisites: Creating a Discord Bot

You need to create a Discord bot first:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → Enter name → Create
2. **Bot** tab → **Reset Token** → Copy the token (you'll need it later)
3. **Bot** tab → **Privileged Gateway Intents** → Enable **Message Content Intent** (required!)
4. **OAuth2** → **URL Generator** → Scopes: check `bot` → Permissions: check `Send Messages`, `Read Message History`, `Attach Files` → Open the generated URL in browser to invite to your server

> Your token is like a password. Never share it!

## Installation & Running

### Method 1: exe File (Recommended)

Run easily with the pre-built `.exe` file.

> **Prerequisite**: To use Claude Code, **Node.js v18+** must be installed.
> The Agent SDK internally uses Node.js to run Claude Code.
> Claude Code authentication is also required (`claude login` or `ANTHROPIC_API_KEY` environment variable).

1. Download `aidevelop-bot.exe`, `cli.js`, `.env.example` from [GitHub Releases](../../releases/latest)
2. **Place all three files in the same folder** (`cli.js` is required for Claude Code!)
3. Double-click `aidevelop-bot.exe` to run
3. On first run, the setup screen appears automatically:

```
================================================
  Initial Setup — Creating .env file
================================================

  No .env file found. Please enter the required information.

  [1/2] Discord Bot Token: (paste the token you copied)
  [2/2] Discord User ID: (enter your Discord ID)

  .env file has been created!
```

4. Copy `.env.example` to `.env` and fill in the values (or use the automatic setup on first run)
5. Select AI CLI tool → Enter working directory → Bot starts

> **How to find your Discord User ID**: Discord Settings → Advanced → Enable Developer Mode → Right-click your profile → Copy ID.
> Or type `!myid` after the bot is running.

### Method 2: Batch File (Windows — Node.js Required)

Double-click `setup.bat` — Automatically checks Node.js, installs dependencies, and creates `.env` file.

Run: Double-click `start_bot.bat`

### Method 3: Manual Installation (Node.js Required)

```bash
npm install
npx tsx src/bot.ts
```

> If no `.env` file exists, the setup screen will appear on first run.
> To create manually, copy `.env.example` to `.env` and fill in the values.

## Execution Flow

When you run the bot, you'll select two options in the console:

```
[1/2] Select AI CLI tool:
    1) Claude Code  (claude)
    2) Gemini CLI   (gemini)
    3) OpenCode     (opencode)

[2/2] Enter working directory:
    Path (default: C:\current\path):
```

- **AI CLI Tool** — Choose which AI to use
- **Working Directory** — The folder path where AI reads and modifies code

After selection, the bot connects to Discord.

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `!ask <message>` | `!a` | Send a message to AI |
| `!session info` | `!s` | Check current session status |
| `!session new` | `!s new` | Start a new conversation (reset session) |
| `!session kill` | `!s stop` | Stop the running AI process |
| `!exec <command>` | `!run`, `!cmd` | Execute a CMD command |
| `!status` | `!sysinfo` | Display system information |
| `!myid` | `!id` | Check your Discord User ID |
| `!help` | | Show help |

## Usage Examples

### Asking AI

```
!ask Explain the structure of this project
```

```
!a Add error handling to src/index.ts
```

### When AI Asks for Choices (Claude Code)

When Claude needs your input during work, buttons appear in Discord:

```
Claude asks:
"How would you like to refactor this?"

[Split Files] [Extract Functions] [Convert to Class]  ← Click buttons to respond
```

If no selection is made within 60 seconds, the first option is automatically selected.

### Session Management

```
!session info     ← Check current status
!session new      ← Start new conversation
!session kill     ← Stop long-running tasks
```

### CMD Command Execution

```
!exec dir
!run git status
!cmd npm test
```

## Configuration (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | — | Discord bot token |
| `ALLOWED_USER_IDS` | Yes | — | Allowed user IDs (comma-separated for multiple) |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key (not needed if using `claude login`) |
| `COMMAND_PREFIX` | No | `!` | Command prefix |
| `COMMAND_TIMEOUT` | No | `30` | CMD command timeout (seconds) |
| `AI_CLI_TIMEOUT` | No | `300` | AI CLI timeout (seconds) |

### Allowing Multiple Users

```
ALLOWED_USER_IDS=111111111111111111,222222222222222222
```

## Creating a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → Enter name → Create
3. **Bot** tab → **Reset Token** → Copy token → Paste in `.env`
4. **Bot** tab → Enable these 3 under **Privileged Gateway Intents**:
   - Presence Intent
   - Server Members Intent
   - **Message Content Intent** (required)
5. **OAuth2** → **URL Generator** → Scopes: `bot` → Permissions: `Send Messages`, `Read Message History`, `Attach Files` → Invite to server using generated URL

## Supported CLI Tools

| Tool | Method | TUI Response | Session Persistence |
|------|--------|--------------|---------------------|
| Claude Code | Agent SDK | Yes (Discord buttons) | Yes (resume) |
| Gemini CLI | subprocess | No | No |
| OpenCode | subprocess | No | No |

- **Claude Code**: Communicates directly through Agent SDK. When AI asks questions, you can respond via Discord buttons.
- **Gemini CLI / OpenCode**: Runs as subprocess. Sends messages in `-p "message"` format and collects output.

## exe Build (For Distribution)

Build to `.exe` file using [Bun](https://bun.sh/).

> **Note**: When using Claude Code, the recipient's PC also needs **Node.js v18+** installed and Claude Code authentication (`claude login` or `ANTHROPIC_API_KEY`).

### How to Build

```bash
# Method 1: Batch file
build.bat

# Method 2: npm script (Bun required)
npm run build:exe
```

### Build Output

```
dist/
├── aidevelop-bot.exe    ← Executable
├── cli.js               ← Claude Agent SDK runtime (must be in same folder as exe)
└── .env.example         ← Configuration template
```

### Prerequisites

- Install [Bun](https://bun.sh/) — `npm install -g bun`

## Troubleshooting

| Symptom | Solution |
|---------|----------|
| `cli.js file not found` | Check that `cli.js` is in the same folder as the exe. Download it together from Releases |
| `Node.js is not installed` | Install [Node.js](https://nodejs.org/) v18+ (required for Claude Code Agent SDK) |
| Claude authentication error | Login with `claude login` or set `ANTHROPIC_API_KEY` environment variable |
| `You are not authorized` | Check your ID with `!myid` → Add to `ALLOWED_USER_IDS` in `.env` → Restart bot |
| `is not installed or not in PATH` | Check that the CLI tool is installed |
| Bot not responding | Check if **Message Content Intent** is enabled in Discord Developer Portal |
| Response too long and truncated | Responses over 2000 characters are automatically attached as `.txt` files |

## Developer Notes

### Git Hooks Setup (Recommended)

A pre-commit hook is included to prevent accidentally committing `.env` files.

```bash
# Windows
setup-hooks.bat

# Or manual setup
git config core.hooksPath .husky
```

After setup, attempting to commit `.env` files will be automatically blocked.

## License

[MIT](LICENSE)
