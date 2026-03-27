from pydantic import BaseModel


class LogFilter(BaseModel):
    tail: int = 100
    severity: str | None = None
    event: str | None = None
    node: str | None = None
    opid: str | None = None
