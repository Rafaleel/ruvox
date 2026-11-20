from datetime import UTC, date, datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Attempt, Item, Question, ReviewState, StudySession
from app.services.stats import MIN_ANSWERS_FOR_STREAK, activity, mastery, streaks

BRT = timezone(timedelta(hours=-3))
NOW = datetime(2026, 11, 20, 15, tzinfo=UTC)  # 12:00 on the 20th in BRT


def d(day: int) -> date:
    return date(2026, 11, day)


def test_streak_rules() -> None:
    assert streaks(set(), d(20)) == (0, 0)
    assert streaks({d(18), d(19), d(20)}, d(20)) == (3, 3)
    assert streaks({d(18), d(19)}, d(20)) == (
        2,
        2,
    )  # today still open: yesterday counts
    assert streaks({d(16), d(17)}, d(20)) == (0, 2)  # broken
    assert streaks({d(10), d(11), d(12), d(15)}, d(15)) == (1, 3)


def add_session(db: Session, day: datetime, answered: int, correct: int) -> None:
    study = StudySession(mode="mixed", started_at=day, ended_at=day)
    db.add(study)
    db.flush()
    for index in range(answered):
        question = Question(
            session_id=study.id or 0,
            type="typing",
            prompt=str(index),
            options=[],
            answer="a",
            explanation="",
            item_ids=[1],
            input_kind="text",
        )
        db.add(question)
        db.flush()
        db.add(
            Attempt(
                question_id=question.id or 0,
                answer="a",
                correct=index < correct,
                grade=3,
                time_ms=1,
                created_at=day,
            )
        )
    db.commit()


def test_activity_uses_the_local_day_and_the_five_answer_minimum(db: Session) -> None:
    # 23:30 on the 19th in BRT is already the 20th in UTC: it must count for the 19th.
    add_session(
        db, datetime(2026, 11, 20, 2, 30, tzinfo=UTC), MIN_ANSWERS_FOR_STREAK, 4
    )
    add_session(db, NOW, MIN_ANSWERS_FOR_STREAK - 1, 4)  # too short for the streak
    result = activity(db, 1, NOW, BRT)
    days = {row["date"]: row for row in result["days"]}  # type: ignore[attr-defined]
    assert len(result["days"]) == 30  # type: ignore[arg-type]
    assert (days["2026-11-19"]["answered"], days["2026-11-19"]["correct"]) == (5, 4)
    assert days["2026-11-20"]["sessions"] == 1
    assert (result["streak"], result["best_streak"], result["today_done"]) == (
        1,
        1,
        False,
    )


def test_mastery_buckets(db: Session) -> None:
    ids = [item.id or 0 for item in db.exec(select(Item).limit(4)).all()]
    for item_id, reps, interval in zip(ids, (0, 2, 3, 3), (1, 6, 30, 5), strict=True):
        db.add(ReviewState(item_id=item_id, repetitions=reps, interval_days=interval))
    db.commit()
    counts = mastery(db, 1)
    assert (counts["learning"], counts["familiar"], counts["mastered"]) == (1, 2, 1)
    assert counts["new"] == 83 - 4


def test_stats_endpoint(client: TestClient) -> None:
    body = client.get("/api/stats").json()
    assert body["streak"] == 0 and body["today_done"] is False
    assert len(body["days"]) == 30 and body["mastery"]["new"] == 83
    session = client.post("/api/sessions", json={"size": 5}).json()
    for question in session["questions"]:
        client.post(
            f"/api/sessions/{session['session_id']}/answers",
            json={"question_id": question["id"], "answer": "x", "time_ms": 10},
        )
    client.post(f"/api/sessions/{session['session_id']}/finish")
    after = client.get("/api/stats").json()
    assert (after["streak"], after["today_done"]) == (1, True)
    assert after["days"][-1]["answered"] >= 5 and after["mastery"]["learning"] == 5
