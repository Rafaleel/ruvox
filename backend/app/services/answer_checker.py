import unicodedata


def normalize(text: str) -> str:
    """Forgiving form for typed Cyrillic: NFC, trimmed, case-folded, ё treated as е."""
    return unicodedata.normalize("NFC", text).strip().casefold().replace("ё", "е")


def answers_match(expected: str, given: str, *, typed: bool = False) -> bool:
    """Choice answers must equal the option text; typed answers are normalized."""
    if typed:
        return normalize(expected) == normalize(given)
    return expected == given
