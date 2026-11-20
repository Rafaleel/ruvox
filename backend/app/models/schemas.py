from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.questions import QuestionType


class QuestionOut(BaseModel):
    """What the client sees: never the answer or the explanation."""

    id: int
    type: QuestionType
    prompt: str
    input_kind: Literal["choice", "text"]
    options: list[str]
    item_ids: list[int]


class SessionCreate(BaseModel):
    mode: Literal["mixed", 1, 2, 3, 4] = "mixed"
    size: int = Field(default=10, ge=5, le=20)


class SessionOut(BaseModel):
    session_id: int
    source: Literal["offline", "ai"]
    questions: list[QuestionOut]


class AnswerIn(BaseModel):
    question_id: int
    answer: str = Field(max_length=500)
    time_ms: int = Field(default=0, ge=0, le=3_600_000)


class AnswerOut(BaseModel):
    correct: bool
    grade: int
    correct_answer: str
    explanation: str
    requeued_question: QuestionOut | None = None


class ItemOut(BaseModel):
    id: int
    kind: str
    text: str
    pronunciation: str
    meaning: str
    source: str
    group: int | None
    difficulty: int


class FinishOut(BaseModel):
    score: int
    answered: int
    correct: int
    items_to_review: list[ItemOut]
    ended_at: datetime


class GroupProgress(BaseModel):
    group: int
    total: int
    learned: int


class ProgressOut(BaseModel):
    due_count: int
    groups: list[GroupProgress]
    words_unlocked: int
    words_total: int


class SettingsOut(BaseModel):
    """The API key is write-only: only its presence and source are reported."""

    has_key: bool
    key_from_env: bool
    model: str


class SettingsIn(BaseModel):
    api_key: str | None = Field(
        default=None, max_length=300
    )  # "" clears the stored key
    model: str | None = Field(default=None, min_length=1, max_length=100)


class LLMTestOut(BaseModel):
    ok: bool
    message: str


MAX_LYRICS_CHARS = 20_000


class SongIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(default="", max_length=200)
    # Longer than MAX_LYRICS_CHARS is rejected with 413 by the endpoint; this cap only
    # keeps absurd payloads out of memory.
    text: str = Field(min_length=1, max_length=200_000)


class SongOut(BaseModel):
    id: int
    title: str
    artist: str
    created_at: datetime
    characters: int
    items: int


class SongDetail(SongOut):
    text: str
