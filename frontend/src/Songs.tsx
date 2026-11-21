import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Library,
  Music2,
  Play,
  Plus,
  ScanText,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import { Badge } from "./components/Badge";
import { Button, buttonClasses } from "./components/Button";
import { Card } from "./components/Card";
import { ConfirmPanel } from "./components/ConfirmPanel";
import { cx } from "./components/cx";
import { ErrorMessage } from "./components/ErrorMessage";
import { Input, Textarea } from "./components/Field";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { Notice } from "./components/Notice";
import { PageHeader } from "./components/PageHeader";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Fill of the lyrics limit: it warms up near the limit and turns red above it. */
function LyricsMeter({ length }: { length: number }) {
  const share = Math.min(1, length / MAX_LYRICS_CHARS);
  const tone =
    length > MAX_LYRICS_CHARS
      ? "bg-danger"
      : share >= 0.9
        ? "bg-gold"
        : "bg-accent";
  return (
    <div
      aria-hidden="true"
      className="h-1.5 overflow-hidden rounded-full bg-sheet-2 shadow-[inset_0_0_0_1px_var(--hairline)]"
    >
      <div
        className={cx(
          "h-full origin-left rounded-full transition-transform duration-200 ease-out-soft",
          tone,
        )}
        style={{ transform: `scaleX(${share})` }}
      />
    </div>
  );
}

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
    <Card className="rise mt-6 rounded-hero p-5 md:p-8">
      <form onSubmit={submit} className="grid gap-5">
        <h2>Nova música</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Título"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            label="Artista (opcional)"
            value={artist}
            maxLength={200}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Textarea
            id="lyrics"
            label="Letra"
            lang="ru"
            rows={8}
            className="font-serif text-lg leading-relaxed"
            aria-describedby="lyrics-help lyrics-count lyrics-error"
            help="A letra fica só neste computador."
            error={
              tooLong
                ? "A letra passou do limite: apague um trecho para salvar."
                : undefined
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <LyricsMeter length={text.length} />
          <p
            id="lyrics-count"
            className={cx(
              "text-sm tabular-nums",
              tooLong ? "font-semibold text-danger" : "text-ink-3",
            )}
          >
            {text.length.toLocaleString("pt-BR")} /{" "}
            {MAX_LYRICS_CHARS.toLocaleString("pt-BR")} caracteres
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="lg"
            icon={Check}
            loading={create.isPending}
            disabled={!canSave}
          >
            {create.isPending ? "Salvando…" : "Salvar música"}
          </Button>
          <Button variant="secondary" size="lg" onClick={onDone}>
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
    <Card className="p-4 sm:p-5">
      <h2 className="text-h3 break-words">{song.title}</h2>
      {song.artist && <p className="text-ink-2">{song.artist}</p>}
      <Badge
        tone={song.items > 0 ? "gold" : "neutral"}
        icon={Library}
        className="mt-3"
      >
        {song.items > 0
          ? plural(song.items, "palavra salva", "palavras salvas")
          : "Nenhuma palavra salva ainda"}
      </Badge>
      <div className="mt-4 flex flex-wrap gap-2">
        {song.items > 0 && (
          <Link
            to={`/play?song=${song.id}`}
            className={buttonClasses("primary")}
          >
            <Icon icon={Play} fill="currentColor" />
            Treinar esta música
          </Link>
        )}
        <Button
          variant={song.items > 0 ? "secondary" : "primary"}
          icon={ScanText}
          onClick={() => onAnalyze(song)}
        >
          Analisar
        </Button>
        <Button
          variant="ghost"
          icon={Trash2}
          className="sm:ml-auto"
          onClick={() => setConfirming(true)}
        >
          Apagar
        </Button>
      </div>
      {confirming && (
        <ConfirmPanel
          title={`Apagar “${song.title}”?`}
          confirmLabel={remove.isPending ? "Apagando…" : "Apagar de vez"}
          busy={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            As palavras salvas dela e o seu progresso nessas palavras também
            serão apagados. Não dá para desfazer.
          </p>
        </ConfirmPanel>
      )}
      {remove.isError && (
        <div className="mt-3">
          <ErrorMessage error={remove.error} onRetry={() => remove.mutate()} />
        </div>
      )}
    </Card>
  );
}

