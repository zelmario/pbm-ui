from .pbm_executor import PBMExecutor, CommandResult


class PBMService:
    def __init__(self, executor: PBMExecutor):
        self.exec = executor

    async def _run(self, args: list[str], timeout: int = 60) -> dict | list | str:
        result = await self.exec.execute(args, timeout=timeout)
        if not result.ok:
            raise RuntimeError(result.stderr or result.stdout or "PBM command failed")
        try:
            return result.json()
        except Exception:
            return result.stdout.strip()

    # --- Status ---
    async def status(self) -> dict:
        return await self._run(["status", "-o", "json"])

    # --- Backups ---
    async def list_backups(self) -> dict:
        return await self._run(["list", "-o", "json"])

    async def create_backup(
        self,
        backup_type: str = "logical",
        compression: str | None = None,
        compression_level: int | None = None,
        ns: str | None = None,
        profile: str | None = None,
        base: bool = False,
    ) -> dict:
        args = ["backup", "--type", backup_type, "-o", "json"]
        if base and backup_type == "incremental":
            args.append("--base")
        if compression:
            args.extend(["--compression", compression])
        if compression_level is not None:
            args.extend(["--compression-level", str(compression_level)])
        if ns:
            args.extend(["--ns", ns])
        if profile:
            args.extend(["--profile", profile])
        return await self._run(args, timeout=30)

    async def describe_backup(self, name: str) -> dict:
        return await self._run(["describe-backup", name, "-o", "json"])

    async def list_backups_with_size(self) -> dict:
        """List backups and enrich each snapshot with size from describe-backup."""
        import asyncio

        data = await self.list_backups()
        snapshots = data.get("snapshots") or []

        async def enrich(snap: dict) -> dict:
            try:
                detail = await self.describe_backup(snap["name"])
                snap["size"] = detail.get("size", 0)
                snap["size_h"] = detail.get("size_h", "")
            except Exception:
                snap["size"] = 0
                snap["size_h"] = ""
            return snap

        if snapshots:
            await asyncio.gather(*(enrich(s) for s in snapshots))
        return data

    async def delete_backup(
        self,
        name: str | None = None,
        older_than: str | None = None,
        backup_type: str | None = None,
        profile: str | None = None,
    ) -> str:
        args = ["delete-backup", "-y"]
        if name:
            args.append(name)
        if older_than:
            args.extend(["--older-than", older_than])
        if backup_type:
            args.extend(["--type", backup_type])
        if profile:
            args.extend(["--profile", profile])
        # delete-backup waits for completion, needs longer timeout
        result = await self.exec.execute(args, timeout=300)
        if not result.ok:
            raise RuntimeError(result.stderr or result.stdout or "Delete failed")
        return result.stdout.strip()

    async def cancel_backup(self) -> str:
        return await self._run(["cancel-backup", "-o", "json"])

    async def cleanup(
        self,
        older_than: str,
        profile: str | None = None,
        dry_run: bool = False,
    ) -> str:
        args = ["cleanup", "--older-than", older_than, "-y"]
        if profile:
            args.extend(["--profile", profile])
        if dry_run:
            args.append("--dry-run")
        result = await self.exec.execute(args, timeout=300)
        if not result.ok:
            raise RuntimeError(result.stderr or result.stdout or "Cleanup failed")
        return result.stdout.strip()

    # --- PITR ---
    async def delete_pitr(
        self, older_than: str | None = None, all_chunks: bool = False
    ) -> str:
        args = ["delete-pitr", "-y"]
        if all_chunks:
            args.append("-a")
        elif older_than:
            args.extend(["--older-than", older_than])
        result = await self.exec.execute(args, timeout=300)
        if not result.ok:
            raise RuntimeError(result.stderr or result.stdout or "Delete PITR failed")
        return result.stdout.strip()

    # --- Restores ---
    async def restore(self, backup_name: str) -> dict:
        return await self._run(["restore", backup_name, "-o", "json"], timeout=30)

    async def restore_pitr(self, time: str) -> dict:
        return await self._run(["restore", "--time", time, "-o", "json"], timeout=30)

    async def describe_restore(self, name: str) -> dict:
        return await self._run(["describe-restore", name, "-o", "json"])

    async def list_restores(self) -> dict:
        return await self._run(["list", "--restore", "-o", "json"])

    async def oplog_replay(self, start: str, end: str) -> dict:
        return await self._run(
            ["oplog-replay", "--start", start, "--end", end, "-o", "json"],
            timeout=120,
        )

    # --- Config ---
    async def get_config(self) -> dict:
        return await self._run(["config", "--list", "-o", "json"])

    async def set_config(self, key: str, value: str) -> str:
        return await self._run(["config", "--set", f"{key}={value}", "-o", "json"])

    async def resync_config(self, include_restores: bool = False) -> str:
        args = ["config", "--force-resync"]
        if include_restores:
            args.append("--include-restores")
        # resync doesn't support -o json
        result = await self.exec.execute(args, timeout=120)
        if not result.ok:
            raise RuntimeError(result.stderr or result.stdout or "Resync failed")
        return result.stdout.strip()

    # --- Profiles ---
    async def list_profiles(self) -> dict:
        return await self._run(["profile", "list", "-o", "json"])

    async def show_profile(self, name: str) -> dict:
        return await self._run(["profile", "show", name, "-o", "json"])

    async def remove_profile(self, name: str) -> str:
        return await self._run(["profile", "remove", name, "-o", "json"])

    async def sync_profile(
        self,
        name: str | None = None,
        all_profiles: bool = False,
        clear: bool = False,
    ) -> str:
        args = ["profile", "sync"]
        if name:
            args.append(name)
        if all_profiles:
            args.append("--all")
        if clear:
            args.append("--clear")
        args.extend(["-o", "json"])
        return await self._run(args)

    # --- Logs ---
    async def logs(
        self,
        tail: int = 100,
        severity: str | None = None,
        event: str | None = None,
        node: str | None = None,
        opid: str | None = None,
    ) -> dict:
        args = ["logs", "-t", str(tail), "-o", "json"]
        if severity:
            args.extend(["-s", severity])
        if event:
            args.extend(["-e", event])
        if node:
            args.extend(["-n", node])
        if opid:
            args.extend(["-i", opid])
        return await self._run(args)

    # --- Diagnostic ---
    async def diagnostic(self) -> str:
        result = await self.exec.execute(["diagnostic"], timeout=120)
        if not result.ok:
            raise RuntimeError(result.stderr or "Diagnostic failed")
        return result.stdout
