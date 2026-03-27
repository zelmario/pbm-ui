from sqlalchemy.ext.asyncio import AsyncSession

from ..models.instance import PBMInstance
from .local_executor import LocalExecutor
from .pbm_binary import ensure_pbm_binary
from .pbm_executor import PBMExecutor
from .pbm_service import PBMService


class InstanceManager:
    def __init__(self):
        self._executors: dict[int, PBMExecutor] = {}

    async def _create_executor(self, inst: PBMInstance) -> PBMExecutor:
        pbm_path = await ensure_pbm_binary(inst.pbm_version)
        return LocalExecutor(
            pbm_binary=pbm_path,
            mongodb_uri=inst.mongodb_uri,
        )

    async def get_service(self, instance_id: int, db: AsyncSession) -> PBMService:
        if instance_id not in self._executors:
            inst = await db.get(PBMInstance, instance_id)
            if not inst:
                raise ValueError(f"Instance {instance_id} not found")
            self._executors[instance_id] = await self._create_executor(inst)
        return PBMService(self._executors[instance_id])

    async def get_executor(self, instance_id: int, db: AsyncSession) -> PBMExecutor:
        if instance_id not in self._executors:
            inst = await db.get(PBMInstance, instance_id)
            if not inst:
                raise ValueError(f"Instance {instance_id} not found")
            self._executors[instance_id] = await self._create_executor(inst)
        return self._executors[instance_id]

    async def invalidate(self, instance_id: int):
        self._executors.pop(instance_id, None)

    async def close_all(self):
        self._executors.clear()
