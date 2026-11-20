"""Export and import of everything the learner created.

Seed content is not exported: it ships with the app. Review states of seed items are
exported by (kind, text), so a backup still imports after the seed gains new words.
"""

from datetime import datetime
from typing import Any

from sqlmodel import Session, col, delete, select

from app.models import (
    Attempt,
    Item,
    Question,
    ReviewState,
    Song,
    StudySession,
    UserProfile,
    now_utc,
)

VERSION = 1


class BackupError(ValueError):
    pass


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _ref(item: Item) -> dict[str, Any]:
    # Seed ids may change between versions, so seed items are referenced by content.
    return (
        {"seed": [item.kind, item.text]} if item.source == "seed" else {"ref": item.id}
    )


def export_data(db: Session, user_id: int) -> dict[str, Any]:
    items = {i.id: i for i in db.exec(select(Item).where(Item.user_id == user_id))}
    review: list[dict[str, Any]] = []
    for state in db.exec(select(ReviewState).where(ReviewState.user_id == user_id)):
        item = items.get(state.item_id)
        if item is None:
            continue
        review.append(
            {
                "item": _ref(item),
                "repetitions": state.repetitions,
                "interval_days": state.interval_days,
                "ease": state.ease,
                "next_review": _iso(state.next_review),
                "last_grade": state.last_grade,
            }
        )
    profile = db.get(UserProfile, user_id)
    return {
        "version": VERSION,
        "exported_at": now_utc().isoformat(),
        "songs": [
            {
                "ref": s.id,
                "title": s.title,
                "artist": s.artist,
                "text": s.text,
                "created_at": _iso(s.created_at),
            }
            for s in db.exec(select(Song).where(Song.user_id == user_id))
        ],
        "items": [
            {
                "ref": i.id,
                "kind": i.kind,
                "text": i.text,
                "pronunciation": i.pronunciation,
                "meaning": i.meaning,
                "difficulty": i.difficulty,
                "song_ref": i.song_id,
                "excerpt": i.excerpt,
            }
            for i in items.values()
            if i.source == "song"
        ],
        "review": review,
        "sessions": [
            {
                "ref": s.id,
                "mode": s.mode,
                "started_at": _iso(s.started_at),
                "ended_at": _iso(s.ended_at),
                "score": s.score,
            }
            for s in db.exec(
                select(StudySession).where(StudySession.user_id == user_id)
            )
        ],
        "questions": [
            {
                "ref": q.id,
                "session_ref": q.session_id,
                "type": q.type,
                "prompt": q.prompt,
                "options": q.options,
                "answer": q.answer,
                "explanation": q.explanation,
                "item_refs": [_ref(items[i]) for i in q.item_ids if i in items],
                "input_kind": q.input_kind,
            }
            for q in db.exec(select(Question).where(Question.user_id == user_id))
        ],
        "attempts": [
            {
                "question_ref": a.question_id,
                "answer": a.answer,
                "correct": a.correct,
                "grade": a.grade,
                "time_ms": a.time_ms,
                "created_at": _iso(a.created_at),
            }
            for a in db.exec(select(Attempt).where(Attempt.user_id == user_id))
        ],
        "profile": {
            "level": profile.level,
            "weak_points": profile.weak_points,
            "preferences": profile.preferences,
        }
        if profile
        else None,
    }


def wipe_user_data(db: Session, user_id: int) -> None:
    """Delete everything the learner created; seed items and settings stay."""
    song_item_ids = db.exec(
        select(Item.id).where(Item.user_id == user_id, Item.source == "song")
    ).all()
    for model in (Attempt, Question, StudySession, ReviewState):
        db.exec(delete(model).where(col(model.user_id) == user_id))
    if song_item_ids:
        db.exec(delete(Item).where(col(Item.id).in_(song_item_ids)))
    db.exec(delete(Song).where(col(Song.user_id) == user_id))
    db.exec(delete(UserProfile).where(col(UserProfile.user_id) == user_id))


