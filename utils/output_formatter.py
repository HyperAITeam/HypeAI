import io
import discord
from config import DISCORD_MAX_LENGTH


def format_output(stdout: str, stderr: str, returncode: int | None) -> str:
    """Combine stdout/stderr into a single result string."""
    parts: list[str] = []
    if stdout.strip():
        parts.append(stdout.strip())
    if stderr.strip():
        parts.append(f"[stderr]\n{stderr.strip()}")
    if returncode is not None and returncode != 0:
        parts.append(f"(exit code: {returncode})")

    return "\n".join(parts) if parts else "(no output)"


async def send_result(
    ctx,
    content: str,
    *,
    prefix: str = "",
    lang: str = "",
) -> None:
    """Send a result to Discord, splitting or attaching as file if too long.

    - If content fits in one message, send in a code block.
    - If too long, send a preview + attach the full output as a .txt file.
    """
    if prefix:
        content = f"{prefix}\n{content}"

    # Wrap in code block
    if lang:
        wrapped = f"```{lang}\n{content}\n```"
    else:
        wrapped = f"```\n{content}\n```"

    if len(wrapped) <= DISCORD_MAX_LENGTH:
        await ctx.reply(wrapped)
        return

    # Too long: send preview + file attachment
    max_preview = DISCORD_MAX_LENGTH - 200  # room for wrapping and note
    preview = content[:max_preview]
    if lang:
        preview_msg = f"```{lang}\n{preview}\n```\n*(truncated — full output attached)*"
    else:
        preview_msg = f"```\n{preview}\n```\n*(truncated — full output attached)*"

    # Ensure even the preview message fits
    if len(preview_msg) > DISCORD_MAX_LENGTH:
        preview_msg = f"*(output too long — see attached file)*"

    file = discord.File(
        io.BytesIO(content.encode("utf-8")),
        filename="output.txt",
    )
    await ctx.reply(preview_msg, file=file)
