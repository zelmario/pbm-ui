import tempfile

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_pbm_service
from ..schemas.profile import ProfileCreate, ProfileSyncRequest
from ..services.pbm_service import PBMService

router = APIRouter(tags=["profiles"])


@router.get("/instances/{instance_id}/profiles")
async def list_profiles(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.list_profiles()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instances/{instance_id}/profiles/{name}")
async def show_profile(name: str, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.show_profile(name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/profiles")
async def add_profile(body: ProfileCreate, service: PBMService = Depends(get_pbm_service)):
    try:
        # For local executor, write YAML to a temp file.
        # For SSH, the YAML needs to be on the remote host — we write it via SSH.
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(body.config_yaml)
            tmp_path = f.name
        result = await service.exec.execute(
            ["profile", "add", body.name, tmp_path, "-o", "json"]
        )
        if not result.ok:
            raise RuntimeError(result.stderr or result.stdout)
        try:
            return result.json()
        except Exception:
            return {"message": result.stdout.strip()}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/instances/{instance_id}/profiles/{name}")
async def remove_profile(name: str, service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.remove_profile(name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/instances/{instance_id}/profiles/sync")
async def sync_profiles(
    body: ProfileSyncRequest, service: PBMService = Depends(get_pbm_service)
):
    try:
        return await service.sync_profile(
            name=body.name, all_profiles=body.all, clear=body.clear
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
