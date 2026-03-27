from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .database import async_session, init_db
from .models.user import User
from .routers import auth, backups, config, diagnostic, instances, logs, profiles, restores, status
from .services.auth import hash_password
from .services.instance_manager import InstanceManager


async def seed_admin():
    async with async_session() as db:
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is None:
            admin = User(
                username=settings.DEFAULT_ADMIN_USER,
                hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            )
            db.add(admin)
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_admin()
    app.state.instance_manager = InstanceManager()
    yield
    await app.state.instance_manager.close_all()


app = FastAPI(title="PBM UI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
for r in [
    auth.router,
    instances.router,
    status.router,
    backups.router,
    restores.router,
    config.router,
    profiles.router,
    logs.router,
    diagnostic.router,
]:
    app.include_router(r, prefix="/api")
