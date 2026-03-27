from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_pbm_service
from ..schemas.config import ConfigBulkSetRequest, ConfigResyncRequest, ConfigSetRequest
from ..services.pbm_service import PBMService

router = APIRouter(tags=["config"])


@router.get("/instances/{instance_id}/config")
async def get_config(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.get_config()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.put("/instances/{instance_id}/config")
async def set_config(body: ConfigSetRequest, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.set_config(body.key, body.value)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.put("/instances/{instance_id}/config/bulk")
async def set_config_bulk(
    body: ConfigBulkSetRequest, service: PBMService = Depends(get_pbm_service)
):
    results = {}
    for key, value in body.settings.items():
        try:
            results[key] = await service.set_config(key, value)
        except RuntimeError as e:
            results[key] = {"error": str(e)}
    return results


@router.post("/instances/{instance_id}/config/resync")
async def resync_config(
    body: ConfigResyncRequest, service: PBMService = Depends(get_pbm_service)
):
    try:
        return await service.resync_config(include_restores=body.include_restores)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
