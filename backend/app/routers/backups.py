from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_pbm_service
from ..schemas.backup import BackupCreate, BackupDeleteRequest, CleanupRequest, PITRDeleteRequest
from ..services.pbm_service import PBMService

router = APIRouter(tags=["backups"])


@router.get("/instances/{instance_id}/backups")
async def list_backups(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.list_backups_with_size()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/backups")
async def create_backup(body: BackupCreate, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.create_backup(
            backup_type=body.type,
            compression=body.compression,
            compression_level=body.compression_level,
            ns=body.ns,
            profile=body.profile,
            base=body.base,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instances/{instance_id}/backups/{name}")
async def describe_backup(name: str, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.describe_backup(name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/instances/{instance_id}/backups/{name}")
async def delete_backup(name: str, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.delete_backup(name=name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/backups/delete")
async def delete_backups_bulk(
    body: BackupDeleteRequest, service: PBMService = Depends(get_pbm_service)
):
    try:
        return await service.delete_backup(
            older_than=body.older_than, backup_type=body.type, profile=body.profile
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/backups/cancel")
async def cancel_backup(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.cancel_backup()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/cleanup")
async def cleanup(body: CleanupRequest, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.cleanup(
            older_than=body.older_than, profile=body.profile, dry_run=body.dry_run
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/instances/{instance_id}/pitr")
async def delete_pitr(body: PITRDeleteRequest, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.delete_pitr(older_than=body.older_than, all_chunks=body.all)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
