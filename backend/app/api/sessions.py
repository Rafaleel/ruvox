import json
import random
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, col, select

from app.agents.corrector import review_typed_answer
from app.agents.llm import StructuredLLM, get_llm
from app.agents.team import SessionTeam
from app.db import get_session
from app.models import (
    Attempt,
    Item,
    Question,
    ReviewState,
    Song,
    StudySession,
    now_utc,
)
from app.models.schemas import (
    AnswerIn,
    AnswerOut,
    FinishOut,
    ItemOut,
    LessonOut,
    Pair,
    QuestionOut,
    SessionCreate,
    SessionOut,
)
from app.services.answer_checker import answers_match
from app.services.profile import update_profile
from app.services.questions import QuestionDraft, SeedQuestionGenerator
from app.services.selection import as_utc
from app.services.srs import (
    apply_to_review_state,
    can_requeue,
    flashcard_grade,
    mapped_grade,
    pairs_grade,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
USER_ID = 1  # D14: single user per install

Db = Annotated[Session, Depends(get_session)]


def llm_dependency(request: Request) -> StructuredLLM | None:
    return get_llm(request.app.state.engine)


Llm = Annotated[StructuredLLM | None, Depends(llm_dependency)]


def question_out(db: Session, question: Question) -> QuestionOut:
    assert question.id is not None
    data = {**question.model_dump(), "id": question.id, "options": question.options}
    if question.input_kind == "flip":
        data["reveal"] = question.explanation
    elif question.input_kind == "pairs":
        items = {
            item.id: item
            for item in db.exec(select(Item).where(col(Item.id).in_(question.item_ids)))
        }
        data["pairs"] = [
            Pair(
                item_id=item_id,
                left=items[item_id].text,
                right=items[item_id].pronunciation
                if items[item_id].kind == "letter"
                else items[item_id].meaning,
            )
            for item_id in question.item_ids
            if item_id in items
        ]
    return QuestionOut.model_validate(data)


def add_question(db: Session, session_id: int, draft: QuestionDraft) -> Question:
    question = Question(session_id=session_id, user_id=USER_ID, **draft.model_dump())
    db.add(question)
    db.flush()
    return question


def open_session(db: Session, session_id: int) -> StudySession:
    study = db.get(StudySession, session_id)
    if study is None:
        raise HTTPException(404, "Sessão não encontrada.")
    return study


@router.post("", response_model=SessionOut)
def create_session(body: SessionCreate, db: Db, llm: Llm) -> SessionOut:
    mode = None if body.mode == "mixed" else body.mode
    if body.song_id is not None:
        song = db.get(Song, body.song_id)
        if song is None or song.user_id != USER_ID:
            raise HTTPException(404, "Música não encontrada.")
    prepared = SessionTeam(db, llm).prepare(USER_ID, body.size, mode, body.song_id)
    drafts = prepared.drafts
    if not drafts:
        raise HTTPException(409, "Ainda não há nada para treinar neste modo.")
    study = StudySession(user_id=USER_ID, mode=str(body.mode))
    db.add(study)
    db.flush()
    assert study.id is not None
    questions = [add_question(db, study.id, draft) for draft in drafts]
    db.commit()
    return SessionOut(
        session_id=study.id,
        source=prepared.source,
        questions=[question_out(db, q) for q in questions],
        lessons=lessons_for(db, drafts),
    )


MAX_LESSONS = 6


def lessons_for(db: Session, drafts: list[QuestionDraft]) -> list[LessonOut]:
    """Intro cards for the session's items that have no review state yet."""
    ids = list(dict.fromkeys(i for d in drafts for i in d.item_ids))
    seen = set(
        db.exec(
            select(ReviewState.item_id).where(
                ReviewState.user_id == USER_ID, col(ReviewState.item_id).in_(ids)
            )
        )
    )
    generator = SeedQuestionGenerator(db)
    lessons = []
    for item_id in ids:
        item = db.get(Item, item_id)
        if item is None or item_id in seen or item.user_id != USER_ID:
            continue
        lessons.append(
            LessonOut(
                item_id=item_id,
                kind=item.kind,
                text=item.text,
                pronunciation=item.pronunciation,
                meaning=item.meaning,
                note=generator.lesson_note(item),
            )
        )
    return lessons[:MAX_LESSONS]


def evaluate(
    question: Question, body: AnswerIn, llm: StructuredLLM | None
) -> tuple[bool, dict[int, int], str]:
    """Correctness, a grade per item and the explanation to show."""
    ids = question.item_ids
    if question.input_kind == "flip":  # flashcards are self-graded
        if body.answer not in ("knew", "missed"):
            raise HTTPException(422, "Resposta inválida.")
        knew = body.answer == "knew"
        return (
            knew,
            dict.fromkeys(ids, flashcard_grade(knew=knew)),
            question.explanation,
        )
    if question.input_kind == "pairs":  # the client reports mistakes per item
        try:
            reported = {
                int(k): min(100, max(0, int(v)))
                for k, v in json.loads(body.answer).items()
            }
        except (ValueError, TypeError, AttributeError, OverflowError) as exc:
            raise HTTPException(422, "Resposta inválida.") from exc
        grades = {i: pairs_grade(mistakes=reported.get(i, 0)) for i in ids}
        return sum(reported.get(i, 0) for i in ids) == 0, grades, question.explanation
    typed = question.input_kind == "text"
    if answers_match(question.answer, body.answer, typed=typed):
        grade = 5 if typed else mapped_grade(correct=True, time_ms=body.time_ms)
        return True, dict.fromkeys(ids, grade), question.explanation
    if typed:
        # Not an exact match: the corrector explains near misses (offline: just wrong).
        verdict = review_typed_answer(
            llm,
            question=question.prompt,
            expected=question.answer,
            given=body.answer,
            explanation=question.explanation,
        )
        return verdict.correct, dict.fromkeys(ids, verdict.grade), verdict.explanation
    return (
        False,
        dict.fromkeys(ids, mapped_grade(correct=False, time_ms=body.time_ms)),
        question.explanation,
    )


@router.post("/{session_id}/answers", response_model=AnswerOut)
def answer(session_id: int, body: AnswerIn, db: Db, llm: Llm) -> AnswerOut:
    study = open_session(db, session_id)
    if study.ended_at is not None:
        raise HTTPException(409, "Esta sessão já terminou.")
    question = db.get(Question, body.question_id)
    if question is None or question.session_id != session_id:
        raise HTTPException(404, "Pergunta não encontrada nesta sessão.")
    if db.exec(select(Attempt).where(Attempt.question_id == question.id)).first():
        raise HTTPException(409, "Esta pergunta já foi respondida.")

    correct, item_grades, explanation = evaluate(question, body, llm)
    grade = min(item_grades.values(), default=1)
    now = now_utc()
    for item_id, item_grade in item_grades.items():
        state = db.get(ReviewState, (USER_ID, item_id)) or ReviewState(
            user_id=USER_ID, item_id=item_id
        )
        apply_to_review_state(state, item_grade, now)
        db.add(state)
    db.add(
        Attempt(
            user_id=USER_ID,
            question_id=question.id or 0,
            answer=body.answer,
            correct=correct,
            grade=grade,
            time_ms=body.time_ms,
        )
    )
    study.score += int(correct)
    db.add(study)

    requeued = None
    if not correct:
        copies = db.exec(
            select(Question).where(
                Question.session_id == session_id, Question.prompt == question.prompt
            )
        ).all()
        if can_requeue(len(copies) - 1):
            options = list(question.options)
            random.shuffle(options)
            requeued = question_out(
                db,
                add_question(
                    db,
                    session_id,
                    QuestionDraft(
                        type=question.type,  # type: ignore[arg-type]
                        prompt=question.prompt,
                        options=options,
                        answer=question.answer,
                        explanation=question.explanation,
                        item_ids=question.item_ids,
                        input_kind=question.input_kind,  # type: ignore[arg-type]
                    ),
                ),
            )
    db.commit()
    return AnswerOut(
        correct=correct,
        grade=grade,
        correct_answer=question.answer,
        explanation=explanation,
        requeued_question=requeued,
    )


@router.post("/{session_id}/finish", response_model=FinishOut)
def finish(session_id: int, db: Db) -> FinishOut:
    study = open_session(db, session_id)
    if study.ended_at is None:
        study.ended_at = now_utc()
        db.add(study)
        db.flush()
        update_profile(db, USER_ID)
        db.commit()
    attempts = db.exec(
        select(Attempt, Question)
        .join(Question, col(Question.id) == col(Attempt.question_id))
        .where(Question.session_id == session_id)
    ).all()
    wrong_ids = {i for a, q in attempts if not a.correct for i in q.item_ids}
    items = db.exec(select(Item).where(col(Item.id).in_(wrong_ids))).all()
    assert study.ended_at is not None
    return FinishOut(
        score=study.score,
        answered=len(attempts),
        correct=sum(a.correct for a, _ in attempts),
        items_to_review=[ItemOut.model_validate(i.model_dump()) for i in items],
        ended_at=as_utc(study.ended_at),
    )
