from pydantic import BaseModel


class ConfigSetRequest(BaseModel):
    key: str
    value: str


class ConfigBulkSetRequest(BaseModel):
    settings: dict[str, str]


class ConfigResyncRequest(BaseModel):
    include_restores: bool = False
