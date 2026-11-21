import random

from sqlmodel import Session, select

from app.models import Item
from app.services.answer_checker import answers_match, normalize
from app.services.questions import OPTION_COUNT, SeedQuestionGenerator
from app.services.selection import PlannedItem


def plan_of(db: Session, *texts: str) -> list[PlannedItem]:
    return [
        PlannedItem(db.exec(select(Item).where(Item.text == t)).one(), True)
        for t in texts
    ]


def generator(db: Session, seed: int = 1) -> SeedQuestionGenerator:
    return SeedQuestionGenerator(db, random.Random(seed))


def test_every_question_has_four_unique_options_with_one_correct(db: Session) -> None:
    plan = plan_of(db, "Ч", "А", "банан", "метро", "Ж")
    for question in generator(db).generate(plan, 10):
        assert len(question.options) == OPTION_COUNT
        assert len(set(question.options)) == OPTION_COUNT
        assert question.options.count(question.answer) == 1
        assert question.item_ids


def test_prompts_and_explanations_follow_the_spec(db: Session) -> None:
    by_type = {
        q.type: q for q in generator(db).generate(plan_of(db, "Ч", "банан"), 10, None)
    }
    assert by_type["letter_to_sound"].prompt == "Como se lê «Ч»?"
    assert by_type["letter_to_sound"].explanation.startswith("Ч lê-se tch")
    assert by_type["word_to_meaning"].prompt == "O que significa «банан» (ba-NÁN)?"
    assert "Letra por letra: б = " in by_type["word_to_meaning"].explanation
    assert by_type["word_to_meaning"].answer == "banana"


def test_small_plan_is_padded_with_the_other_letter_mode_without_duplicates(
    db: Session,
) -> None:
    questions = generator(db).generate(plan_of(db, "А", "К", "М"), 10)
    assert len(questions) == 6
    assert len({q.prompt for q in questions}) == 6
    assert {q.type for q in questions} == {"letter_to_sound", "sound_to_letter"}


def test_size_limits_the_questions_and_mode_filters_them(db: Session) -> None:
    plan = plan_of(db, "А", "К", "М", "банан")
    assert len(generator(db).generate(plan, 2)) == 2
    only_words = generator(db).generate(plan, 10, mode=3)
    assert [q.type for q in only_words] == ["word_to_meaning"]


def test_same_seed_gives_the_same_questions(db: Session) -> None:
    plan = plan_of(db, "Ч", "Ж", "банан")
    first = generator(db, 7).generate(plan, 10)
    assert first == generator(db, 7).generate(plan, 10)


def test_answer_checker() -> None:
    assert normalize("  Ёлка ") == "елка"
    assert answers_match("елка", "ЁЛКА", typed=True)
    assert not answers_match("елка", "елки", typed=True)
    assert answers_match("tch (como em 'tchau')", "tch (como em 'tchau')")
    assert not answers_match("a", "A")


def test_typing_questions_have_no_options_and_ask_for_cyrillic(db: Session) -> None:
    letter, word = generator(db).generate(plan_of(db, "Ч", "банан"), 5, mode=4)
    assert (letter.type, letter.input_kind, letter.options) == ("typing", "text", [])
    assert letter.answer == "Ч" and letter.prompt.startswith("Digite em russo a letra")
    assert (
        word.answer == "банан" and "banana" in word.prompt and "ba-NÁN" in word.prompt
    )


def test_typing_is_never_part_of_a_mixed_session(db: Session) -> None:
    kinds = {q.type for q in generator(db).generate(plan_of(db, "Ч", "А", "банан"), 10)}
    assert "typing" not in kinds


def test_stress_marks_are_ignored() -> None:
    assert answers_match("банан", "бана́н", typed=True)
    assert answers_match("й", "Й", typed=True)


def test_alphabet_mode_only_asks_about_letters(db: Session) -> None:
    plan = plan_of(db, "А", "К", "М", "банан")
    drafts = generator(db).generate(plan, 10, mode=8)
    assert {q.type for q in drafts} == {"letter_to_sound", "sound_to_letter"}
