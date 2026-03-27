import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from ..dependencies import get_pbm_service
from ..services.pbm_service import PBMService

router = APIRouter(tags=["logs"])


@router.get("/instances/{instance_id}/logs")
async def get_logs(
    service: PBMService = Depends(get_pbm_service),
    tail: int = Query(100, ge=1, le=5000),
    severity: str | None = Query(None),
    event: str | None = Query(None),
    node: str | None = Query(None),
    opid: str | None = Query(None),
):
    try:
        return await service.logs(
            tail=tail, severity=severity, event=event, node=node, opid=opid
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instances/{instance_id}/logs/stream")
async def stream_logs(
    service: PBMService = Depends(get_pbm_service),
    severity: str | None = Query(None),
    event: str | None = Query(None),
    node: str | None = Query(None),
):
    async def event_generator():
        seen: set[str] = set()
        while True:
            try:
                result = await service.logs(
                    tail=50, severity=severity, event=event, node=node
                )
                entries = result if isinstance(result, list) else []
                for entry in entries:
                    key = json.dumps(entry, sort_keys=True)
                    if key not in seen:
                        seen.add(key)
                        yield {"data": json.dumps(entry)}
                # Cap seen set size
                if len(seen) > 5000:
                    seen.clear()
            except Exception:
                pass
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