def import_data(db: Session, user_id: int, data: dict[str, Any]) -> dict[str, int]:
    """Replace the learner's data with a backup. The caller owns the transaction."""
    if data.get("version") != VERSION:
        raise BackupError("Este arquivo não é um backup do Ruvox compatível.")
    try:
        return _import(db, user_id, data)
    except (KeyError, TypeError, ValueError) as exc:
        raise BackupError("O backup está incompleto ou corrompido.") from exc


def _import(db: Session, user_id: int, data: dict[str, Any]) -> dict[str, int]:
    seed = {
        (i.kind, i.text): i.id
        for i in db.exec(
            select(Item).where(Item.user_id == user_id, Item.source == "seed")
        )
    }
    wipe_user_data(db, user_id)

    song_ids: dict[int, int] = {}
    for raw in data["songs"]:
        song = Song(
            user_id=user_id,
            title=raw["title"],
            artist=raw["artist"],
            text=raw["text"],
            created_at=_dt(raw["created_at"]) or now_utc(),
        )
        db.add(song)
        db.flush()
        assert song.id is not None
        song_ids[raw["ref"]] = song.id

    item_ids: dict[int, int] = {}
    for raw in data["items"]:
        item = Item(
            user_id=user_id,
            kind=raw["kind"],
            text=raw["text"],
            pronunciation=raw["pronunciation"],
            meaning=raw["meaning"],
            source="song",
            difficulty=raw["difficulty"],
            song_id=song_ids[raw["song_ref"]],
            excerpt=raw.get("excerpt", ""),
        )
        db.add(item)
        db.flush()
        assert item.id is not None
        item_ids[raw["ref"]] = item.id

    def resolve(ref: dict[str, Any]) -> int | None:
        return (
            seed.get(tuple(ref["seed"])) if "seed" in ref else item_ids.get(ref["ref"])
        )

    restored = 0
    for raw in data["review"]:
        item_id = resolve(raw["item"])
        if item_id is None:
            continue  # a seed item this version no longer has
        db.add(
            ReviewState(
                user_id=user_id,
                item_id=item_id,
                repetitions=raw["repetitions"],
                interval_days=raw["interval_days"],
                ease=raw["ease"],
                next_review=_dt(raw["next_review"]) or now_utc(),
                last_grade=raw["last_grade"],
            )
        )
        restored += 1

    session_ids: dict[int, int] = {}
    for raw in data["sessions"]:
        study = StudySession(
            user_id=user_id,
            mode=raw["mode"],
            started_at=_dt(raw["started_at"]) or now_utc(),
            ended_at=_dt(raw["ended_at"]),
            score=raw["score"],
        )
        db.add(study)
        db.flush()
        assert study.id is not None
        session_ids[raw["ref"]] = study.id

    question_ids: dict[int, int] = {}
    for raw in data["questions"]:
        question = Question(
            user_id=user_id,
            session_id=session_ids[raw["session_ref"]],
            type=raw["type"],
            prompt=raw["prompt"],
            options=raw["options"],
            answer=raw["answer"],
            explanation=raw["explanation"],
            item_ids=[i for ref in raw["item_refs"] if (i := resolve(ref)) is not None],
            input_kind=raw["input_kind"],
        )
        db.add(question)
        db.flush()
        assert question.id is not None
        question_ids[raw["ref"]] = question.id

    for raw in data["attempts"]:
        db.add(
            Attempt(
                user_id=user_id,
                question_id=question_ids[raw["question_ref"]],
                answer=raw["answer"],
                correct=raw["correct"],
                grade=raw["grade"],
                time_ms=raw["time_ms"],
                created_at=_dt(raw["created_at"]) or now_utc(),
            )
        )
    if data.get("profile"):
        db.add(UserProfile(user_id=user_id, **data["profile"]))
    return {
        "songs": len(song_ids),
        "items": len(item_ids),
        "review_states": restored,
        "sessions": len(session_ids),
        "attempts": len(data["attempts"]),
    }
