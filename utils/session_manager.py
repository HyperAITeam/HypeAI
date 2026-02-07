from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import time

from config import CLI_TOOLS

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SessionManager — runs `cli -p` per message with session continuity
# ---------------------------------------------------------------------------
class SessionManager:
    """Sends messages via `cli -p` and maintains conversation via --resume.

    Each message spawns a short-lived subprocess.  Conversation history
    is preserved through Claude Code's ``--resume <session_id>`` flag.
    The currently running subprocess is tracked so it can be killed on
    demand (``!session kill``) or automatically when the bot shuts down.
    """

    def __init__(self, cli_name: str, cwd: str | None = None) -> None:
        self.cli_name = cli_name
        self.cwd = cwd
        self.tool = CLI_TOOLS[cli_name]

        self.session_id: str | None = None
        self.message_count: int = 0
        self.started_at: float = 0.0

        # Currently running subprocess (None when idle)
        self._proc: asyncio.subprocess.Process | None = None

    # ---- public API -------------------------------------------------------

    @property
    def is_busy(self) -> bool:
        """True if a CLI subprocess is currently running."""
        return self._proc is not None and self._proc.returncode is None

    async def send_message(self, message: str) -> str:
        cmd = self._build_command(message)
        log.info("[send] cmd=%s, cwd=%s", cmd, self.cwd)

        try:
            kwargs: dict = dict(
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.cwd,
            )
            if sys.platform == "win32":
                kwargs["creationflags"] = (
                    subprocess.CREATE_NEW_PROCESS_GROUP
                )

            # Use shell=True on Windows so .cmd wrappers (e.g. gemini.cmd) work
            if sys.platform == "win32":
                shell_cmd = subprocess.list2cmdline(cmd)
                self._proc = await asyncio.create_subprocess_shell(shell_cmd, **kwargs)
            else:
                self._proc = await asyncio.create_subprocess_exec(*cmd, **kwargs)

            timeout = self.tool.get("max_timeout", 300)
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                self._proc.communicate(), timeout=timeout,
            )
        except asyncio.TimeoutError:
            log.warning("[send] Timeout after %ss — killing process", timeout)
            await self._kill_proc()
            return "[Error] Request timed out."
        except FileNotFoundError:
            self._proc = None
            return (
                f"[Error] `{self.cli_name}` is not installed or not in PATH."
            )
        except Exception as exc:
            log.error("[send] Subprocess error: %s", exc, exc_info=True)
            await self._kill_proc()
            return f"[Error] Failed to run `{self.cli_name}`: {exc}"

        returncode = self._proc.returncode
        self._proc = None  # process finished

        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")

        if returncode != 0:
            err_msg = stderr.strip() or stdout.strip() or "CLI exited with error"
            log.warning(
                "[send] Non-zero exit (%s): %s", returncode, err_msg[:200],
            )
            return f"[Error] {err_msg}"

        result, new_sid = self._parse_output(stdout)

        if new_sid:
            self.session_id = new_sid
            log.info("[send] Session ID: %s", new_sid)

        self.message_count += 1
        if self.started_at == 0.0:
            self.started_at = time.time()

        log.info(
            "[send] Response: %d chars, session=%s", len(result), self.session_id,
        )
        return result.strip() or "(no output)"

    async def kill(self) -> bool:
        """Kill the currently running CLI subprocess.

        Returns True if a process was killed, False if nothing was running.
        """
        if not self.is_busy:
            return False
        await self._kill_proc()
        log.info("[session] Killed running CLI process")
        return True

    async def new_session(self) -> None:
        await self.kill()
        self.session_id = None
        self.message_count = 0
        self.started_at = 0.0
        log.info("[session] Reset — next message starts a new conversation")

    def get_info(self) -> dict:
        return {
            "cli_name": self.cli_name,
            "tool_name": self.tool["name"],
            "cwd": self.cwd or os.getcwd(),
            "is_busy": self.is_busy,
            "message_count": self.message_count,
            "started_at": self.started_at,
            "session_id": self.session_id,
        }

    async def cleanup(self) -> None:
        """Kill any running process — called when the bot shuts down."""
        if self.is_busy:
            await self._kill_proc()
            log.info("[cleanup] Killed running CLI process on shutdown")
        else:
            log.info("[cleanup] No running process to stop")

    # ---- internals --------------------------------------------------------

    async def _kill_proc(self) -> None:
        """Forcefully kill the tracked subprocess."""
        proc = self._proc
        self._proc = None
        if proc is None:
            return
        try:
            proc.kill()
            await proc.wait()
        except Exception:
            pass

    def _build_command(self, message: str) -> list[str]:
        cmd = [self.tool["command"], "-p", message]
        cmd.extend(self.tool.get("extra_flags", []))
        resume_flag = self.tool.get("resume_flag")
        if self.session_id and resume_flag:
            cmd.extend([resume_flag, self.session_id])
        return cmd

    def _parse_output(self, raw: str) -> tuple[str, str | None]:
        """Extract response text and optional session_id from CLI output.

        For CLIs with json_output=True (Claude), parse JSON.
        Otherwise return plain text as-is.
        """
        if not self.tool.get("json_output"):
            return raw.strip(), None
        try:
            data = json.loads(raw)
            result = data.get("result", raw)
            session_id = data.get("session_id")
            return result, session_id
        except (json.JSONDecodeError, TypeError):
            return raw.strip(), None
