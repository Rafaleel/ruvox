import random
from collections.abc import Sequence
from typing import Literal, Protocol

from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.models import Item
from app.services.selection import PlannedItem

OPTION_COUNT = 4

QuestionType = Literal[
    "letter_to_sound", "sound_to_letter", "word_to_meaning", "typing"
]
TYPE_BY_MODE: dict[int, QuestionType] = {
    1: "letter_to_sound",
    2: "sound_to_letter",
    3: "word_to_meaning",
    4: "typing",
}


class QuestionDraft(BaseModel):
    """A question with its answer; the API turns it into a client-safe QuestionOut."""

    type: QuestionType
    prompt: str
    options: list[str]
    answer: str
    explanation: str
    item_ids: list[int]
    input_kind: Literal["choice", "text"] = "choice"


class QuestionGenerator(Protocol):
    """Phase 2 adds an agent-backed generator behind this seam."""

    def generate(
        self, plan: Sequence[PlannedItem], size: int, mode: int | None = None
    ) -> list[QuestionDraft]: ...


class SeedQuestionGenerator:
    """Builds modes 1 to 3 from seed content; needs no LLM."""

    def __init__(self, session: Session, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()
        self.pool = session.exec(
            select(Item).where(Item.source == "seed").order_by(col(Item.id))
        ).all()

    def generate(
        self, plan: Sequence[PlannedItem], size: int, mode: int | None = None
    ) -> list[QuestionDraft]:
        modes_for = {"letter": (1, 2), "word": (3,)}
        questions: list[QuestionDraft] = []
        seen: set[str] = set()
        for round_ in range(2):  # a second round adds the other letter mode
            for index, entry in enumerate(plan):
                available = modes_for.get(entry.item.kind, ())
                if mode == 4 and available:  # typing is never part of a mixed session
                    available = (4,)
                elif mode is not None:
                    available = tuple(m for m in available if m == mode)
                if not available or len(questions) >= size:
                    continue
                hinted = entry.mode in available and round_ == 0
                chosen = (
                    entry.mode
                    if hinted and entry.mode
                    else available[(index + round_) % len(available)]
                )
                draft = self._build(entry.item, chosen)
                if draft.prompt not in seen:
                    seen.add(draft.prompt)
                    questions.append(draft)
        return questions

    def _build(self, item: Item, mode: int) -> QuestionDraft:
        assert item.id is not None
        if mode == 4:
            return self._typing(item)
        if mode == 1:
            prompt = f"Como se lê «{item.text}»?"
            answer, field = item.pronunciation, "pronunciation"
            explanation = f"{item.text} lê-se {item.pronunciation}."
        elif mode == 2:
            prompt = f"Qual letra faz «{item.pronunciation}»?"
            answer, field = item.text, "text"
            explanation = f"{item.text} lê-se {item.pronunciation}."
        else:
            prompt = f"O que significa «{item.text}»?"
            answer, field = item.meaning, "meaning"
            explanation = (
                f"{item.text} ({item.pronunciation}) significa «{item.meaning}»."
            )
        options = [answer, *self._distractors(item, field, answer)]
        self.rng.shuffle(options)
        return QuestionDraft(
            type=TYPE_BY_MODE[mode],
            prompt=prompt,
            options=options,
            answer=answer,
            explanation=explanation,
            item_ids=[item.id],
        )

    def _typing(self, item: Item) -> QuestionDraft:
        assert item.id is not None
        if item.kind == "letter":
            prompt = f"Digite em russo a letra que faz «{item.pronunciation}»."
            explanation = f"{item.text} lê-se {item.pronunciation}."
        else:
            prompt = (
                f"Como se escreve «{item.meaning}» em russo? ({item.pronunciation})"
            )
            explanation = (
                f"{item.meaning} em russo é {item.text} ({item.pronunciation})."
            )
        return QuestionDraft(
            type="typing",
            prompt=prompt,
            options=[],
            answer=item.text,
            explanation=explanation,
            item_ids=[item.id],
            input_kind="text",
        )

    def _distractors(self, item: Item, field: str, answer: str) -> list[str]:
        others = [
            other
            for other in self.pool
            if other.kind == item.kind and other.id != item.id
        ]
        # same group first so letter distractors look alike
        self.rng.shuffle(others)
        others.sort(key=lambda other: other.group != item.group)
        chosen: list[str] = []
        for other in others:
            value = getattr(other, field)
            if value != answer and value not in chosen:
                chosen.append(value)
            if len(chosen) == OPTION_COUNT - 1:
                break
        return chosen
