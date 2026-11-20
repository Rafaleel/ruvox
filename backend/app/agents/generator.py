import json
import re
from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.llm import LLMUnavailable, StructuredLLM
from app.services.questions import (
    OPTION_COUNT,
    QuestionDraft,
    QuestionGenerator,
    QuestionType,
)
from app.services.selection import PlannedItem

CYRILLIC = re.compile(r"[Ѐ-ӿ]")


class GeneratedQuestion(BaseModel):
    type: QuestionType
    prompt: str = Field(max_length=300)
    options: list[str]
    answer: str
    explanation: str = Field(max_length=500)
    item_ids: list[int]


class GeneratedQuestions(BaseModel):
    questions: list[GeneratedQuestion]


def _leaks_answer(question: GeneratedQuestion, prompt: str) -> bool:
    # Pronunciations like "a" or "o" are ordinary Portuguese words, so only the other
    # two types can be checked: a meaning as a whole word, or the Cyrillic answer letter.
    if question.type == "word_to_meaning":
        return (
            re.search(rf"\b{re.escape(question.answer)}\b", prompt, re.IGNORECASE)
            is not None
        )
    if question.type == "sound_to_letter":
        return question.answer in prompt
    return False


class AgentQuestionGenerator:
    """Writes the questions for slots the seed generator defines.

    The slots fix type, answer and items from the database, so the model cannot make
    up an answer; it supplies phrasing, distractors and explanations. Anything that
    fails validation is retried once, then the seed questions are used (D11).
    """

    def __init__(self, llm: StructuredLLM, fallback: QuestionGenerator) -> None:
        self.llm = llm
        self.fallback = fallback
        self.source: Literal["ai", "offline"] = "offline"

    def generate(
        self, plan: Sequence[PlannedItem], size: int, mode: int | None = None
    ) -> list[QuestionDraft]:
        slots = self.fallback.generate(plan, size, mode)
        self.source = "offline"
        if not slots or mode == 4:  # typing questions need no generation
            return slots
        items = {p.item.id: p.item for p in plan}
        payload = json.dumps(
            {
                "slots": [
                    {
                        "type": slot.type,
                        "answer": slot.answer,
                        "item_ids": slot.item_ids,
                        "item": {
                            "text": items[slot.item_ids[0]].text,
                            "pronunciation": items[slot.item_ids[0]].pronunciation,
                            "meaning": items[slot.item_ids[0]].meaning,
                        },
                    }
                    for slot in slots
                ]
            },
            ensure_ascii=False,
        )
        for _ in range(2):
            try:
                result = self.llm.run(
                    "generator", "generator", payload, GeneratedQuestions
                )
            except LLMUnavailable:
                break
            if drafts := self._validate(result, slots):
                self.source = "ai"
                return drafts
        return slots

    @staticmethod
    def _validate(
        result: GeneratedQuestions, slots: Sequence[QuestionDraft]
    ) -> list[QuestionDraft] | None:
        if len(result.questions) != len(slots):
            return None
        prompts: set[str] = set()
        drafts: list[QuestionDraft] = []
        for generated, slot in zip(result.questions, slots, strict=True):
            if (generated.type, generated.answer, generated.item_ids) != (
                slot.type,
                slot.answer,
                slot.item_ids,
            ):
                return None
            options = generated.options
            if (
                len(options) != OPTION_COUNT
                or len(set(options)) != OPTION_COUNT
                or options.count(generated.answer) != 1
            ):
                return None
            prompt = generated.prompt.strip()
            if not prompt or prompt in prompts or _leaks_answer(generated, prompt):
                return None
            if not generated.explanation.strip():
                return None
            if generated.type == "sound_to_letter":
                if not all(CYRILLIC.fullmatch(option) for option in options):
                    return None
            elif not CYRILLIC.search(prompt):
                return None
            prompts.add(prompt)
            drafts.append(
                QuestionDraft(
                    type=generated.type,
                    prompt=prompt,
                    options=options,
                    answer=generated.answer,
                    explanation=generated.explanation.strip(),
                    item_ids=generated.item_ids,
                )
            )
        return drafts
