import platform
import time

import discord
import psutil
from discord.ext import commands

from utils.security import is_allowed_user


class Status(commands.Cog):
    """System status information."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.command(name="status", aliases=["sysinfo"])
    @is_allowed_user()
    async def status_cmd(self, ctx: commands.Context) -> None:
        """Show system status (CPU, memory, disk, uptime)."""
        cpu_percent = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")
        boot_time = psutil.boot_time()
        uptime_secs = int(time.time() - boot_time)
        hours, remainder = divmod(uptime_secs, 3600)
        minutes, seconds = divmod(remainder, 60)

        embed = discord.Embed(title="System Status", color=0x2ECC71)
        embed.add_field(
            name="OS",
            value=f"{platform.system()} {platform.release()}",
            inline=True,
        )
        embed.add_field(name="CPU", value=f"{cpu_percent}%", inline=True)
        embed.add_field(
            name="Memory",
            value=f"{mem.percent}% ({mem.used // (1024**3)}/{mem.total // (1024**3)} GB)",
            inline=True,
        )
        embed.add_field(
            name="Disk (C:)",
            value=f"{disk.percent}% ({disk.used // (1024**3)}/{disk.total // (1024**3)} GB)",
            inline=True,
        )
        embed.add_field(
            name="Uptime",
            value=f"{hours}h {minutes}m {seconds}s",
            inline=True,
        )
        embed.add_field(
            name="Python",
            value=platform.python_version(),
            inline=True,
        )

        await ctx.reply(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Status(bot))
