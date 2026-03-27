from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_pbm_service
from ..schemas.restore import OplogReplayRequest, PITRRestoreRequest, RestoreRequest
from ..services.pbm_service import PBMService

router = APIRouter(tags=["restores"])


@router.post("/instances/{instance_id}/restores")
async def start_restore(body: RestoreRequest, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.restore(backup_name=body.backup_name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/restores/pitr")
async def pitr_restore(body: PITRRestoreRequest, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.restore_pitr(time=body.time)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instances/{instance_id}/restores")
async def list_restores(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.list_restores()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instances/{instance_id}/restores/{name}")
async def describe_restore(name: str, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.describe_restore(name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/oplog-replay")
async def oplog_replay(body: OplogReplayRequest, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.oplog_replay(start=body.start, end=body.end)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
