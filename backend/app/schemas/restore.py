from pydantic import BaseModel


class RestoreRequest(BaseModel):
    backup_name: str


class PITRRestoreRequest(BaseModel):
    time: str


class OplogReplayRequest(BaseModel):
    start: str
    end: str