function EntryCard({
  entry,
  checked,
  onToggle,
}: {
  entry: AnalyzedEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  const studied = !!entry.existing_item_id;
  return (
    <label
      className={cx(
        "flex gap-4 rounded-card p-4 shadow-card transition-[transform,box-shadow] duration-150 ease-out-soft",
        "has-checked:shadow-[0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
        studied ? "bg-sheet-2" : "cursor-pointer bg-sheet active:scale-[.99]",
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={studied}
        onChange={onToggle}
      />
      <span
        aria-hidden="true"
        className="mt-1 grid size-6 shrink-0 place-items-center rounded-md border border-rule bg-sheet text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-disabled:border-hairline peer-disabled:bg-transparent peer-disabled:text-ink-3"
      >
        <Icon icon={Check} size={16} strokeWidth={3} />
      </span>
      <span className="grid min-w-0 flex-1 gap-2">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            lang="ru"
            className="font-serif text-2xl leading-tight font-semibold break-words text-ink"
          >
            {entry.text}
          </span>
          <span className="rounded-control bg-sheet-2 px-2.5 py-0.5 text-sm font-medium text-ink-2">
            {entry.pronunciation_pt}
          </span>
          {studied && (
            <Badge tone="success" icon={CircleCheck}>
              já estudada
            </Badge>
          )}
        </span>
        <span className="text-ink">{entry.meaning_pt}</span>
        <span className="text-sm text-ink-3">
          {entry.kind === "expression" ? "expressão" : "palavra"}
          {entry.part_of_speech && ` · ${entry.part_of_speech}`}
        </span>
        {entry.excerpt && (
          <span
            lang="ru"
            className="border-l-2 border-gold pl-3 font-serif text-ink-2 italic"
          >
            «{entry.excerpt}»
          </span>
        )}
      </span>
    </label>
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
        <PageHeader eyebrow="Pronto" title={song.title} className="rise" />
        <Notice
          tone="success"
          className="rise mt-6"
          title={
            confirm.data.created === 1
              ? "1 palavra adicionada"
              : `${confirm.data.created} palavras adicionadas`
          }
        >
          {(confirm.data.skipped > 0 || confirm.data.rejected > 0) && (
            <p className="text-ink-2">
              {plural(confirm.data.skipped, "já estudada", "já estudadas")} e{" "}
              {plural(confirm.data.rejected, "recusada", "recusadas")} por
              estarem incompletas.
            </p>
          )}
        </Notice>
        <div
          className="rise mt-8 flex flex-col gap-3 sm:flex-row"
          style={stagger(1)}
        >
          <Link
            to={`/play?song=${song.id}`}
            className={buttonClasses("primary", "lg")}
          >
            <Icon icon={Play} fill="currentColor" />
            Treinar esta música
          </Link>
          <Button variant="secondary" size="lg" icon={Music2} onClick={onBack}>
            Voltar às músicas
          </Button>
        </div>
      </>
    );

  const newCount = analysis.entries.filter(isNew).length;
  return (
    <>
      <PageHeader
        eyebrow="Revisar"
        title={song.title}
        description="Marque o que você quer estudar. Nada é salvo antes de você confirmar."
        className="rise"
      />
      <ul className="mt-6 grid gap-3">
        {analysis.entries.map((e, i) => (
          <li key={i} className="rise" style={stagger(Math.min(i, 6))}>
            <EntryCard
              entry={e}
              checked={selected.has(i)}
              onToggle={() => toggle(i)}
            />
          </li>
        ))}
      </ul>
      {analysis.grammar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4">Pontos de gramática</h2>
          <ul className="grid gap-3">
            {analysis.grammar.map((g, i) => (
              <li key={i}>
                <Notice tone="info">
                  <p>{g.point_pt}</p>
                  {g.excerpt && (
                    <p
                      className="mt-1.5 border-l-2 border-gold pl-3 font-serif text-ink-2 italic"
                      lang="ru"
                    >
                      «{g.excerpt}»
                    </p>
                  )}
                </Notice>
              </li>
            ))}
          </ul>
        </section>
      )}
      {confirm.isError && (
        <div className="mt-6">
          <ErrorMessage
            error={confirm.error}
            onRetry={() => confirm.mutate()}
          />
        </div>
      )}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[5] mt-6 grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-card bg-sheet p-3 shadow-card sm:grid-cols-[1fr_auto_auto] sm:pl-4 md:bottom-4">
        <p aria-live="polite" className="font-semibold">
          {selected.size} de {newCount} selecionadas
        </p>
        <Button variant="ghost" className="justify-self-end" onClick={onBack}>
          Descartar
        </Button>
        <Button
          className="col-span-2 sm:col-span-1"
          icon={Check}
          loading={confirm.isPending}
          disabled={selected.size === 0}
          onClick={() => confirm.mutate()}
        >
          {confirm.isPending
            ? "Salvando…"
            : `Salvar selecionadas (${selected.size})`}
        </Button>
      </div>
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
      <PageHeader eyebrow="Analisar" title={song.title} className="rise" />
      {analyze.isError ? (
        <div className="mt-6 grid gap-3">
          <ErrorMessage
            error={analyze.error}
            onRetry={() => analyze.mutate(song.id)}
          />
          {analyze.error instanceof ApiError &&
            analyze.error.status === 503 && (
              <Link
                to="/settings"
                className={cx(buttonClasses("secondary"), "w-fit")}
              >
                <Icon icon={Settings} />
                Abrir Configurações
              </Link>
            )}
        </div>
      ) : (
        <div role="status" className="mt-6">
          <Card className="flex items-start gap-4 rounded-hero p-5">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-control bg-gold-soft text-gold-ink"
            >
              <Icon icon={Sparkles} size={24} />
            </span>
            <div>
              <p className="font-semibold">A IA está lendo a letra</p>
              <p className="text-ink-2">
                Isso usa a IA e pode levar uns segundos. Pode esperar aqui.
              </p>
            </div>
          </Card>
          <div className="mt-4 grid gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex animate-pulse gap-4 rounded-card bg-sheet p-4 shadow-card motion-reduce:animate-none"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="mt-1 size-6 rounded-md bg-sheet-2" />
                <div className="grid flex-1 gap-2.5">
                  <div className="h-6 w-1/2 rounded-control bg-sheet-2" />
                  <div className="h-4 w-4/5 rounded-control bg-sheet-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Button
        variant="secondary"
        icon={ArrowLeft}
        className="mt-6"
        onClick={onBack}
      >
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

  const empty = songs.data?.length === 0;
  const addButton = (
    <Button icon={Plus} onClick={() => setAdding(true)}>
      Adicionar música
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Músicas"
        description="As letras que você cola aqui viram palavras para estudar."
        action={!adding && !empty ? addButton : undefined}
        className="rise"
      />
      {adding && <NewSongForm onDone={() => setAdding(false)} />}
      {songs.isError && (
        <div className="mt-6">
          <ErrorMessage error={songs.error} onRetry={() => songs.refetch()} />
        </div>
      )}
      {songs.isPending && (
        <div role="status" className="mt-6 grid gap-3">
          <span className="sr-only">Carregando…</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="animate-pulse rounded-card bg-sheet p-5 shadow-card motion-reduce:animate-none"
            >
              <div className="h-6 w-2/5 rounded-control bg-sheet-2" />
              <div className="mt-2 h-4 w-1/4 rounded-control bg-sheet-2" />
              <div className="mt-5 h-11 w-40 rounded-control bg-sheet-2" />
            </div>
          ))}
        </div>
      )}
      {empty && !adding && (
        <section
          className="rise mt-8 flex flex-col items-center rounded-hero bg-sheet px-6 py-12 text-center shadow-card"
          style={stagger(1)}
        >
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-hero bg-sheet-2 text-ink-2"
          >
            <Icon icon={Music2} size={32} />
          </span>
          <p className="mt-5 font-serif text-h3 font-semibold">
            Você ainda não adicionou músicas.
          </p>
          <p className="mt-2 max-w-sm text-ink-2">
            Cole a letra de uma música em russo e a IA separa as palavras para
            você estudar. A letra fica só neste computador.
          </p>
          <div className="mt-6">{addButton}</div>
        </section>
      )}
      <ul className="mt-6 grid gap-3">
        {songs.data?.map((song, i) => (
          <li key={song.id} className="rise" style={stagger(Math.min(i, 6))}>
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
