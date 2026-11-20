from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, col, delete, func, select

from app.agents.llm import LLMUnavailable
from app.agents.music import SongAnalysisOut, analyze_lyric, clean_excerpt, is_cyrillic
from app.api.sessions import USER_ID, Llm
from app.db import get_session
from app.models import Item, ReviewState, Song, now_utc
from app.models.schemas import (
    MAX_LYRICS_CHARS,
    ConfirmIn,
    ConfirmOut,
    SongDetail,
    SongIn,
    SongOut,
)
from app.services.answer_checker import normalize

router = APIRouter(prefix="/api/songs", tags=["songs"])
Db = Annotated[Session, Depends(get_session)]


def own_song(db: Session, song_id: int) -> Song:
    song = db.get(Song, song_id)
    if song is None or song.user_id != USER_ID:
        raise HTTPException(404, "Música não encontrada.")
    return song


def item_count(db: Session, song_id: int) -> int:
    return db.exec(
        select(func.count()).select_from(Item).where(Item.song_id == song_id)
    ).one()


def song_out(db: Session, song: Song) -> SongOut:
    assert song.id is not None
    return SongOut(
        id=song.id,
        title=song.title,
        artist=song.artist,
        created_at=song.created_at,
        characters=len(song.text),
        items=item_count(db, song.id),
    )


@router.post("", response_model=SongOut, status_code=201)
def create_song(body: SongIn, db: Db) -> SongOut:
    # Lyrics are pasted by the user and live only in the local database.
    if len(body.text) > MAX_LYRICS_CHARS:
        raise HTTPException(
            413, f"A letra é grande demais (máximo {MAX_LYRICS_CHARS} caracteres)."
        )
    song = Song(
        user_id=USER_ID,
        title=body.title.strip(),
        artist=body.artist.strip(),
        text=body.text,
    )
    db.add(song)
    db.commit()
    db.refresh(song)
    return song_out(db, song)


@router.get("", response_model=list[SongOut])
def list_songs(db: Db) -> list[SongOut]:
    songs = db.exec(
        select(Song).where(Song.user_id == USER_ID).order_by(col(Song.id).desc())
    ).all()
    return [song_out(db, s) for s in songs]


@router.get("/{song_id}", response_model=SongDetail)
def get_song(song_id: int, db: Db) -> SongDetail:
    song = own_song(db, song_id)
    return SongDetail(**song_out(db, song).model_dump(), text=song.text)


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: int, db: Db) -> Response:
    song = own_song(db, song_id)
    item_ids = db.exec(select(Item.id).where(Item.song_id == song_id)).all()
    if item_ids:
        db.exec(
            delete(ReviewState).where(
                col(ReviewState.item_id).in_(item_ids),
                col(ReviewState.user_id) == USER_ID,
            )
        )
        db.exec(delete(Item).where(col(Item.song_id) == song_id))
    db.delete(song)
    db.commit()
    return Response(status_code=204)


def known_items(db: Session) -> dict[str, int]:
    """Normalized text of everything the learner already studies -> item id."""
    rows = db.exec(
        select(Item.text, Item.id).where(Item.user_id == USER_ID, Item.kind != "letter")
    ).all()  # letters are not vocabulary: the word "и" is not the letter И
    return {normalize(text): item_id for text, item_id in rows if item_id is not None}


@router.post("/{song_id}/analyze", response_model=SongAnalysisOut)
def analyze_song(song_id: int, db: Db, llm: Llm) -> SongAnalysisOut:
    """Extract study material without saving anything; the user reviews it first."""
    song = own_song(db, song_id)
    if llm is None:
        raise HTTPException(503, "A análise de músicas precisa da chave da API.")
    try:
        result = analyze_lyric(llm, song.text, known_items(db))
    except LLMUnavailable as exc:
        raise HTTPException(
            503, "Não foi possível analisar a música agora. Tente de novo em instantes."
        ) from exc
    if not result.entries:
        raise HTTPException(422, "Não encontrei vocabulário em russo nesta letra.")
    return result


@router.post("/{song_id}/confirm", response_model=ConfirmOut)
def confirm_song(song_id: int, body: ConfirmIn, db: Db) -> ConfirmOut:
    """Save the entries the user kept as study items linked to this song."""
    song = own_song(db, song_id)
    known = known_items(db)
    created = skipped = rejected = 0
    for entry in body.entries:
        key = normalize(entry.text)
        if (
            not is_cyrillic(entry.text)
            or not entry.pronunciation_pt.strip()
            or not entry.meaning_pt.strip()
        ):
            rejected += 1
        elif key in known:
            skipped += 1
        else:
            item = Item(
                user_id=USER_ID,
                kind=entry.kind,
                text=entry.text.strip(),
                pronunciation=entry.pronunciation_pt.strip(),
                meaning=entry.meaning_pt.strip(),
                source="song",
                difficulty=2,
                song_id=song.id,
                excerpt=clean_excerpt(entry.excerpt, song.text, entry.text),
            )
            db.add(item)
            db.flush()
            assert item.id is not None
            db.add(ReviewState(user_id=USER_ID, item_id=item.id, next_review=now_utc()))
            known[key] = item.id
            created += 1
    db.commit()
    return ConfirmOut(created=created, skipped=skipped, rejected=rejected)
