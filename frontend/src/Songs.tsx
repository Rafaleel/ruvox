import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  analyzeSong,
  ApiError,
  confirmSong,
  createSong,
  deleteSong,
  getSongs,
  MAX_LYRICS_CHARS,
  type AnalyzedEntry,
  type ConfirmEntry,
  type Song,
  type SongAnalysis,
} from "./api/client";
import { Button, buttonClasses } from "./components/Button";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-paper px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function NewSongForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [text, setText] = useState("");
  const create = useMutation({
    mutationFn: createSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      onDone();
    },
  });
  const tooLong = text.length > MAX_LYRICS_CHARS;
  const canSave = !!title.trim() && !!text.trim() && !tooLong;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSave && !create.isPending)
      create.mutate({ title: title.trim(), artist: artist.trim(), text });
  };

  return (
    <Card className="mt-6">
      <form onSubmit={submit} className="grid gap-4">
        <h2 className="text-xl font-bold">Nova música</h2>
        <label className="block font-semibold">
          Título
          <input
            className={inputClass}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block font-semibold">
          Artista (opcional)
          <input
            className={inputClass}
            value={artist}
            maxLength={200}
            onChange={(e) => setArtist(e.target.value)}
          />
        </label>
        <div>
          <label className="block font-semibold">
            Letra
            <textarea
              lang="ru"
              rows={8}
              className={`${inputClass} py-2 font-normal`}
              aria-describedby="lyrics-count"
              aria-invalid={tooLong}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <p
            id="lyrics-count"
            className={`mt-1 text-sm ${tooLong ? "font-semibold text-danger" : "text-muted"}`}
          >
            {text.length.toLocaleString("pt-BR")} /{" "}
            {MAX_LYRICS_CHARS.toLocaleString("pt-BR")} caracteres
            {tooLong &&
              ". A letra passou do limite: apague um trecho para salvar."}
          </p>
          <p className="mt-1 text-sm text-muted">
            A letra fica só neste computador.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSave || create.isPending}>
            {create.isPending ? "Salvando…" : "Salvar música"}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
        {create.isError && (
          <ErrorMessage
            error={create.error}
            onRetry={() =>
              create.mutate({
                title: title.trim(),
                artist: artist.trim(),
                text,
              })
            }
          />
        )}
      </form>
    </Card>
  );
}

function SongRow({
  song,
  onAnalyze,
}: {
  song: Song;
  onAnalyze: (song: Song) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteSong(song.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["songs"] }),
  });
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <h2 className="text-lg font-bold">{song.title}</h2>
      {song.artist && <p className="text-muted">{song.artist}</p>}
      <p className="mt-1 text-sm text-muted">
        {song.items > 0
          ? plural(song.items, "palavra salva", "palavras salvas")
          : "Nenhuma palavra salva ainda"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onAnalyze(song)}>
          Analisar
        </Button>
        {song.items > 0 && (
          <Link
            to={`/play?song=${song.id}`}
            className={buttonClasses("primary")}
          >
            Treinar esta música
          </Link>
        )}
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Apagar
        </Button>
      </div>
      {confirming && (
        <div
          role="alertdialog"
          aria-label={`Apagar ${song.title}`}
          className="mt-3 grid gap-3 rounded-lg border border-danger p-3"
        >
          <p>
            Apagar “{song.title}”? As palavras salvas dela e o seu progresso
            nessas palavras também serão apagados. Não dá para desfazer.
          </p>
          <div className="flex gap-2">
            <Button disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? "Apagando…" : "Apagar de vez"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {remove.isError && (
        <div className="mt-3">
          <ErrorMessage error={remove.error} onRetry={() => remove.mutate()} />
        </div>
      )}
    </Card>
  );
}

