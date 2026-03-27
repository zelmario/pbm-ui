from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_pbm_service
from ..services.pbm_service import PBMService

router = APIRouter(tags=["status"])


@router.get("/instances/{instance_id}/status")
async def get_status(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.status()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
