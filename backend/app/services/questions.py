import random
import re
from collections.abc import Sequence
from typing import Literal, Protocol

from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.models import Item
from app.services.selection import PlannedItem

OPTION_COUNT = 4
PAIRS_PER_ROUND = 6
MIN_PAIRS = 3

QuestionType = Literal[
    "letter_to_sound",
    "sound_to_letter",
    "word_to_meaning",
    "typing",
    "flashcard",
    "pairs",
    "cloze",
]
TYPE_BY_MODE: dict[int, QuestionType] = {
    1: "letter_to_sound",
    2: "sound_to_letter",
    3: "word_to_meaning",
    4: "typing",
    5: "flashcard",
    6: "pairs",
    7: "cloze",
}


LETTER_TIPS = {
    1: "Esta letra é igual ao português, é só lembrar o som.",
    2: "Cuidado: ela parece uma letra latina, mas o som é outro.",
    3: "Letra nova: grave a forma junto com o som.",
}


class QuestionDraft(BaseModel):
    """A question with its answer; the API turns it into a client-safe QuestionOut."""

    type: QuestionType
    prompt: str
    options: list[str]
    answer: str
    explanation: str
    item_ids: list[int]
    input_kind: Literal["choice", "text", "flip", "pairs"] = "choice"


class QuestionGenerator(Protocol):
    """Phase 2 adds an agent-backed generator behind this seam."""

    def generate(
        self, plan: Sequence[PlannedItem], size: int, mode: int | None = None
    ) -> list[QuestionDraft]: ...


class SeedQuestionGenerator:
    """Builds modes 1 to 3 from seed content; needs no LLM."""

    def __init__(self, session: Session, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()
        self.pool = session.exec(select(Item).order_by(col(Item.id))).all()

    def generate(
        self, plan: Sequence[PlannedItem], size: int, mode: int | None = None
    ) -> list[QuestionDraft]:
        if mode == 5:
            return [self._flashcard(entry.item) for entry in plan[:size]]
        if mode == 6:
            return self._pairs(plan)
        if mode == 7:
            return self._cloze(plan, size)
        if mode == 8:  # alphabet game: letter-to-sound and sound-to-letter only
            plan = [entry for entry in plan if entry.item.kind == "letter"]
            mode = None
        modes_for = {"letter": (1, 2), "word": (3,), "expression": (3,)}
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
            explanation = self._letter_note(item)
        elif mode == 2:
            prompt = f"Qual letra faz «{item.pronunciation}»?"
            answer, field = item.text, "text"
            explanation = self._letter_note(item)
        else:
            # The reading is part of the prompt: a beginner can sound the word out
            # even when it looks nothing like the Portuguese one.
            prompt = f"O que significa «{item.text}» ({item.pronunciation})?"
            answer, field = item.meaning, "meaning"
            explanation = (
                f"{item.text} ({item.pronunciation}) significa «{item.meaning}». "
                f"{self._spelling(item)}"
            ).strip()
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

    def _letter_note(self, item: Item) -> str:
        note = f"{item.text} lê-se {item.pronunciation}."
        tip = LETTER_TIPS.get(item.group or 0)
        return f"{note} {tip}" if item.kind == "letter" and tip else note

    def _spelling(self, item: Item) -> str:
        """Letter-by-letter reading of a word, so the sound can be traced back."""
        sounds = {
            i.text.lower(): i.pronunciation for i in self.pool if i.kind == "letter"
        }
        parts = [f"{c} = {sounds[c]}" for c in item.text.lower() if c in sounds]
        return f"Letra por letra: {'; '.join(parts)}." if parts else ""

    def _flashcard(self, item: Item) -> QuestionDraft:
        assert item.id is not None
        # Self-graded: the "answer" is shown on flip, so it travels as the explanation.
        reveal = (
            item.pronunciation
            if item.kind == "letter"
            else f"{item.pronunciation} — {item.meaning}"
        )
        return QuestionDraft(
            type="flashcard",
            prompt=item.text,
            options=[],
            answer="knew",
            explanation=reveal,
            item_ids=[item.id],
            input_kind="flip",
        )

    def _pairs(self, plan: Sequence[PlannedItem]) -> list[QuestionDraft]:
        ids = [entry.item.id for entry in plan if entry.item.id is not None]
        rounds = [
            ids[i : i + PAIRS_PER_ROUND] for i in range(0, len(ids), PAIRS_PER_ROUND)
        ]
        return [
            QuestionDraft(
                type="pairs",
                prompt="Una cada palavra ao seu significado antes que o tempo acabe.",
                options=[],
                answer="",
                explanation="Rodada de pares concluída.",
                item_ids=chunk,
                input_kind="pairs",
            )
            for chunk in rounds
            if len(chunk) >= MIN_PAIRS
        ]

    def _cloze(self, plan: Sequence[PlannedItem], size: int) -> list[QuestionDraft]:
        drafts: list[QuestionDraft] = []
        for entry in plan:
            item = entry.item
            if item.id is None or not item.excerpt or item.kind == "letter":
                continue
            blanked = re.sub(
                re.escape(item.text), "____", item.excerpt, count=1, flags=re.IGNORECASE
            )
            if blanked == item.excerpt:
                continue
            others = [
                o.text for o in self.pool if o.kind == item.kind and o.id != item.id
            ]
            self.rng.shuffle(others)
            options = [item.text]
            for text in others:
                if text.casefold() not in {o.casefold() for o in options}:
                    options.append(text)
                if len(options) == OPTION_COUNT:
                    break
            if len(options) < OPTION_COUNT:
                continue
            self.rng.shuffle(options)
            drafts.append(
                QuestionDraft(
                    type="cloze",
                    prompt=f"Complete o trecho: «{blanked}» (significado: {item.meaning})",
                    options=options,
                    answer=item.text,
                    explanation=f"«{item.excerpt}»: {item.text} significa «{item.meaning}».",
                    item_ids=[item.id],
                )
            )
            if len(drafts) >= size:
                break
        return drafts

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
