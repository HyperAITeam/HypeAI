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
# SessionManager — runs `claude -p` per message with session continuity
# ---------------------------------------------------------------------------
class SessionManager:
    """Sends messages via `cli -p` and maintains conversation via --resume.

    Each message spawns a short-lived subprocess.  Conversation history
    is preserved through Claude Code's ``--resume <session_id>`` flag.
    """

    def __init__(self, cli_name: str, cwd: str | None = None) -> None:
        self.cli_name = cli_name
        self.cwd = cwd
        self.tool = CLI_TOOLS[cli_name]

        self.session_id: str | None = None
        self.message_count: int = 0
        self.started_at: float = 0.0

    # ---- public API -------------------------------------------------------

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

            proc = await asyncio.create_subprocess_exec(*cmd, **kwargs)

            timeout = self.tool.get("max_timeout", 300)
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout,
            )
        except asyncio.TimeoutError:
            log.warning("[send] Timeout after %ss — killing process", timeout)
            try:
                proc.kill()
            except Exception:
                pass
            return "[Error] Request timed out."
        except FileNotFoundError:
            return (
                f"[Error] `{self.cli_name}` is not installed or not in PATH."
            )
        except Exception as exc:
            log.error("[send] Subprocess error: %s", exc, exc_info=True)
            return f"[Error] Failed to run `{self.cli_name}`: {exc}"

        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")

        if proc.returncode != 0:
            err_msg = stderr.strip() or stdout.strip() or "CLI exited with error"
            log.warning(
                "[send] Non-zero exit (%s): %s", proc.returncode, err_msg[:200],
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

    async def new_session(self) -> None:
        self.session_id = None
        self.message_count = 0
        self.started_at = 0.0
        log.info("[session] Reset — next message starts a new conversation")

    def get_info(self) -> dict:
        return {
            "cli_name": self.cli_name,
            "tool_name": self.tool["name"],
            "cwd": self.cwd or os.getcwd(),
            "is_alive": True,
            "message_count": self.message_count,
            "started_at": self.started_at,
            "session_id": self.session_id,
        }

    async def cleanup(self) -> None:
        log.info("Session cleanup (nothing to stop)")

    # ---- internals --------------------------------------------------------

    def _build_command(self, message: str) -> list[str]:
        cmd = [
            self.tool["command"],
            "-p", message,
            "--output-format", "json",
            "--dangerously-skip-permissions",
        ]
        if self.session_id:
            cmd.extend(["--resume", self.session_id])
        return cmd

    @staticmethod
    def _parse_output(raw: str) -> tuple[str, str | None]:
        """Extract response text and session_id from JSON output.

        Falls back to returning the raw text if JSON parsing fails
        (e.g. for non-Claude CLIs that don't support --output-format json).
        """
        try:
            data = json.loads(raw)
            result = data.get("result", raw)
            session_id = data.get("session_id")
            return result, session_id
        except (json.JSONDecodeError, TypeError):
            return raw.strip(), None
