from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.questions import QuestionType


class Pair(BaseModel):
    item_id: int
    left: str
    right: str


class QuestionOut(BaseModel):
    """What the client sees: never the answer or the explanation."""

    id: int
    type: QuestionType
    prompt: str
    input_kind: Literal["choice", "text", "flip", "pairs"]
    options: list[str]
    item_ids: list[int]
    reveal: str | None = None  # flashcards: shown when the card is flipped
    pairs: list[Pair] | None = None  # pairs rounds: sides to match


class SessionCreate(BaseModel):
    mode: Literal["mixed", 1, 2, 3, 4, 5, 6, 7, 8] = "mixed"
    song_id: int | None = None  # practice only the vocabulary of this song
    size: int = Field(default=10, ge=5, le=20)


class LessonOut(BaseModel):
    """Intro card for an item the learner has never practiced."""

    item_id: int
    kind: str
    text: str
    pronunciation: str
    meaning: str
    note: str


class SessionOut(BaseModel):
    session_id: int
    source: Literal["offline", "ai"]
    questions: list[QuestionOut]
    lessons: list[LessonOut] = []


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


class LetterStatus(BaseModel):
    id: int
    text: str
    pronunciation: str
    group: int
    status: Literal["new", "learning", "familiar", "mastered"]


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


class ConfirmEntry(BaseModel):
    text: str = Field(max_length=100)
    pronunciation_pt: str = Field(max_length=100)
    meaning_pt: str = Field(max_length=200)
    kind: Literal["word", "expression"] = "word"
    excerpt: str = Field(default="", max_length=300)


class ConfirmIn(BaseModel):
    entries: list[ConfirmEntry] = Field(max_length=40)


class ConfirmOut(BaseModel):
    created: int
    skipped: int  # already studied (same text)
    rejected: int  # not valid Cyrillic or missing pronunciation/meaning


class MasteryOut(BaseModel):
    new: int
    learning: int
    familiar: int
    mastered: int


class DayStats(BaseModel):
    date: str
    answered: int
    correct: int
    sessions: int


class StatsOut(BaseModel):
    mastery: MasteryOut
    days: list[DayStats]
    streak: int
    best_streak: int
    today_done: bool


class ProviderOut(BaseModel):
    id: str
    label: str  # who the key belongs to, e.g. "OpenAI"
    maker: str  # the assistant's brand, e.g. "ChatGPT"
    has_key: bool
    key_from_env: bool
    model: str
    key_url: str
    key_example: str


class ProviderIn(BaseModel):
    api_key: str | None = Field(default=None, max_length=400)  # "" removes the key
    model: str | None = Field(default=None, max_length=200)


class SettingsOut(BaseModel):
    """Keys are write-only: only their presence is reported."""

    active_provider: str
    providers: list[ProviderOut]
    llm_ready: bool  # the active provider has a key and a model


class SettingsIn(BaseModel):
    active_provider: str | None = None
    providers: dict[str, ProviderIn] = {}


class ModelOption(BaseModel):
    id: str
    label: str


class ModelsIn(BaseModel):
    api_key: str | None = Field(
        default=None, max_length=400
    )  # try a key before saving it


class ModelsOut(BaseModel):
    models: list[ModelOption]
    source: Literal["live", "builtin"]


class LLMTestIn(BaseModel):
    provider: str | None = None
