<div align="center">

# AI CLI Gateway Bot

### Your AI Codes While You Sleep

Control AI CLI tools on your PC remotely via Discord

[![GitHub release](https://img.shields.io/github/v/release/OsgoodYZ/osgoodAI?style=flat-square)](../../releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat-square)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)](https://www.typescriptlang.org/)

[한국어](README.md) · [Report Bug](../../issues/new) · [Request Feature](../../issues/new)

<br>

![Demo](ScreenShot.gif)

</div>

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🤖 Remote AI Control
Control Claude Code, Gemini CLI, OpenCode remotely via Discord messages

</td>
<td width="50%">

### 💬 Interactive Responses
When Claude asks questions, respond instantly with Discord buttons/dropdowns

</td>
</tr>
<tr>
<td width="50%">

### 🔒 Multi-Layer Security
Whitelist + command blocking + prompt injection detection + output sanitization

</td>
<td width="50%">

### 📦 One-Click Launch
Just double-click the exe file to start (auto-downloads Node.js if needed)

</td>
</tr>
<tr>
<td width="50%">

### 🔀 Multi-Session Management
Create, switch, and manage multiple named AI sessions simultaneously

</td>
<td width="50%">

### 📊 Git Diff Visualization
Render git diffs as PNG images viewable directly in Discord

</td>
</tr>
</table>

---

## ⚡ Quick Start

### 1️⃣ Download
Get `aidevelop-bot.exe`, `cli.js`, `.env.example` from [GitHub Releases](../../releases/latest)

### 2️⃣ Run
Double-click `aidevelop-bot.exe` → Enter bot token & user ID

### 3️⃣ Use
Type `!ask review my code` in Discord!

> 💡 **Prerequisites**: See [Creating a Discord Bot](#creating-a-discord-bot) section

---

## 📋 Commands

### AI CLI

| Command | Alias | Description |
|:--------|:------|:------------|
| `!ask [session] <message>` | `!a` | Send message to AI |

> 💡 **Multi-session**: Use `!a work "analyze this code"` to send a message to a specific named session.

### Session Management

| Command | Alias | Description |
|:--------|:------|:------------|
| `!session create <name> [cli]` | `!s c` | Create a new session (optionally specify CLI tool) |
| `!session list` | `!s ls` | List all sessions + status |
| `!session switch <name>` | `!s sw` | Switch active session |
| `!session info [name]` | `!s` | Show session details |
| `!session new [name]` | `!s new` | Reset session conversation |
| `!session kill [name]` | `!s stop` | Kill running AI process |
| `!session delete <name>` | `!s rm` | Delete a session |
| `!session stats [name]` | `!s stat` | Show token usage statistics |
| `!session history [name] [count]` | `!s h` | View conversation history |

### Task Queue

| Command | Alias | Description |
|:--------|:------|:------------|
| `!task add <task>` | `!t a` | Add a scheduled task |
| `!task list` | `!t ls` | List scheduled tasks |
| `!task run` | `!t r` | Run all pending tasks sequentially |
| `!task remove <id>` | `!t rm` | Remove a task |
| `!task clear` | `!t c` | Clear all pending tasks |
| `!task stop` | `!t s` | Stop running tasks |

### Git Tools

| Command | Alias | Description |
|:--------|:------|:------------|
| `!diff` | `!d`, `!changes` | Visualize git diff as PNG image |
| `!diff --staged` | `!d -s` | Show staged changes only |
| `!diff <file>` | | Show diff for a specific file |
| `!diff HEAD~1` | | Compare with a specific commit |

### System

| Command | Alias | Description |
|:--------|:------|:------------|
| `!exec <command>` | `!run`, `!cmd` | Execute CMD command |
| `!status` | `!sysinfo` | System info (CPU, memory, uptime) |
| `!myid` | `!id` | Check Discord ID |
| `!help` | | Show help |

---

## 🤖 Supported AI Tools

| Tool | Integration | Interactive | Session |
|:-----|:-----------|:-----------:|:-------:|
| **Claude Code** | Agent SDK | ✅ | ✅ |
| **Gemini CLI** | Stream JSON | ❌ | ❌ |
| **OpenCode** | subprocess | ❌ | ❌ |

> **Claude Code** communicates directly via Agent SDK. When AI asks for choices, you can respond with Discord buttons/dropdowns! (4 or fewer options → buttons, 5+ → dropdown menu)

---

## 📦 Installation

<details>
<summary><b>Method 1: exe File (Recommended)</b></summary>

### Prerequisites
- **Node.js v18+** (auto-download attempted if missing)
- Claude Code auth (`claude login` or `ANTHROPIC_API_KEY`)

### Install
1. Download 3 files from [Releases](../../releases/latest)
2. **Place in same folder** (`cli.js` required for Claude Code!)
3. Double-click `aidevelop-bot.exe`

### First Run
```
================================================
  Initial Setup — Creating .env file
================================================

  [1/2] Discord Bot Token: ████████████████████
  [2/2] Discord User ID: 123456789012345678

  .env file has been created!
```

</details>

<details>
<summary><b>Method 2: Batch File (Windows)</b></summary>

```bash
# 1. Initial setup
setup.bat

# 2. Run bot
start_bot.bat
```

</details>

<details>
<summary><b>Method 3: Manual Install (Node.js)</b></summary>

```bash
npm install
npx tsx src/bot.ts
```

</details>

---

## ⚙️ Configuration

### Environment Variables (.env)

| Variable | Required | Default | Description |
|:---------|:--------:|:-------:|:------------|
| `DISCORD_BOT_TOKEN` | ✅ | — | Discord bot token |
| `ALLOWED_USER_IDS` | ✅ | — | Allowed user IDs (comma-separated) |
| `ANTHROPIC_API_KEY` | ❌ | — | API key (not needed with `claude login`) |
| `COMMAND_PREFIX` | ❌ | `!` | Command prefix |
| `COMMAND_TIMEOUT` | ❌ | `30` | CMD timeout (seconds, range: 5–120) |
| `AI_CLI_TIMEOUT` | ❌ | `300` | AI timeout (seconds, range: 30–1800) |

### Multiple Users

```env
ALLOWED_USER_IDS=111111111111111111,222222222222222222
```

---

## 🔒 Security

<details>
<summary><b>Security Features</b></summary>

| Feature | Description |
|:--------|:------------|
| **Whitelist Access Control** | Only users registered in `ALLOWED_USER_IDS` can use the bot |
| **Dangerous Command Blocking** | Blocks `format`, `shutdown`, `del /s`, `powershell`, and other dangerous commands/executables |
| **Prompt Injection Detection** | Warns on suspicious patterns: role reassignment, system prompt injection, jailbreak attempts |
| **Output Sanitization** | Auto-redacts API keys, tokens, user paths, and other sensitive data |
| **Sensitive File Filtering** | Automatically excludes `.env`, `credentials`, `secrets`, etc. from diffs |
| **Security Context Wrapping** | Injects working directory restriction rules into AI tools |

See [SECURITY.md](SECURITY.md) for detailed security policies.

</details>

---

## 🔧 Creating a Discord Bot

<details>
<summary><b>Expand detailed guide</b></summary>

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → Enter name → Create
3. **Bot** tab → **Reset Token** → Copy token
4. **Bot** tab → **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ **Message Content Intent** (required!)
5. **OAuth2** → **URL Generator**:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `Attach Files`
6. Invite bot using the generated URL

> ⚠️ **Your token is like a password. Never share it!**

</details>

---

## 🛠️ Troubleshooting

<details>
<summary><b>Common Issues</b></summary>

| Symptom | Solution |
|:--------|:---------|
| `cli.js file not found` | Place `cli.js` in same folder as exe |
| `Node.js is not installed` | Install [Node.js v18+](https://nodejs.org/) |
| Claude auth error | Run `claude login` or set API key |
| `You are not authorized` | Check ID with `!myid` → Add to `.env` |
| Bot not responding | Enable **Message Content Intent** |

</details>

---

## 🏗️ Building (For Developers)

<details>
<summary><b>exe Build Instructions</b></summary>

### Prerequisites
- Install [Bun](https://bun.sh/): `npm install -g bun`

### Build
```bash
# Method 1
build.bat

# Method 2
npm run build:exe
```

### Output
```
dist/
├── aidevelop-bot.exe    ← Executable
├── cli.js               ← Agent SDK runtime
└── .env.example         ← Config template
```

</details>

---

## 📚 Documentation

| Document | Description |
|:---------|:------------|
| [GUIDE.md](GUIDE.md) | Detailed user & developer guide |
| [SECURITY.md](SECURITY.md) | Security policies |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guide |

---

## 🤝 Contributing

Contributions are welcome! Please check [CONTRIBUTING.md](CONTRIBUTING.md).

---

## ☕ Support

If this project helped you, buy us a coffee!

<div align="center">

| Maintainer | Support |
|:----------:|:-------:|
| **hamsik2rang** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/hamsik2rang) |
| **osgood** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/osgoodyz) |
| **0814jyinjs** | [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/zx4510vbm) |

</div>

---

## 📄 License

[MIT](LICENSE) © 2024

---

<div align="center">

**Code with AI from anywhere via Discord** 🚀

[⬆ Back to Top](#ai-cli-gateway-bot)

</div>
