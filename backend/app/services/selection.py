from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from sqlmodel import Session, col, select

from app.models import Item, ReviewState, now_utc

NEW_PER_SESSION = 5
UNLOCK_RATIO = 0.8


@dataclass(frozen=True)
class PlannedItem:
    item: Item
    is_new: bool
    mode: int | None = None  # optional hint from an agent; the generator may honor it


class ContentPlanner(Protocol):
    """Chooses what a session practices. Phase 2 swaps in an agent behind this seam."""

    def select(self, user_id: int, size: int) -> list[PlannedItem]: ...


def as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; everything stored is UTC.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def state_of(states: dict[int, ReviewState], item: Item) -> ReviewState | None:
    return states.get(item.id) if item.id is not None else None


class SeedContentPlanner:
    # shortcut: loads every seed item and review state per call (about a hundred rows);
    # move to SQL queries if the seed grows into the thousands.
    def __init__(
        self, session: Session, clock: Callable[[], datetime] = now_utc
    ) -> None:
        self.session = session
        self.clock = clock

    def select(self, user_id: int, size: int) -> list[PlannedItem]:
        items = self.session.exec(
            select(Item)
            .where(Item.user_id == user_id, Item.source == "seed")
            .order_by(col(Item.id))
        ).all()
        states = {
            state.item_id: state
            for state in self.session.exec(
                select(ReviewState).where(ReviewState.user_id == user_id)
            )
        }
        now = self.clock()

        due = sorted(
            (
                (as_utc(state.next_review), item)
                for item in items
                if (state := state_of(states, item))
                and as_utc(state.next_review) <= now
            ),
            key=lambda pair: pair[0],
        )
        picked = [PlannedItem(item, False) for _, item in due[:size]]

        unlocked = unlocked_items(items, states)
        fresh = [
            item
            for item in items
            if state_of(states, item) is None and item in unlocked
        ]
        quota = min(NEW_PER_SESSION, size - len(picked))
        picked += [PlannedItem(item, True) for item in fresh[:quota]]

        if len(picked) < size:  # nothing left to learn or review: extra practice
            chosen = {entry.item.id for entry in picked}
            later = sorted(
                (
                    (as_utc(state.next_review), item)
                    for item in items
                    if (state := state_of(states, item)) and item.id not in chosen
                ),
                key=lambda pair: pair[0],
            )
            picked += [PlannedItem(item, False) for _, item in later][
                : size - len(picked)
            ]
        return picked


def unlocked_items(items: Sequence[Item], states: dict[int, ReviewState]) -> list[Item]:
    """Letters of open groups plus words whose letters have all been seen."""
    letters = [item for item in items if item.kind == "letter"]

    def reps(item: Item) -> int:
        state = state_of(states, item)
        return state.repetitions if state else 0

    open_groups = {1}
    group = 1
    while True:
        members = [letter for letter in letters if letter.group == group]
        if not members or (
            sum(reps(letter) >= 2 for letter in members) / len(members) < UNLOCK_RATIO
        ):
            break
        group += 1
        open_groups.add(group)
    known = {letter.text for letter in letters if reps(letter) >= 1}
    return [
        item
        for item in items
        if (item.kind == "letter" and item.group in open_groups)
        or (
            item.kind == "word"
            and all(char in known for char in item.text.upper() if char.isalpha())
        )
    ]
