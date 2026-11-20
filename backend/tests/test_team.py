from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.agents.generator import GeneratedQuestion, GeneratedQuestions
from app.agents.llm import LLMUnavailable
from app.agents.planner import PlanEntry, SessionPlan
from app.agents.team import GENERATOR_CUTOFF_SECONDS, SessionTeam
from app.api.sessions import llm_dependency
from app.models import UserProfile
from tests.fakes import FakeLLM


def group_one(client: TestClient) -> list[dict[str, Any]]:
    letters: list[dict[str, Any]] = client.get(
        "/api/items", params={"kind": "letter"}
    ).json()
    return [item for item in letters if item["group"] == 1]


def ai_outputs(items: list[dict[str, Any]]) -> tuple[SessionPlan, GeneratedQuestions]:
    modes = [1, 2, 1, 2, 1]
    plan = SessionPlan(
        entries=[
            PlanEntry(item_id=item["id"], mode=mode, reason="novo")  # type: ignore[arg-type]
            for item, mode in zip(items, modes, strict=True)
        ],
        difficulty="easy",
        notes="ok",
    )
    questions = []
    for item, mode in zip(items, modes, strict=True):
        answer = item["pronunciation"] if mode == 1 else item["text"]
        others = ["q", "w", "e"] if mode == 1 else ["Б", "Г", "Д"]
        questions.append(
            GeneratedQuestion(
                type="letter_to_sound" if mode == 1 else "sound_to_letter",
                prompt=f"Vamos lá! Letra «{item['text']}»"
                if mode == 1
                else f"Vamos lá! Qual letra faz o som {item['pronunciation']}?",
                options=[answer, *others],
                answer=answer,
                explanation="Dica: repita em voz alta.",
                item_ids=[item["id"]],
            )
        )
    return plan, GeneratedQuestions(questions=questions)


def create(client: TestClient, llm: FakeLLM | None) -> dict[str, Any]:
    client.app.dependency_overrides[llm_dependency] = lambda: llm  # type: ignore[attr-defined]
    response = client.post("/api/sessions", json={"size": 5})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_ai_path_plans_then_generates(client: TestClient) -> None:
    plan, questions = ai_outputs(group_one(client))
    llm = FakeLLM(plan, questions)
    body = create(client, llm)
    assert body["source"] == "ai"
    assert [call[0] for call in llm.calls] == ["planner", "generator"]
    assert all(q["prompt"].startswith("Vamos lá!") for q in body["questions"])


def test_offline_path_makes_no_model_call(client: TestClient) -> None:
    body = create(client, None)
    assert body["source"] == "offline" and len(body["questions"]) == 5


def test_generator_failure_keeps_the_ai_plan(client: TestClient) -> None:
    plan, _ = ai_outputs(group_one(client))
    body = create(client, FakeLLM(plan, LLMUnavailable("down")))
    assert body["source"] == "ai"
    assert not any(q["prompt"].startswith("Vamos lá!") for q in body["questions"])


def test_total_failure_is_still_a_playable_session(client: TestClient) -> None:
    body = create(client, FakeLLM(LLMUnavailable("down")))
    assert body["source"] == "offline" and len(body["questions"]) == 5


def test_slow_planning_skips_the_generator(db: Session) -> None:
    items = db_group_one(db)
    plan = SessionPlan(
        entries=[PlanEntry(item_id=i, mode=1, reason="novo") for i in items],
        difficulty="easy",
        notes="ok",
    )
    ticks = iter([0.0, GENERATOR_CUTOFF_SECONDS + 1])
    llm = FakeLLM(plan)  # a second call would raise IndexError
    prepared = SessionTeam(db, llm, clock=lambda: next(ticks)).prepare(1, 5, None)
    assert prepared.source == "ai" and len(llm.calls) == 1 and prepared.drafts


def db_group_one(db: Session) -> list[int]:
    from sqlmodel import select

    from app.models import Item

    rows = db.exec(select(Item).where(Item.kind == "letter", Item.group == 1)).all()
    return [r.id for r in rows if r.id is not None]


def test_finishing_a_session_updates_the_profile(client: TestClient) -> None:
    body = create(client, None)
    first = body["questions"][0]
    client.post(
        f"/api/sessions/{body['session_id']}/answers",
        json={"question_id": first["id"], "answer": "nope", "time_ms": 10},
    )
    client.post(f"/api/sessions/{body['session_id']}/finish")
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        profile = db.get(UserProfile, 1)
        assert profile is not None
        assert profile.level == "beginner" and profile.weak_points == first["item_ids"]
