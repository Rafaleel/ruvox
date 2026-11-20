import json
from typing import Literal

from pydantic import BaseModel, Field
from sqlmodel import Session

from app.agents.llm import LLMUnavailable, StructuredLLM
from app.models import ReviewState, UserProfile
from app.services.selection import ContentPlanner, PlannedItem


class PlanEntry(BaseModel):
    item_id: int
    mode: Literal[1, 2, 3]
    reason: str = Field(max_length=300)


class SessionPlan(BaseModel):
    entries: list[PlanEntry]
    difficulty: Literal["easy", "medium", "hard"]
    notes: str = Field(max_length=300)


class AgentContentPlanner:
    """Lets the model order and select among candidates the SRS planner provides (D12).

    It never creates items or schedules. Anything unusable falls back to `fallback`.
    """

    def __init__(
        self, db: Session, llm: StructuredLLM, fallback: ContentPlanner
    ) -> None:
        self.db = db
        self.llm = llm
        self.fallback = fallback
        self.source: Literal["ai", "offline"] = "offline"

    def select(self, user_id: int, size: int) -> list[PlannedItem]:
        candidates = {
            entry.item.id: entry
            for entry in self.fallback.select(user_id, size * 2)
            if entry.item.id is not None
        }
        payload = self._payload(user_id, size, candidates)
        for _ in range(2):  # one retry on an unusable plan; a failed call is final
            try:
                plan = self.llm.run("planner", "planner", payload, SessionPlan)
            except LLMUnavailable:
                break
            if chosen := self._validate(plan, candidates, size):
                self.source = "ai"
                return chosen
        self.source = "offline"
        return self.fallback.select(user_id, size)

    def _payload(
        self, user_id: int, size: int, candidates: dict[int | None, PlannedItem]
    ) -> str:
        profile = self.db.get(UserProfile, user_id) or UserProfile(user_id=user_id)
        rows = []
        for item_id, entry in candidates.items():
            state = self.db.get(ReviewState, (user_id, item_id))
            rows.append(
                {
                    "item_id": item_id,
                    "kind": entry.item.kind,
                    "text": entry.item.text,
                    "group": entry.item.group,
                    "is_new": entry.is_new,
                    "repetitions": state.repetitions if state else 0,
                    "last_grade": state.last_grade if state else None,
                }
            )
        return json.dumps(
            {
                "size": size,
                "profile": {
                    "level": profile.level,
                    "weak_points": profile.weak_points,
                    "preferences": profile.preferences,
                },
                "candidates": rows,
            },
            ensure_ascii=False,
        )

    @staticmethod
    def _validate(
        plan: SessionPlan, candidates: dict[int | None, PlannedItem], size: int
    ) -> list[PlannedItem] | None:
        ids = [entry.item_id for entry in plan.entries]
        if not 1 <= len(ids) <= size or len(set(ids)) != len(ids):
            return None
        if any(item_id not in candidates for item_id in ids):
            return None
        return [
            PlannedItem(
                candidates[entry.item_id].item,
                candidates[entry.item_id].is_new,
                entry.mode,
            )
            for entry in plan.entries
        ]
