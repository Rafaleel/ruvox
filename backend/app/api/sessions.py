import random
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, col, select

from app.agents.corrector import review_typed_answer
from app.agents.llm import StructuredLLM, get_llm
from app.db import get_session
from app.models import Attempt, Item, Question, ReviewState, StudySession, now_utc
from app.models.schemas import (
    AnswerIn,
    AnswerOut,
    FinishOut,
    ItemOut,
    QuestionOut,
    SessionCreate,
    SessionOut,
)
from app.services.answer_checker import answers_match
from app.services.questions import QuestionDraft, SeedQuestionGenerator
from app.services.selection import SeedContentPlanner, as_utc
from app.services.srs import apply_to_review_state, can_requeue, mapped_grade

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
USER_ID = 1  # D14: single user per install

Db = Annotated[Session, Depends(get_session)]


def llm_dependency(request: Request) -> StructuredLLM | None:
    return get_llm(request.app.state.engine)


Llm = Annotated[StructuredLLM | None, Depends(llm_dependency)]


def question_out(question: Question) -> QuestionOut:
    assert question.id is not None
    return QuestionOut.model_validate(
        {**question.model_dump(), "id": question.id, "options": question.options}
    )


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
def create_session(body: SessionCreate, db: Db) -> SessionOut:
    mode = None if body.mode == "mixed" else body.mode
    plan = SeedContentPlanner(db).select(USER_ID, body.size)
    drafts = SeedQuestionGenerator(db, random.Random()).generate(plan, body.size, mode)
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
        source="offline",
        questions=[question_out(q) for q in questions],
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

    typed = question.input_kind == "text"
    explanation = question.explanation
    if answers_match(question.answer, body.answer, typed=typed):
        correct, grade = (
            True,
            (5 if typed else mapped_grade(correct=True, time_ms=body.time_ms)),
        )
    elif typed:
        # Not an exact match: the corrector explains near misses (offline: just wrong).
        verdict = review_typed_answer(
            llm,
            question=question.prompt,
            expected=question.answer,
            given=body.answer,
            explanation=question.explanation,
        )
        correct, grade, explanation = (
            verdict.correct,
            verdict.grade,
            verdict.explanation,
        )
    else:
        correct, grade = False, mapped_grade(correct=False, time_ms=body.time_ms)
    now = now_utc()
    for item_id in question.item_ids:
        state = db.get(ReviewState, (USER_ID, item_id)) or ReviewState(
            user_id=USER_ID, item_id=item_id
        )
        apply_to_review_state(state, grade, now)
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
                )
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
