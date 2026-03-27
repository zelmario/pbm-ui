from abc import ABC, abstractmethod
from dataclasses import dataclass
import json


@dataclass
class CommandResult:
    stdout: str
    stderr: str
    return_code: int

    def json(self) -> dict | list:
        return json.loads(self.stdout)

    @property
    def ok(self) -> bool:
        return self.return_code == 0


class PBMExecutor(ABC):
    @abstractmethod
    async def execute(self, args: list[str], timeout: int = 60) -> CommandResult:
        ...

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        ...

    async def close(self):
        pass
