from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.sessions import USER_ID
from app.db import get_session
from app.models import now_utc
from app.models.schemas import MasteryOut, StatsOut
from app.services.stats import activity, mastery

router = APIRouter(prefix="/api", tags=["stats"])
Db = Annotated[Session, Depends(get_session)]


@router.get("/stats", response_model=StatsOut)
def stats(db: Db) -> StatsOut:
    # Days are the machine's local days: a streak should follow the learner's clock.
    local_tz = datetime.now().astimezone().tzinfo
    assert local_tz is not None
    data: dict[str, Any] = activity(db, USER_ID, now_utc(), local_tz)
    return StatsOut(mastery=MasteryOut(**mastery(db, USER_ID)), **data)
