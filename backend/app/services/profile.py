from collections import Counter

from sqlmodel import Session, col, func, select

from app.models import Attempt, Question, ReviewState, UserProfile, now_utc

BEGINNER_BELOW = 15  # items learned (repetitions >= 2)
ELEMENTARY_BELOW = 50


def update_profile(db: Session, user_id: int) -> UserProfile:
    """Refresh the learner summary the planner reads: level and most-missed items."""
    recent = db.exec(
        select(Attempt, Question)
        .join(Question, col(Question.id) == col(Attempt.question_id))
        .where(Attempt.user_id == user_id)
        .order_by(col(Attempt.id).desc())
        .limit(200)
    ).all()
    misses = Counter(
        i for attempt, q in recent if not attempt.correct for i in q.item_ids
    )
    learned = db.exec(
        select(func.count())
        .select_from(ReviewState)
        .where(ReviewState.user_id == user_id, ReviewState.repetitions >= 2)
    ).one()
    profile = db.get(UserProfile, user_id) or UserProfile(user_id=user_id)
    profile.level = (
        "beginner"
        if learned < BEGINNER_BELOW
        else "elementary"
        if learned < ELEMENTARY_BELOW
        else "intermediate"
    )
    profile.weak_points = [item_id for item_id, _ in misses.most_common(10)]
    profile.updated_at = now_utc()
    db.add(profile)
    return profile
