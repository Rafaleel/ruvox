from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(UTC)


class ItemKind(StrEnum):
    LETTER = "letter"
    WORD = "word"
    EXPRESSION = "expression"


class ItemSource(StrEnum):
    SEED = "seed"
    SONG = "song"


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=_now)


class Song(SQLModel, table=True):
    # Lyrics are pasted by the user and stay in the local DB; never bundled.
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    artist: str = ""
    text: str


class Item(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    kind: ItemKind
    text: str = Field(index=True)
    pronunciation: str  # approximate, for Brazilian Portuguese speakers
    meaning: str = ""
    source: ItemSource = ItemSource.SEED
    group: int | None = None  # alphabet group 1-3 for letters
    song_id: int | None = Field(default=None, foreign_key="song.id")


class StudySession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    started_at: datetime = Field(default_factory=_now)
    ended_at: datetime | None = None
    score: int = 0


class Question(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    session_id: int | None = Field(default=None, foreign_key="studysession.id", index=True)
    type: str
    prompt: str
    options: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    answer: str
    explanation: str = ""
    item_ids: list[int] = Field(default_factory=list, sa_column=Column(JSON))


class Attempt(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    question_id: int = Field(foreign_key="question.id", index=True)
    answer: str
    correct: bool
    grade: int = Field(ge=0, le=5)  # feeds the spaced repetition algorithm
    time_ms: int = 0
    created_at: datetime = Field(default_factory=_now)


class ReviewState(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    item_id: int = Field(foreign_key="item.id", primary_key=True)
    interval_days: int = 0
    ease: float = 2.5
    next_review: datetime = Field(default_factory=_now)
