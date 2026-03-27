from pydantic import BaseModel


class BackupCreate(BaseModel):
    type: str = "logical"
    compression: str | None = None
    compression_level: int | None = None
    ns: str | None = None
    profile: str | None = None
    base: bool = False


class BackupDeleteRequest(BaseModel):
    older_than: str | None = None
    type: str | None = None
    profile: str | None = None


class CleanupRequest(BaseModel):
    older_than: str
    profile: str | None = None
    dry_run: bool = False


class PITRDeleteRequest(BaseModel):
    older_than: str | None = None
    all: bool = False
