import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import Request
from sqlalchemy import URL, Engine, event
from sqlalchemy.pool import ConnectionPoolEntry
from sqlmodel import Session, create_engine, select

from app.config import data_dir
from app.models import Item, User

ROOT = Path(__file__).resolve().parent.parent


def database_engine() -> Engine:
    directory = data_dir()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    engine = create_engine(URL.create("sqlite", database=str(directory / "ruvox.db")))
    event.listen(engine, "connect", enable_foreign_keys)
    return engine


def enable_foreign_keys(connection: sqlite3.Connection, _: ConnectionPoolEntry) -> None:
    connection.execute("PRAGMA foreign_keys=ON")


def run_migrations(engine: Engine) -> None:
    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["engine"] = engine
    command.upgrade(config, "head")


def seed(session: Session) -> None:
    session.connection().exec_driver_sql("BEGIN IMMEDIATE")
    if session.get(User, 1) is None:
        session.add(User(id=1, name="Estudante"))
        session.flush()
    existing = set(
        session.exec(
            select(Item.text).where(
                Item.kind == "letter", Item.source == "seed", Item.user_id == 1
            )
        )
    )
    alphabet = json.loads((ROOT / "app/data/alphabet.json").read_text(encoding="utf-8"))
    for letter in alphabet:
        if letter["text"] not in existing:
            session.add(
                Item(kind="letter", source="seed", meaning=letter["text"], **letter)
            )
    session.commit()


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
