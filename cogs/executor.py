from discord.ext import commands

from config import COMMAND_TIMEOUT
from utils.security import is_allowed_user, is_command_blocked
from utils.subprocess_runner import run_command
from utils.output_formatter import format_output, send_result


class Executor(commands.Cog):
    """Execute CMD commands on the host machine."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.command(name="exec", aliases=["run", "cmd"])
    @is_allowed_user()
    async def exec_cmd(self, ctx: commands.Context, *, command: str) -> None:
        """Execute a CMD command."""
        if is_command_blocked(command):
            await ctx.reply("This command is blocked for safety reasons.")
            return

        async with ctx.typing():
            returncode, stdout, stderr = await run_command(
                command, timeout=COMMAND_TIMEOUT, shell=True
            )

        result = format_output(stdout, stderr, returncode)
        await send_result(ctx, result, prefix="**CMD**")


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Executor(bot))
