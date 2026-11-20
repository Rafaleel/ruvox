import re
from collections.abc import Iterable

from pydantic import BaseModel, Field

from app.agents.llm import StructuredLLM
from app.services.answer_checker import normalize

MAX_ENTRIES = 40
MAX_GRAMMAR = 10
MAX_EXCERPT_WORDS = 8
CYRILLIC_WORD = re.compile(r"[а-яё]+(?:[ \-][а-яё]+)*")


class VocabEntry(BaseModel):
    text: str = Field(max_length=100)
    lemma: str = Field(max_length=100)
    pronunciation_pt: str = Field(max_length=100)
    meaning_pt: str = Field(max_length=200)
    part_of_speech: str = Field(default="", max_length=50)
    excerpt: str = Field(default="", max_length=300)


class GrammarPoint(BaseModel):
    point_pt: str = Field(max_length=500)
    excerpt: str = Field(default="", max_length=300)


class SongAnalysis(BaseModel):
    vocabulary: list[VocabEntry]
    expressions: list[VocabEntry]
    grammar: list[GrammarPoint]


class AnalyzedEntry(VocabEntry):
    kind: str
    existing_item_id: int | None = None  # already studied: linked, not duplicated


class SongAnalysisOut(BaseModel):
    entries: list[AnalyzedEntry]
    grammar: list[GrammarPoint]


def lyric_payload(lyric: str) -> str:
    """The lyric is untrusted: delimit it and never let it close the delimiter."""
    safe = re.sub(r"</?lyrics>", "", lyric, flags=re.IGNORECASE)
    return f"<lyrics>\n{safe}\n</lyrics>"


def is_cyrillic(text: str) -> bool:
    return CYRILLIC_WORD.fullmatch(normalize(text)) is not None


def clean_excerpt(excerpt: str, lyric: str, must_contain: str = "") -> str:
    """Keep an excerpt only if it really is in the lyric; cap it at 8 words."""
    collapsed = " ".join(lyric.split())
    wanted = " ".join(excerpt.split())
    if not wanted:
        return ""
    start = collapsed.casefold().find(wanted.casefold())
    if start < 0:
        return ""
    words = collapsed[start : start + len(wanted)].split()[:MAX_EXCERPT_WORDS]
    result = " ".join(words)
    if must_contain and normalize(must_contain) not in normalize(result):
        return ""
    return result


def clean_analysis(
    analysis: SongAnalysis, lyric: str, known: dict[str, int]
) -> SongAnalysisOut:
    """Drop anything the model got wrong; `known` maps normalized text to an item id."""
    entries: list[AnalyzedEntry] = []
    seen: set[str] = set()
    pools: Iterable[tuple[str, list[VocabEntry]]] = (
        ("word", analysis.vocabulary),
        ("expression", analysis.expressions),
    )
    for kind, pool in pools:
        for entry in pool:
            key = normalize(entry.lemma or entry.text)
            if not is_cyrillic(entry.text) or key in seen:
                continue
            if not entry.pronunciation_pt.strip() or not entry.meaning_pt.strip():
                continue
            seen.add(key)
            entries.append(
                AnalyzedEntry(
                    **{
                        **entry.model_dump(),
                        "text": entry.text.strip(),
                        "excerpt": clean_excerpt(entry.excerpt, lyric, entry.text),
                    },
                    kind=kind,
                    existing_item_id=known.get(normalize(entry.text)) or known.get(key),
                )
            )
    grammar = [
        GrammarPoint(
            point_pt=point.point_pt.strip(),
            excerpt=clean_excerpt(point.excerpt, lyric),
        )
        for point in analysis.grammar
        if point.point_pt.strip()
    ][:MAX_GRAMMAR]
    return SongAnalysisOut(entries=entries[:MAX_ENTRIES], grammar=grammar)


def analyze_lyric(
    llm: StructuredLLM, lyric: str, known: dict[str, int]
) -> SongAnalysisOut:
    """Raises LLMUnavailable on failure; returns only validated entries."""
    raw = llm.run("music", "music", lyric_payload(lyric), SongAnalysis)
    return clean_analysis(raw, lyric, known)
