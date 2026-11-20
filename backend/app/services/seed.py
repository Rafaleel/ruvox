from sqlmodel import Session, select

from app.models import Item, ItemKind, ItemSource

# (letter, approximate pt-BR pronunciation, alphabet group)
# Group 1: same look and sound as Portuguese. Group 2: looks Latin, sounds different.
# Group 3: new letters.
ALPHABET: list[tuple[str, str, int]] = [
    ("А", "a", 1),
    ("К", "k", 1),
    ("М", "m", 1),
    ("О", "o", 1),
    ("Т", "t", 1),
    ("В", "v", 2),
    ("Е", "iê", 2),
    ("Н", "n", 2),
    ("Р", "r (vibrante, como em 'caro')", 2),
    ("С", "s (sempre som de s)", 2),
    ("У", "u", 2),
    ("Х", "rr (como o r de 'rato')", 2),
    ("Б", "b", 3),
    ("Г", "g (como em 'gato')", 3),
    ("Д", "d", 3),
    ("Ё", "iô", 3),
    ("Ж", "j (como em 'jeito')", 3),
    ("З", "z", 3),
    ("И", "i", 3),
    ("Й", "i curto (como em 'pai')", 3),
    ("Л", "l", 3),
    ("П", "p", 3),
    ("Ф", "f", 3),
    ("Ц", "ts (como em 'pizza')", 3),
    ("Ч", "tch (como em 'tchau')", 3),
    ("Ш", "x (como em 'xícara')", 3),
    ("Щ", "xtch (x longo + tch)", 3),
    ("Ъ", "sinal duro (sem som)", 3),
    ("Ы", "i fechado, no fundo da garganta", 3),
    ("Ь", "sinal mole (suaviza a consoante)", 3),
    ("Э", "é", 3),
    ("Ю", "iu", 3),
    ("Я", "iá", 3),
]


def seed_alphabet(session: Session) -> int:
    """Insert the 33 letters once. Returns how many rows were added."""
    if session.exec(select(Item).where(Item.kind == ItemKind.LETTER)).first():
        return 0
    for text, pronunciation, group in ALPHABET:
        session.add(
            Item(
                kind=ItemKind.LETTER,
                text=text,
                pronunciation=pronunciation,
                source=ItemSource.SEED,
                group=group,
            )
        )
    session.commit()
    return len(ALPHABET)
