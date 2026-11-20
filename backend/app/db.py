from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# check_same_thread only applies to SQLite; harmless to gate on the URL.
engine = create_engine(
    settings.ruvox_database_url,
    connect_args={"check_same_thread": False}
    if settings.ruvox_database_url.startswith("sqlite")
    else {},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
