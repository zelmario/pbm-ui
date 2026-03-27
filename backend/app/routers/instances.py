from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_instance_manager
from ..models.instance import PBMInstance
from ..models.user import User
from ..schemas.instance import InstanceCreate, InstanceResponse, InstanceTestResult, InstanceUpdate
from ..services.instance_manager import InstanceManager

router = APIRouter(prefix="/instances", tags=["instances"])


@router.get("", response_model=list[InstanceResponse])
async def list_instances(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(PBMInstance).order_by(PBMInstance.name))
    return result.scalars().all()


@router.post("", response_model=InstanceResponse, status_code=201)
async def create_instance(
    body: InstanceCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    inst = PBMInstance(
        name=body.name,
        mongodb_uri=body.mongodb_uri,
        pbm_version=body.pbm_version,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


@router.get("/{instance_id}", response_model=InstanceResponse)
async def get_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    inst = await db.get(PBMInstance, instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    return inst


@router.put("/{instance_id}", response_model=InstanceResponse)
async def update_instance(
    instance_id: int,
    body: InstanceUpdate,
    db: AsyncSession = Depends(get_db),
    manager: InstanceManager = Depends(get_instance_manager),
    _user: User = Depends(get_current_user),
):
    inst = await db.get(PBMInstance, instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(inst, key, value)

    await db.commit()
    await db.refresh(inst)
    await manager.invalidate(instance_id)
    return inst


@router.delete("/{instance_id}", status_code=204)
async def delete_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    manager: InstanceManager = Depends(get_instance_manager),
    _user: User = Depends(get_current_user),
):
    inst = await db.get(PBMInstance, instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    await manager.invalidate(instance_id)
    await db.delete(inst)
    await db.commit()


@router.post("/{instance_id}/test", response_model=InstanceTestResult)
async def test_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    manager: InstanceManager = Depends(get_instance_manager),
    _user: User = Depends(get_current_user),
):
    try:
        executor = await manager.get_executor(instance_id, db)
        success, message = await executor.test_connection()
        return InstanceTestResult(
            success=success,
            message=message if not success else "Connection successful",
            version=message if success else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        return InstanceTestResult(success=False, message=str(e))
