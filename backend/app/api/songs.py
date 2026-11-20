from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, col, delete, func, select

from app.api.sessions import USER_ID
from app.db import get_session
from app.models import Item, ReviewState, Song
from app.models.schemas import MAX_LYRICS_CHARS, SongDetail, SongIn, SongOut

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
