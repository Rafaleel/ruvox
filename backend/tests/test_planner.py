from datetime import UTC, datetime

import pytest
from sqlmodel import Session

from app.agents.llm import LLMUnavailable
from app.agents.planner import AgentContentPlanner, PlanEntry, SessionPlan
from app.services.selection import SeedContentPlanner
from tests.fakes import FakeLLM

NOW = datetime(2026, 11, 20, tzinfo=UTC)


def plan(*ids: int) -> SessionPlan:
    return SessionPlan(
        entries=[PlanEntry(item_id=i, mode=1, reason="revisão") for i in ids],
        difficulty="easy",
        notes="ok",
    )


def make(db: Session, llm: FakeLLM) -> AgentContentPlanner:
    return AgentContentPlanner(db, llm, SeedContentPlanner(db, clock=lambda: NOW))


def candidate_ids(db: Session) -> list[int]:
    return [
        e.item.id
        for e in SeedContentPlanner(db, clock=lambda: NOW).select(1, 10)
        if e.item.id
    ]


def test_valid_plan_is_used_in_the_models_order(db: Session) -> None:
    ids = candidate_ids(db)
    planner = make(db, FakeLLM(plan(ids[2], ids[0])))
    picked = planner.select(1, 5)
    assert [p.item.id for p in picked] == [ids[2], ids[0]]
    assert all(p.mode == 1 for p in picked)
    assert planner.source == "ai"


def test_unknown_id_is_retried_once_then_falls_back(db: Session) -> None:
    llm = FakeLLM(plan(99999), plan(98765))
    planner = make(db, llm)
    picked = planner.select(1, 5)
    assert len(llm.calls) == 2 and planner.source == "offline"
    assert [p.item.id for p in picked] == candidate_ids(db)[:5]


def test_second_attempt_can_recover(db: Session) -> None:
    ids = candidate_ids(db)
    planner = make(db, FakeLLM(plan(99999), plan(ids[0])))
    assert [p.item.id for p in planner.select(1, 5)] == [ids[0]]
    assert planner.source == "ai"


@pytest.mark.parametrize("bad", ["empty", "too_long", "duplicate"])
def test_invalid_shapes_fall_back(db: Session, bad: str) -> None:
    ids = candidate_ids(db)
    shapes = {
        "empty": plan(),
        "too_long": plan(*ids[:5]),
        "duplicate": plan(ids[0], ids[0]),
    }
    llm = FakeLLM(shapes[bad], shapes[bad])
    planner = make(db, llm)
    assert planner.select(1, 2 if bad == "too_long" else 5)
    assert planner.source == "offline"


def test_call_failure_falls_back_without_retry(db: Session) -> None:
    llm = FakeLLM(LLMUnavailable("timeout"))
    planner = make(db, llm)
    assert planner.select(1, 5)
    assert len(llm.calls) == 1 and planner.source == "offline"


def test_payload_only_offers_candidates(db: Session) -> None:
    llm = FakeLLM(plan(candidate_ids(db)[0]))
    make(db, llm).select(1, 5)
    import json

    sent = json.loads(llm.calls[0][2])
    assert sent["size"] == 5 and sent["profile"]["level"] == "beginner"
    assert {c["item_id"] for c in sent["candidates"]} == set(candidate_ids(db))
