import discord
from discord.ext import commands
from config import ALLOWED_USER_IDS, BLOCKED_COMMANDS


def is_allowed_user():
    """Check decorator: only whitelisted users can use commands."""

    async def predicate(ctx: commands.Context) -> bool:
        if not ALLOWED_USER_IDS:
            return True
        if ctx.author.id not in ALLOWED_USER_IDS:
            await ctx.reply("You are not authorized to use this bot.")
            return False
        return True

    return commands.check(predicate)


def is_command_blocked(command: str) -> bool:
    """Check if a CMD command is in the blocklist."""
    cmd_lower = command.strip().lower()
    for blocked in BLOCKED_COMMANDS:
        if cmd_lower.startswith(blocked):
            return True
    return False
