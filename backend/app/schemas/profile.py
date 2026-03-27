from pydantic import BaseModel


class ProfileCreate(BaseModel):
    name: str
    config_yaml: str


class ProfileSyncRequest(BaseModel):
    name: str | None = None
    all: bool = False
    clear: bool = False
