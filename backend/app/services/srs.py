from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import IntEnum

from app.models import ReviewState


class Grade(IntEnum):
    MISS = 1
    MATCH_WITH_MISTAKES = 2
    SUCCESS = 3
    SLOW_SUCCESS = 4
    FAST_SUCCESS = 5


@dataclass(frozen=True)
class SRSState:
    repetitions: int
    interval_days: int
    ease: float


@dataclass(frozen=True)
class Review:
    state: SRSState
    next_review: datetime
    grade: int


def apply_grade(state: SRSState, grade: int, now: datetime) -> Review:
    if not 0 <= grade <= 5:
        raise ValueError("grade must be between 0 and 5")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")

    penalty = 5 - grade
    ease = max(1.3, state.ease + 0.1 - penalty * (0.08 + penalty * 0.02))
    if grade < 3:
        repetitions, interval_days = 0, 1
    else:
        repetitions = state.repetitions + 1
        if repetitions == 1:
            interval_days = 1
        elif repetitions == 2:
            interval_days = 6
        else:
            interval_days = round(state.interval_days * state.ease)

    next_review = now.astimezone(UTC) + timedelta(days=interval_days)
    return Review(SRSState(repetitions, interval_days, ease), next_review, grade)


def apply_to_review_state(
    review_state: ReviewState, grade: int, now: datetime
) -> Review:
    review = apply_grade(
        SRSState(
            review_state.repetitions,
            review_state.interval_days,
            review_state.ease,
        ),
        grade,
        now,
    )
    review_state.repetitions = review.state.repetitions
    review_state.interval_days = review.state.interval_days
    review_state.ease = review.state.ease
    review_state.next_review = review.next_review
    review_state.last_grade = review.grade
    return review


def mapped_grade(*, correct: bool, time_ms: int) -> int:
    if not correct:
        return Grade.MISS
    if time_ms < 0:
        raise ValueError("time_ms cannot be negative")
    return Grade.FAST_SUCCESS if time_ms <= 5000 else Grade.SLOW_SUCCESS


def flashcard_grade(*, knew: bool) -> int:
    return Grade.SLOW_SUCCESS if knew else Grade.MISS


def pairs_grade(*, mistakes: int) -> int:
    if mistakes < 0:
        raise ValueError("mistakes cannot be negative")
    return Grade.SLOW_SUCCESS if mistakes == 0 else Grade.MATCH_WITH_MISTAKES


MAX_REQUEUES_PER_ITEM = 2


def can_requeue(requeue_count: int) -> bool:
    if requeue_count < 0:
        raise ValueError("requeue_count cannot be negative")
    return requeue_count < MAX_REQUEUES_PER_ITEM
