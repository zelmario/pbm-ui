import asyncio
import logging
import os
import platform
import stat
import tarfile
import tempfile

logger = logging.getLogger(__name__)

PBM_BINS_DIR = "/app/pbm-bins"

# Percona download URL pattern
DOWNLOAD_URL = (
    "https://downloads.percona.com/downloads/percona-backup-mongodb/"
    "percona-backup-mongodb-{version}/binary/tarball/"
    "percona-backup-mongodb-{version}-{arch}.tar.gz"
)


def _get_arch() -> str:
    machine = platform.machine()
    if machine in ("x86_64", "amd64"):
        return "x86_64"
    elif machine in ("aarch64", "arm64"):
        return "aarch64"
    return machine


def get_pbm_path(version: str) -> str:
    return os.path.join(PBM_BINS_DIR, version, "pbm")


def is_version_installed(version: str) -> bool:
    path = get_pbm_path(version)
    return os.path.isfile(path) and os.access(path, os.X_OK)


async def ensure_pbm_binary(version: str) -> str:
    """Download pbm binary for the given version if not already cached. Returns the path."""
    pbm_path = get_pbm_path(version)

    if is_version_installed(version):
        return pbm_path

    logger.info(f"Downloading PBM {version}...")
    arch = _get_arch()
    url = DOWNLOAD_URL.format(version=version, arch=arch)

    version_dir = os.path.join(PBM_BINS_DIR, version)
    os.makedirs(version_dir, exist_ok=True)

    # Download in a thread to not block the event loop
    def _download():
        import urllib.request

        with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            urllib.request.urlretrieve(url, tmp_path)
            with tarfile.open(tmp_path, "r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.endswith("/bin/pbm") or member.name == "pbm":
                        member.name = "pbm"
                        tar.extract(member, version_dir)
                        break
                else:
                    # Try extracting and finding pbm
                    tar.extractall(version_dir)
                    # Search for the pbm binary
                    for root, dirs, files in os.walk(version_dir):
                        if "pbm" in files:
                            src = os.path.join(root, "pbm")
                            if src != pbm_path:
                                os.rename(src, pbm_path)
                            break

            os.chmod(pbm_path, os.stat(pbm_path).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        # Clean up extracted subdirectories, keep only the pbm binary
        for item in os.listdir(version_dir):
            item_path = os.path.join(version_dir, item)
            if item != "pbm" and os.path.isdir(item_path):
                import shutil
                shutil.rmtree(item_path)

    await asyncio.get_event_loop().run_in_executor(None, _download)

    if not is_version_installed(version):
        raise RuntimeError(f"Failed to install PBM {version}: binary not found after download")

    logger.info(f"PBM {version} installed at {pbm_path}")
    return pbm_path


async def list_installed_versions() -> list[str]:
    if not os.path.isdir(PBM_BINS_DIR):
        return []
    return [
        d for d in os.listdir(PBM_BINS_DIR)
        if is_version_installed(d)
    ]
