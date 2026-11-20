from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.models import Item, ReviewState
from app.services.selection import NEW_PER_SESSION, SeedContentPlanner

NOW = datetime(2026, 11, 20, 12, tzinfo=UTC)


def planner(db: Session) -> SeedContentPlanner:
    return SeedContentPlanner(db, clock=lambda: NOW)


def letters(db: Session, group: int) -> list[Item]:
    return list(db.exec(select(Item).where(Item.kind == "letter", Item.group == group)))


def learn(db: Session, items: list[Item], reps: int = 2, due_in_days: int = 3) -> None:
    for item in items:
        assert item.id is not None
        db.add(
            ReviewState(
                item_id=item.id,
                repetitions=reps,
                next_review=NOW + timedelta(days=due_in_days),
            )
        )
    db.commit()


def test_new_learner_gets_only_group_one_letters_capped(db: Session) -> None:
    picked = planner(db).select(1, 10)
    assert len(picked) == NEW_PER_SESSION == 5
    assert all(
        p.is_new and p.item.kind == "letter" and p.item.group == 1 for p in picked
    )


def test_due_items_come_first_most_overdue_first(db: Session) -> None:
    first, second, *_ = letters(db, 1)
    assert first.id and second.id
    db.add(ReviewState(item_id=first.id, next_review=NOW - timedelta(days=1)))
    db.add(ReviewState(item_id=second.id, next_review=NOW - timedelta(days=3)))
    db.commit()
    picked = planner(db).select(1, 10)
    assert [p.item.id for p in picked[:2]] == [second.id, first.id]
    assert not picked[0].is_new and picked[2].is_new


def test_full_session_of_due_items_adds_no_new_ones(db: Session) -> None:
    group2 = letters(db, 2) + letters(db, 3)
    for item in group2[:12]:
        assert item.id
        db.add(ReviewState(item_id=item.id, next_review=NOW - timedelta(days=1)))
    db.commit()
    picked = planner(db).select(1, 10)
    assert len(picked) == 10 and not any(p.is_new for p in picked)


def test_group_two_unlocks_at_eighty_percent(db: Session) -> None:
    group1 = letters(db, 1)
    learn(db, group1[:3])
    assert not any(p.item.group == 2 for p in planner(db).select(1, 20))
    learn(db, group1[3:4])
    picked = planner(db).select(1, 20)
    assert any(p.item.group == 2 for p in picked if p.is_new)
    assert not any(p.item.group == 3 for p in picked)


def test_word_needs_all_its_letters_seen(db: Session) -> None:
    da = db.exec(select(Item).where(Item.text == "да")).one()
    d = db.exec(select(Item).where(Item.text == "Д")).one()
    a = db.exec(select(Item).where(Item.text == "А")).one()
    learn(db, [a], reps=1)
    assert da.id not in {p.item.id for p in planner(db).select(1, 50)}
    learn(db, [d], reps=1)
    assert da.id in {p.item.id for p in planner(db).select(1, 50)}


def test_extra_practice_when_nothing_is_due_or_new(db: Session) -> None:
    group1 = letters(db, 1)
    learn(db, group1, reps=2, due_in_days=2)
    # group 2 is unlocked, so new items exist; exhaust them by learning everything
    learn(db, [item for g in (2, 3) for item in letters(db, g)], reps=2)
    words = list(db.exec(select(Item).where(Item.kind == "word")))
    learn(db, words, reps=2)
    picked = planner(db).select(1, 10)
    assert len(picked) == 10 and not any(p.is_new for p in picked)
