from collections import Counter
from datetime import date, datetime, timedelta, tzinfo

from sqlmodel import Session, col, func, select

from app.models import Attempt, Item, Question, ReviewState, StudySession
from app.services.selection import as_utc

MIN_ANSWERS_FOR_STREAK = 5
HISTORY_DAYS = 30
MASTERED_INTERVAL_DAYS = 21


def local_day(value: datetime, tz: tzinfo) -> date:
    return as_utc(value).astimezone(tz).date()


def bucket(state: ReviewState | None) -> str:
    """new (never answered), learning, familiar or mastered."""
    if state is None:
        return "new"
    if state.interval_days >= MASTERED_INTERVAL_DAYS:
        return "mastered"
    return "familiar" if state.repetitions >= 2 else "learning"


def mastery(db: Session, user_id: int) -> dict[str, int]:
    """new: never answered; learning: repetitions < 2; familiar; mastered: interval >= 21 days."""
    total = db.exec(
        select(func.count()).select_from(Item).where(Item.user_id == user_id)
    ).one()
    states = db.exec(select(ReviewState).where(ReviewState.user_id == user_id)).all()
    counts = Counter(
        "mastered"
        if s.interval_days >= MASTERED_INTERVAL_DAYS
        else "familiar"
        if s.repetitions >= 2
        else "learning"
        for s in states
    )
    return {
        "new": max(0, total - len(states)),
        "learning": counts["learning"],
        "familiar": counts["familiar"],
        "mastered": counts["mastered"],
    }


def streaks(active_days: set[date], today: date) -> tuple[int, int]:
    """Current streak (ending today, or yesterday if today has no session yet) and best."""
    best = run = 0
    previous: date | None = None
    for day in sorted(active_days):
        run = run + 1 if previous and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    cursor = today if today in active_days else today - timedelta(days=1)
    current = 0
    while cursor in active_days:
        current += 1
        cursor -= timedelta(days=1)
    return current, best


def activity(db: Session, user_id: int, now: datetime, tz: tzinfo) -> dict[str, object]:
    today = local_day(now, tz)
    first = today - timedelta(days=HISTORY_DAYS - 1)
    attempts = db.exec(select(Attempt).where(Attempt.user_id == user_id)).all()
    answered: Counter[date] = Counter()
    correct: Counter[date] = Counter()
    for attempt in attempts:
        day = local_day(attempt.created_at, tz)
        answered[day] += 1
        correct[day] += int(attempt.correct)

    sessions = db.exec(
        select(StudySession).where(
            StudySession.user_id == user_id, col(StudySession.ended_at).is_not(None)
        )
    ).all()
    per_session = Counter(
        db.exec(
            select(Question.session_id).join(
                Attempt, col(Attempt.question_id) == col(Question.id)
            )
        ).all()
    )
    finished: Counter[date] = Counter()
    active: set[date] = set()
    for session in sessions:
        assert session.ended_at is not None and session.id is not None
        day = local_day(session.ended_at, tz)
        finished[day] += 1
        if per_session[session.id] >= MIN_ANSWERS_FOR_STREAK:
            active.add(day)
    current, best = streaks(active, today)
    days = [
        {
            "date": (day := first + timedelta(days=offset)).isoformat(),
            "answered": answered[day],
            "correct": correct[day],
            "sessions": finished[day],
        }
        for offset in range(HISTORY_DAYS)
    ]
    return {
        "days": days,
        "streak": current,
        "best_streak": best,
        "today_done": today in active,
    }
