import random

import pytest
from sqlmodel import Session, select

from app.agents.generator import (
    AgentQuestionGenerator,
    GeneratedQuestion,
    GeneratedQuestions,
)
from app.agents.llm import LLMUnavailable
from app.models import Item
from app.services.questions import QuestionDraft, SeedQuestionGenerator
from app.services.selection import PlannedItem
from tests.fakes import FakeLLM

Setup = tuple[list[PlannedItem], list[QuestionDraft]]


def plan_of(db: Session, *texts: str) -> list[PlannedItem]:
    return [
        PlannedItem(db.exec(select(Item).where(Item.text == t)).one(), True)
        for t in texts
    ]


def seed_gen(db: Session) -> SeedQuestionGenerator:
    return SeedQuestionGenerator(db, random.Random(3))


def written(slots: list[QuestionDraft]) -> GeneratedQuestions:
    """What a well-behaved model returns: same slots, new phrasing and explanation."""
    return GeneratedQuestions(
        questions=[
            GeneratedQuestion(
                **{
                    **s.model_dump(exclude={"input_kind"}),
                    "prompt": f"Vamos lá! {s.prompt}",
                    "explanation": "Dica: lembre do som.",
                }
            )
            for s in slots
        ]
    )


@pytest.fixture
def setup(db: Session) -> Setup:
    plan = plan_of(db, "Ч", "А", "банан")
    return plan, seed_gen(db).generate(plan, 5)


def test_valid_output_is_used(db: Session, setup: Setup) -> None:
    plan, slots = setup
    generator = AgentQuestionGenerator(FakeLLM(written(slots)), seed_gen(db))
    drafts = generator.generate(plan, 5)
    assert generator.source == "ai"
    assert [d.answer for d in drafts] == [s.answer for s in slots]
    assert all(d.prompt.startswith("Vamos lá!") for d in drafts)


def tamper(result: GeneratedQuestions, how: str) -> GeneratedQuestions:
    q = result.questions
    if how == "count":
        return GeneratedQuestions(questions=q[:-1])
    first = q[0].model_copy()
    if how == "answer":
        first.answer = "wrong"
        first.options = [first.answer, *first.options[1:]]
    elif how == "not_in_options":
        first.options = [o for o in first.options if o != first.answer] + ["x"]
    elif how == "leak":
        first.prompt = f"{first.prompt} {first.answer}"
    elif how == "duplicate_prompt":
        q[1] = q[1].model_copy(update={"prompt": first.prompt})
    elif how == "duplicate_option":
        first.options = [first.options[0]] * 4
    elif how == "no_cyrillic":
        first.prompt = "Qual a resposta?"
    elif how == "empty_explanation":
        first.explanation = " "
    return GeneratedQuestions(questions=[first, *q[1:]])


@pytest.mark.parametrize(
    "how",
    [
        "count",
        "answer",
        "not_in_options",
        "leak",
        "duplicate_prompt",
        "duplicate_option",
        "no_cyrillic",
        "empty_explanation",
    ],
)
def test_invalid_output_falls_back_to_seed_questions(
    db: Session, setup: Setup, how: str
) -> None:
    plan, slots = setup
    bad = tamper(written(slots), how)
    llm = FakeLLM(bad, bad)
    generator = AgentQuestionGenerator(llm, seed_gen(db))
    drafts = generator.generate(plan, 5)
    assert len(llm.calls) == 2 and generator.source == "offline"
    assert [d.prompt for d in drafts] == [s.prompt for s in slots]


def test_retry_recovers(db: Session, setup: Setup) -> None:
    plan, slots = setup
    generator = AgentQuestionGenerator(
        FakeLLM(tamper(written(slots), "count"), written(slots)), seed_gen(db)
    )
    generator.generate(plan, 5)
    assert generator.source == "ai"


def test_sound_to_letter_options_must_be_cyrillic_letters(db: Session) -> None:
    plan = plan_of(db, "Ч", "А")
    slots = [s for s in seed_gen(db).generate(plan, 6) if s.type == "sound_to_letter"]
    assert slots
    result = written(slots)
    result.questions[0].options = [result.questions[0].answer, "a", "b", "c"]
    generator = AgentQuestionGenerator(FakeLLM(result, result), seed_gen(db))
    generator.generate(plan, 6, mode=2)
    assert generator.source == "offline"


def test_call_failure_uses_seed_without_retry(db: Session, setup: Setup) -> None:
    plan, slots = setup
    llm = FakeLLM(LLMUnavailable("down"))
    generator = AgentQuestionGenerator(llm, seed_gen(db))
    assert len(generator.generate(plan, 5)) == len(slots)
    assert len(llm.calls) == 1 and generator.source == "offline"


def test_empty_plan_makes_no_call(db: Session) -> None:
    llm = FakeLLM()
    assert AgentQuestionGenerator(llm, seed_gen(db)).generate([], 5) == []
    assert llm.calls == []
