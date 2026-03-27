from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/pbm_ui.db"
    DEFAULT_ADMIN_USER: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