function Review({
  song,
  analysis,
  onBack,
}: {
  song: Song;
  analysis: SongAnalysis;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const isNew = (e: AnalyzedEntry) => !e.existing_item_id;
  // Indexes of the selected entries: all new ones start checked.
  const [selected, setSelected] = useState(
    () => new Set(analysis.entries.flatMap((e, i) => (isNew(e) ? [i] : []))),
  );
  const confirm = useMutation({
    mutationFn: () =>
      confirmSong(
        song.id,
        analysis.entries
          .filter((_, i) => selected.has(i))
          .map((e): ConfirmEntry => ({
            text: e.text,
            pronunciation_pt: e.pronunciation_pt,
            meaning_pt: e.meaning_pt,
            kind: e.kind as ConfirmEntry["kind"],
            excerpt: e.excerpt,
          })),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["songs"] }),
  });

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  if (confirm.isSuccess)
    return (
      <>
        <h1 className="text-3xl font-extrabold">{song.title}</h1>
        <p role="status" className="mt-4 text-xl font-bold text-success">
          {confirm.data.created === 1
            ? "1 palavra adicionada"
            : `${confirm.data.created} palavras adicionadas`}
        </p>
        {(confirm.data.skipped > 0 || confirm.data.rejected > 0) && (
          <p className="mt-1 text-muted">
            {plural(confirm.data.skipped, "já estudada", "já estudadas")} e{" "}
            {plural(confirm.data.rejected, "recusada", "recusadas")} por estarem
            incompletas.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to={`/play?song=${song.id}`}
            className={buttonClasses("primary")}
          >
            Treinar esta música
          </Link>
          <Button variant="secondary" onClick={onBack}>
            Voltar às músicas
          </Button>
        </div>
      </>
    );

  return (
    <>
      <h1 className="text-3xl font-extrabold">Revisar: {song.title}</h1>
      <p className="mt-2 text-muted">
        Marque o que você quer estudar. Nada é salvo antes de você confirmar.
      </p>
      <ul className="mt-4 grid gap-3">
        {analysis.entries.map((e, i) => (
          <li key={i}>
            <Card>
              <label
                className={`flex gap-3 ${isNew(e) ? "cursor-pointer" : "opacity-70"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-accent"
                  checked={selected.has(i)}
                  disabled={!isNew(e)}
                  onChange={() => toggle(i)}
                />
                <span className="min-w-0">
                  <span className="block text-lg font-bold" lang="ru">
                    {e.text}{" "}
                    <span className="font-normal text-muted">
                      ({e.pronunciation_pt})
                    </span>
                  </span>
                  <span className="block">{e.meaning_pt}</span>
                  <span className="block text-sm text-muted">
                    {e.kind === "expression" ? "expressão" : "palavra"}
                    {e.part_of_speech && ` · ${e.part_of_speech}`}
                    {!isNew(e) && " · já estudada"}
                  </span>
                  {e.excerpt && (
                    <span
                      className="mt-1 block text-sm text-muted italic"
                      lang="ru"
                    >
                      «{e.excerpt}»
                    </span>
                  )}
                </span>
              </label>
            </Card>
          </li>
        ))}
      </ul>
      {analysis.grammar.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Pontos de gramática</h2>
          <ul className="mt-2 grid gap-3">
            {analysis.grammar.map((g, i) => (
              <li key={i}>
                <Card>
                  <p>{g.point_pt}</p>
                  {g.excerpt && (
                    <p className="mt-1 text-sm text-muted italic" lang="ru">
                      «{g.excerpt}»
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="sticky bottom-16 mt-6 grid gap-2 rounded-xl border border-line bg-paper p-3 md:bottom-0">
        <p aria-live="polite" className="font-semibold">
          {selected.size} de {analysis.entries.filter(isNew).length}{" "}
          selecionadas
        </p>
        <Button
          disabled={selected.size === 0 || confirm.isPending}
          onClick={() => confirm.mutate()}
        >
          {confirm.isPending ? "Salvando…" : "Salvar selecionadas"}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Descartar
        </Button>
      </div>
      {confirm.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={confirm.error}
            onRetry={() => confirm.mutate()}
          />
        </div>
      )}
    </>
  );
}

function Analysis({
  song,
  analyze,
  onBack,
}: {
  song: Song;
  analyze: UseMutationResult<SongAnalysis, Error, number>;
  onBack: () => void;
}) {
  if (analyze.isSuccess)
    return <Review song={song} analysis={analyze.data} onBack={onBack} />;

  return (
    <>
      <h1 className="text-3xl font-extrabold">Analisar: {song.title}</h1>
      {analyze.isError ? (
        <div className="mt-4 grid gap-3">
          <ErrorMessage
            error={analyze.error}
            onRetry={() => analyze.mutate(song.id)}
          />
          {analyze.error instanceof ApiError &&
            analyze.error.status === 503 && (
              <Link to="/settings" className={buttonClasses("secondary")}>
                Abrir Configurações
              </Link>
            )}
        </div>
      ) : (
        <div role="status" className="mt-4">
          <p className="font-semibold">
            A IA está lendo a letra. Isso leva de 10 a 20 segundos…
          </p>
          <div className="mt-3 grid gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-line motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      )}
      <Button variant="secondary" className="mt-4" onClick={onBack}>
        Voltar
      </Button>
    </>
  );
}

export function Songs() {
  const songs = useQuery({
    queryKey: ["songs"],
    queryFn: ({ signal }) => getSongs(signal),
    retry: false,
  });
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Song | null>(null);
  const analyze = useMutation({ mutationFn: analyzeSong, retry: false });

  if (target)
    return (
      <Analysis
        song={target}
        analyze={analyze}
        onBack={() => {
          analyze.reset();
          setTarget(null);
        }}
      />
    );

  return (
    <>
      <h1 className="text-3xl font-extrabold">Músicas</h1>
      <p className="mt-2 text-muted">
        Cole a letra de uma música em russo e a IA separa as palavras para você
        estudar.
      </p>
      {adding ? (
        <NewSongForm onDone={() => setAdding(false)} />
      ) : (
        <Button className="mt-4" onClick={() => setAdding(true)}>
          Adicionar música
        </Button>
      )}
      {songs.isError && (
        <div className="mt-6">
          <ErrorMessage error={songs.error} onRetry={() => songs.refetch()} />
        </div>
      )}
      {songs.isPending && (
        <p role="status" className="mt-6">
          Carregando…
        </p>
      )}
      {songs.data?.length === 0 && (
        <p className="mt-6 text-muted">Você ainda não adicionou músicas.</p>
      )}
      <ul className="mt-6 grid gap-3">
        {songs.data?.map((song) => (
          <li key={song.id}>
            <SongRow
              song={song}
              onAnalyze={(s) => {
                setTarget(s);
                analyze.mutate(s.id);
              }}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
