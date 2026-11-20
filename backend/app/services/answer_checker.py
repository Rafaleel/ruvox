import unicodedata


def normalize(text: str) -> str:
    """Forgiving form for typed Cyrillic: NFC, trimmed, case-folded, stress marks dropped, ё treated as е."""
    plain = text.replace("\u0301", "").replace("\u0300", "")  # stress marks
    return unicodedata.normalize("NFC", plain).strip().casefold().replace("ё", "е")


def answers_match(expected: str, given: str, *, typed: bool = False) -> bool:
    """Choice answers must equal the option text; typed answers are normalized."""
    if typed:
        return normalize(expected) == normalize(given)
    return expected == given
