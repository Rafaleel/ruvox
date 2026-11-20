import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session

from app.api.sessions import USER_ID
from app.db import get_session
from app.models import now_utc
from app.services.backup import BackupError, export_data, import_data, wipe_user_data

router = APIRouter(prefix="/api", tags=["backup"])
Db = Annotated[Session, Depends(get_session)]


@router.post("/backup/export")
def export_backup(db: Db) -> Response:
    """Everything the learner created, as a download. The API key is never included."""
    name = f"ruvox-backup-{now_utc():%Y%m%d}.json"
    return Response(
        json.dumps(export_data(db, USER_ID), ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.post("/backup/import")
def import_backup(data: dict[str, Any], db: Db) -> dict[str, int]:
    """Replace the learner's data with a backup file (all or nothing)."""
    try:
        counts = import_data(db, USER_ID, data)
    except BackupError as exc:
        db.rollback()
        raise HTTPException(422, str(exc)) from exc
    db.commit()
    return counts


@router.post("/data/reset", status_code=204)
def reset_data(db: Db) -> Response:
    """Wipe progress, sessions and songs. Settings and the seed content stay."""
    wipe_user_data(db, USER_ID)
    db.commit()
    return Response(status_code=204)
