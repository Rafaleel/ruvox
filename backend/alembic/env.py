from alembic import context
from sqlmodel import SQLModel

from app.db import database_engine

engine = context.config.attributes.get("engine") or database_engine()
with engine.begin() as connection:
    # Serialize schema checks and DDL across simultaneous desktop launches.
    connection.exec_driver_sql("BEGIN IMMEDIATE")
    context.configure(connection=connection, target_metadata=SQLModel.metadata)
    with context.begin_transaction():
        context.run_migrations()
