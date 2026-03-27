import asyncio

from .pbm_executor import PBMExecutor, CommandResult


class LocalExecutor(PBMExecutor):
    def __init__(self, pbm_binary: str = "pbm", mongodb_uri: str | None = None):
        self.pbm_binary = pbm_binary
        self.mongodb_uri = mongodb_uri

    async def execute(self, args: list[str], timeout: int = 60) -> CommandResult:
        cmd = [self.pbm_binary]
        if self.mongodb_uri:
            cmd.extend(["--mongodb-uri", self.mongodb_uri])
        cmd.extend(args)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return CommandResult("", "Command timed out", 1)

        return CommandResult(
            stdout.decode(errors="replace"),
            stderr.decode(errors="replace"),
            proc.returncode or 0,
        )

    async def test_connection(self) -> tuple[bool, str]:
        try:
            result = await self.execute(["version"], timeout=10)
            if result.ok:
                return True, result.stdout.strip()
            return False, result.stderr.strip()
        except Exception as e:
            return False, str(e)
