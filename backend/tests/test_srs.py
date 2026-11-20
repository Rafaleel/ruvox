from datetime import UTC, datetime

import pytest

from app.models import ReviewState
from app.services.srs import (
    MAX_REQUEUES_PER_ITEM,
    SRSState,
    apply_grade,
    apply_to_review_state,
    can_requeue,
    flashcard_grade,
    mapped_grade,
    pairs_grade,
)


@pytest.mark.parametrize(
    ("grade", "ease"),
    [(5, 2.60), (4, 2.50), (3, 2.36), (2, 2.18), (1, 1.96), (0, 1.70)],
)
def test_updates_ease_for_every_grade(grade: int, ease: float) -> None:
    result = apply_grade(SRSState(0, 0, 2.5), grade, datetime(2026, 11, 20, tzinfo=UTC))
    assert result.state.ease == pytest.approx(ease)


def test_misses_reset_repetitions_and_interval_and_ease_keeps_falling() -> None:
    state = SRSState(4, 90, 2.5)
    ease_values = []
    for expected in (1.96, 1.42, 1.3):
        result = apply_grade(state, 1, datetime(2026, 11, 20, tzinfo=UTC))
        assert result.state == SRSState(0, 1, expected)
        assert result.next_review == datetime(2026, 11, 21, tzinfo=UTC)
        ease_values.append(result.state.ease)
        state = result.state
    assert ease_values == pytest.approx([1.96, 1.42, 1.3])


def test_success_intervals_and_previous_ease_multiplier() -> None:
    now = datetime(2026, 11, 20, tzinfo=UTC)
    first = apply_grade(SRSState(0, 0, 2.5), 5, now)
    second = apply_grade(first.state, 5, now)
    third = apply_grade(second.state, 5, now)
    assert [
        first.state.interval_days,
        second.state.interval_days,
        third.state.interval_days,
    ] == [1, 6, 16]
    assert [
        first.state.repetitions,
        second.state.repetitions,
        third.state.repetitions,
    ] == [1, 2, 3]


def test_grade_mapping() -> None:
    assert mapped_grade(correct=True, time_ms=5000) == 5
    assert mapped_grade(correct=True, time_ms=5001) == 4
    assert mapped_grade(correct=False, time_ms=0) == 1
    assert flashcard_grade(knew=True) == 4
    assert flashcard_grade(knew=False) == 1
    assert pairs_grade(mistakes=0) == 4
    assert pairs_grade(mistakes=1) == 2


def test_requeue_cap_is_two() -> None:
    assert MAX_REQUEUES_PER_ITEM == 2
    assert [can_requeue(count) for count in range(4)] == [True, True, False, False]


def test_rejects_invalid_grade_and_naive_time() -> None:
    now = datetime(2026, 11, 20, tzinfo=UTC)
    with pytest.raises(ValueError):
        apply_grade(SRSState(0, 0, 2.5), 6, now)
    with pytest.raises(ValueError):
        apply_grade(SRSState(0, 0, 2.5), 1, datetime(2026, 11, 20))


def test_apply_to_review_state_updates_the_row() -> None:
    now = datetime(2026, 11, 20, tzinfo=UTC)
    row = ReviewState(user_id=1, item_id=1)
    apply_to_review_state(row, 5, now)
    assert (row.repetitions, row.interval_days, row.last_grade) == (1, 1, 5)
    assert row.ease == pytest.approx(2.6)
    assert row.next_review == datetime(2026, 11, 21, tzinfo=UTC)
