from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from app.api.sessions import USER_ID
from app.db import get_session
from app.models import Item, ReviewState, now_utc
from app.models.schemas import GroupProgress, ItemOut, LetterStatus, ProgressOut
from app.services.selection import as_utc, unlocked_items
from app.services.stats import bucket

router = APIRouter(prefix="/api", tags=["progress"])
Db = Annotated[Session, Depends(get_session)]


@router.get("/items", response_model=list[ItemOut])
def items(db: Db, kind: str | None = None, source: str | None = None) -> list[ItemOut]:
    query = select(Item).where(Item.user_id == USER_ID).order_by(col(Item.id))
    if kind:
        query = query.where(Item.kind == kind)
    if source:
        query = query.where(Item.source == source)
    return [ItemOut.model_validate(i.model_dump()) for i in db.exec(query)]


@router.get("/progress", response_model=ProgressOut)
def progress(db: Db) -> ProgressOut:
    seed_items = db.exec(
        select(Item).where(Item.user_id == USER_ID, Item.source == "seed")
    ).all()
    states = {
        s.item_id: s
        for s in db.exec(select(ReviewState).where(ReviewState.user_id == USER_ID))
    }
    now = now_utc()
    letters = [i for i in seed_items if i.kind == "letter"]
    groups = [
        GroupProgress(
            group=g,
            total=len(members),
            learned=sum(
                1 for i in members if i.id in states and states[i.id].repetitions >= 2
            ),
        )
        for g in sorted({i.group for i in letters if i.group})
        if (members := [i for i in letters if i.group == g])
    ]
    words = [i for i in seed_items if i.kind == "word"]
    open_items = {i.id for i in unlocked_items(seed_items, states)}
    return ProgressOut(
        due_count=sum(1 for s in states.values() if as_utc(s.next_review) <= now),
        groups=groups,
        words_unlocked=sum(1 for w in words if w.id in open_items),
        words_total=len(words),
    )


@router.get("/progress/letters", response_model=list[LetterStatus])
def letters(db: Db) -> list[LetterStatus]:
    """Every alphabet letter with how well it is known (the alphabet map)."""
    items = db.exec(
        select(Item)
        .where(Item.user_id == USER_ID, Item.kind == "letter")
        .order_by(col(Item.id))
    ).all()
    states = {
        s.item_id: s
        for s in db.exec(select(ReviewState).where(ReviewState.user_id == USER_ID))
    }
    return [
        LetterStatus(
            id=item.id or 0,
            text=item.text,
            pronunciation=item.pronunciation,
            group=item.group or 0,
            status=bucket(states.get(item.id or 0)),  # type: ignore[arg-type]
        )
        for item in items
    ]
