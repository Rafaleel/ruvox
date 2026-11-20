"""Coordinates the planner and generator agents for one session.

Decision (ADR 0005): the coordination is plain code, not an Agno `Team`. A Team adds a
coordinator model call per session, which costs time and money and makes the flow
non-deterministic, while the order here is fixed (plan, then generate) and every step
is validated with a fallback. The individual agents are still Agno agents.
"""

import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from sqlmodel import Session

from app.agents.generator import AgentQuestionGenerator
from app.agents.llm import StructuredLLM
from app.agents.planner import AgentContentPlanner
from app.services.questions import QuestionDraft, SeedQuestionGenerator
from app.services.selection import SeedContentPlanner

# One call times out at 20 s. If planning already used this much of the 25 s budget,
# the generator step is skipped and the seed questions are used.
GENERATOR_CUTOFF_SECONDS = 10.0


@dataclass(frozen=True)
class PreparedSession:
    drafts: list[QuestionDraft]
    source: Literal["ai", "offline"]


class SessionTeam:
    def __init__(
        self,
        db: Session,
        llm: StructuredLLM | None,
        clock: Callable[[], float] = time.monotonic,
        rng: random.Random | None = None,
    ) -> None:
        self.db = db
        self.llm = llm
        self.clock = clock
        self.rng = rng or random.Random()

    def prepare(
        self, user_id: int, size: int, mode: int | None, song_id: int | None = None
    ) -> PreparedSession:
        seed_planner = SeedContentPlanner(self.db, song_id=song_id)
        seed_generator = SeedQuestionGenerator(self.db, self.rng)
        if self.llm is None:
            plan = seed_planner.select(user_id, size)
            return PreparedSession(seed_generator.generate(plan, size, mode), "offline")

        started = self.clock()
        planner = AgentContentPlanner(self.db, self.llm, seed_planner)
        plan = planner.select(user_id, size)
        # An offline planner means the model failed or was unusable: do not spend a second
        # timeout on the generator. A slow planner also skips it (25 s budget).
        slow = self.clock() - started > GENERATOR_CUTOFF_SECONDS
        if planner.source == "offline" or slow:
            return PreparedSession(
                seed_generator.generate(plan, size, mode), planner.source
            )
        generator = AgentQuestionGenerator(self.llm, seed_generator)
        drafts = generator.generate(plan, size, mode)
        used_ai = "ai" in (planner.source, generator.source)
        return PreparedSession(drafts, "ai" if used_ai else "offline")
