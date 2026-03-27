from datetime import datetime

from sqlalchemy import String, DateTime, Text, func

from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class PBMInstance(Base):
    __tablename__ = "pbm_instances"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    mongodb_uri: Mapped[str] = mapped_column(Text)
    pbm_version: Mapped[str] = mapped_column(String(50), default="2.7.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
