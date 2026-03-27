import io
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse

from ..dependencies import get_pbm_service
from ..services.pbm_service import PBMService

router = APIRouter(tags=["diagnostic"])


@router.get("/instances/{instance_id}/diagnostic", response_class=PlainTextResponse)
async def get_diagnostic(service: PBMService = Depends(get_pbm_service)):
    try:
        return await service.diagnostic()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instances/{instance_id}/troubleshoot")
async def get_troubleshoot_bundle(service: PBMService = Depends(get_pbm_service)):
    commands = {
        "list.out": ["list"],
        "status.out": ["status"],
        "config.out": ["config", "--list"],
        "logs.out": ["logs", "-s", "D", "-t", "0"],
    }

    files: dict[str, str] = {}
    for filename, args in commands.items():
        result = await service.exec.execute(args, timeout=120)
        files[filename] = result.stdout if result.ok else f"ERROR (exit {result.return_code}):\n{result.stderr}\n{result.stdout}"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, content in files.items():
            zf.writestr(filename, content)
    buf.seek(0)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="pbm_troubleshoot_{timestamp}.zip"'},
    )
