import time

import discord
from discord.ext import commands

from config import CLI_TOOLS
from utils.security import is_allowed_user
from utils.session_manager import SessionManager
from utils.output_formatter import send_result


class AiCli(commands.Cog):
    """AI CLI — runs `cli -p` per message with session continuity."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.cli_name: str = bot.selected_cli
        self.tool: dict = CLI_TOOLS[self.cli_name]
        self.sessions = SessionManager(self.cli_name, cwd=bot.working_dir)

    async def cog_unload(self) -> None:
        await self.sessions.cleanup()

    # ------------------------------------------------------------------
    # !ask  (main command)
    # ------------------------------------------------------------------

    @commands.command(name="ask", aliases=["a"])
    @is_allowed_user()
    async def ask_cmd(self, ctx: commands.Context, *, message: str) -> None:
        """Send a message to the AI CLI."""
        async with ctx.typing():
            result = await self.sessions.send_message(message)
        await send_result(ctx, result, prefix=f"**{self.tool['name']}**")

    # ------------------------------------------------------------------
    # !session
    # ------------------------------------------------------------------

    @commands.group(name="session", aliases=["s"], invoke_without_command=True)
    @is_allowed_user()
    async def session_group(self, ctx: commands.Context) -> None:
        """Session management."""
        await ctx.invoke(self.session_info)

    @session_group.command(name="new")
    @is_allowed_user()
    async def session_new(self, ctx: commands.Context) -> None:
        """Start a fresh conversation on the next message."""
        await self.sessions.new_session()
        await ctx.reply(
            f"Session reset. Next `!ask` starts a new **{self.tool['name']}** conversation."
        )

    @session_group.command(name="info")
    @is_allowed_user()
    async def session_info(self, ctx: commands.Context) -> None:
        """Show current session information."""
        info = self.sessions.get_info()

        elapsed = int(time.time() - info["started_at"]) if info["started_at"] else 0
        mins, secs = divmod(elapsed, 60)
        has_session = info.get("session_id") is not None

        embed = discord.Embed(title="Session Info", color=0x5865F2)
        embed.add_field(name="CLI Tool", value=info["tool_name"], inline=True)
        embed.add_field(name="Status", value="Active" if has_session else "New", inline=True)
        embed.add_field(name="Messages", value=str(info["message_count"]), inline=True)
        embed.add_field(
            name="Duration",
            value=f"{mins}m {secs}s" if info["started_at"] else "—",
            inline=True,
        )
        embed.add_field(name="Working Directory", value=f"`{info['cwd']}`", inline=False)
        if info.get("session_id"):
            embed.add_field(
                name="Session ID",
                value=f"`{info['session_id'][:16]}…`",
                inline=False,
            )
        await ctx.reply(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AiCli(bot))
