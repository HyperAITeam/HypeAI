import asyncio
import sys


async def run_command(
    command: str | list[str],
    timeout: int = 30,
    shell: bool = True,
    cwd: str | None = None,
) -> tuple[int | None, str, str]:
    """Run a command asynchronously and return (returncode, stdout, stderr).

    On Windows, uses CREATE_NEW_PROCESS_GROUP so the child tree can be killed.
    stdin is set to DEVNULL to prevent interactive hangs.
    """
    kwargs: dict = {
        "stdin": asyncio.subprocess.DEVNULL,
        "stdout": asyncio.subprocess.PIPE,
        "stderr": asyncio.subprocess.PIPE,
    }

    if sys.platform == "win32":
        import subprocess as _sp
        kwargs["creationflags"] = _sp.CREATE_NEW_PROCESS_GROUP

    if cwd:
        kwargs["cwd"] = cwd

    if shell:
        proc = await asyncio.create_subprocess_shell(command, **kwargs)
    else:
        if isinstance(command, str):
            command = command.split()
        proc = await asyncio.create_subprocess_exec(*command, **kwargs)

    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
    except asyncio.TimeoutError:
        _kill_process(proc)
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            pass
        return None, "", f"Command timed out after {timeout}s"

    stdout = _decode(stdout_bytes)
    stderr = _decode(stderr_bytes)
    return proc.returncode, stdout, stderr


def _kill_process(proc: asyncio.subprocess.Process) -> None:
    """Kill a process, handling Windows process groups."""
    try:
        proc.kill()
    except ProcessLookupError:
        pass


def _decode(data: bytes) -> str:
    """Decode bytes with fallback chain: utf-8 → cp949 → cp437 → latin-1."""
    if not data:
        return ""
    for encoding in ("utf-8", "cp949", "cp437", "latin-1"):
        try:
            return data.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("latin-1", errors="replace")
