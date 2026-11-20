import json

from pydantic import BaseModel, Field

from app.agents.llm import LLMUnavailable, StructuredLLM
from app.services.answer_checker import normalize


class Correction(BaseModel):
    correct: bool
    grade: int = Field(ge=0, le=5)
    explanation_pt: str = Field(max_length=500)
    normalized_answer: str = Field(max_length=200)


class Verdict(BaseModel):
    correct: bool
    grade: int
    explanation: str


def review_typed_answer(
    llm: StructuredLLM | None,
    *,
    question: str,
    expected: str,
    given: str,
    explanation: str,
) -> Verdict:
    """Judge an answer that failed the deterministic check.

    The server, not the model, decides correctness: a model verdict of `correct` only
    counts when its cleaned-up answer really equals the expected text. Without a model,
    or when the call fails, the answer is simply wrong (grade 1).
    """
    offline = Verdict(
        correct=False,
        grade=1,
        explanation=f"A resposta certa é «{expected}». {explanation}".strip(),
    )
    if llm is None or not given.strip():
        return offline
    payload = json.dumps(
        {"question": question, "expected": expected, "given": given}, ensure_ascii=False
    )
    try:
        result = llm.run("corrector", "corrector", payload, Correction)
    except LLMUnavailable:
        return offline
    if normalize(result.normalized_answer) == normalize(expected):
        return Verdict(correct=True, grade=4, explanation=result.explanation_pt)
    return Verdict(
        correct=False, grade=min(result.grade, 2), explanation=result.explanation_pt
    )
