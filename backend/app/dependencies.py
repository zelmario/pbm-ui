from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models.user import User
from .services.auth import decode_token
from .services.instance_manager import InstanceManager
from .services.pbm_service import PBMService

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    username = decode_token(credentials.credentials)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_instance_manager(request: Request) -> InstanceManager:
    return request.app.state.instance_manager


async def get_pbm_service(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    manager: InstanceManager = Depends(get_instance_manager),
    _user: User = Depends(get_current_user),
) -> PBMService:
    try:
        return await manager.get_service(instance_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
