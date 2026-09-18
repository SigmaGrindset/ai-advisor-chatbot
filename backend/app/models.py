"""Database tables."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


#: The application has exactly one traveler, implicitly — there are no accounts.
#: Every other table still carries a real traveler reference, so supporting more
#: than one later is a middleware change rather than a migration.
SOLE_TRAVELER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class Traveler(Base):
    __tablename__ = "traveler"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
