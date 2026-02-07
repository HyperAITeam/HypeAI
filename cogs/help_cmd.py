import discord
from discord.ext import commands

from config import COMMAND_PREFIX, CLI_TOOLS
from utils.security import is_allowed_user


class HelpCmd(commands.Cog):
    """Custom help command."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.command(name="help")
    @is_allowed_user()
    async def help_cmd(self, ctx: commands.Context) -> None:
        """Show all available commands."""
        p = COMMAND_PREFIX
        tool_name = CLI_TOOLS[self.bot.selected_cli]["name"]

        embed = discord.Embed(
            title="AI CLI Gateway Bot",
            description=f"Currently using **{tool_name}**.",
            color=0x5865F2,
        )

        embed.add_field(
            name="AI CLI",
            value=(
                f"`{p}ask <message>` — Send message to {tool_name} (alias: `{p}a`)\n"
                f"`{p}session info` — Show session status (alias: `{p}s`)\n"
                f"`{p}session new` — Start a fresh conversation\n"
                f"`{p}session kill` — Kill running CLI process (alias: `{p}s stop`)"
            ),
            inline=False,
        )

        embed.add_field(
            name="CMD Execution",
            value=f"`{p}exec <command>` — Run a CMD command (aliases: `{p}run`, `{p}cmd`)",
            inline=False,
        )

        embed.add_field(
            name="System",
            value=(
                f"`{p}status` — Show system info (alias: `{p}sysinfo`)\n"
                f"`{p}help` — Show this message"
            ),
            inline=False,
        )

        embed.set_footer(text="Only authorized users can use this bot.")
        await ctx.reply(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(HelpCmd(bot))
