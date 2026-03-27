from datetime import datetime

from pydantic import BaseModel


class InstanceCreate(BaseModel):
    name: str
    mongodb_uri: str
    pbm_version: str = "2.7.0"


class InstanceUpdate(BaseModel):
    name: str | None = None
    mongodb_uri: str | None = None
    pbm_version: str | None = None


class InstanceResponse(BaseModel):
    id: int
    name: str
    mongodb_uri: str
    pbm_version: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InstanceTestResult(BaseModel):
    success: bool
    message: str
    version: str | None = None
