from datetime import UTC, datetime

from sqlalchemy import JSON, Index, UniqueConstraint, text
from sqlmodel import Field, SQLModel


def now_utc() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=now_utc)


class Owned(SQLModel):
    user_id: int = Field(default=1, foreign_key="user.id")


class Song(Owned, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    artist: str
    text: str
    created_at: datetime = Field(default_factory=now_utc)


class Item(Owned, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "source", "kind", "text", "song_id"),
        Index(
            "uq_seed_item",
            "user_id",
            "source",
            "kind",
            "text",
            unique=True,
            sqlite_where=text("song_id IS NULL"),
        ),
    )
    id: int | None = Field(default=None, primary_key=True)
    kind: str
    text: str
    pronunciation: str
    meaning: str
    source: str
    group: int | None = None
    difficulty: int = 1
    song_id: int | None = Field(default=None, foreign_key="song.id")
    excerpt: str = (
        ""  # short phrase from the lyric (at most 8 words) for cloze questions
    )


class StudySession(Owned, table=True):
    id: int | None = Field(default=None, primary_key=True)
    mode: str
    started_at: datetime = Field(default_factory=now_utc)
    ended_at: datetime | None = None
    score: int = 0


class Question(Owned, table=True):
    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="studysession.id")
    type: str
    prompt: str
    options: list[str] = Field(sa_type=JSON)
    answer: str
    explanation: str
    item_ids: list[int] = Field(sa_type=JSON)
    input_kind: str


class Attempt(Owned, table=True):
    id: int | None = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="question.id")
    answer: str
    correct: bool
    grade: int
    time_ms: int
    created_at: datetime = Field(default_factory=now_utc)


class ReviewState(SQLModel, table=True):
    user_id: int = Field(default=1, foreign_key="user.id", primary_key=True)
    item_id: int = Field(foreign_key="item.id", primary_key=True)
    repetitions: int = 0
    interval_days: int = 0
    ease: float = 2.5
    next_review: datetime = Field(default_factory=now_utc)
    last_grade: int | None = None


class LLMCall(SQLModel, table=True):
    """One model call: what ran, how long it took and what it cost."""

    id: int | None = Field(default=None, primary_key=True)
    agent: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    cost_usd: float = 0.0
    ok: bool = True
    error: str = ""
    created_at: datetime = Field(default_factory=now_utc)


class UserProfile(SQLModel, table=True):
    user_id: int = Field(default=1, foreign_key="user.id", primary_key=True)
    level: str = "beginner"
    weak_points: list[int] = Field(default_factory=list, sa_type=JSON)  # item ids
    preferences: dict[str, str] = Field(default_factory=dict, sa_type=JSON)
    updated_at: datetime = Field(default_factory=now_utc)
