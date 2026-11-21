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
import { DomeSkyline } from "./components/art/DomeSkyline";
import { GhostLetter } from "./components/art/GhostLetter";
import { StampFrame } from "./components/art/StampFrame";
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
    <Card className="rise margin-rule rounded-hero p-5 pl-9 @[52rem]:p-7 @[52rem]:pl-11">
      <form onSubmit={submit} className="grid gap-5">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent">
            Novo caderno
          </p>
          <h2>Nova música</h2>
        </div>
        <div className="grid gap-5 @[28rem]:grid-cols-2">
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
            rows={9}
            className="font-serif text-lg leading-relaxed min-h-[12rem]"
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

  const initial = song.title.trim().charAt(0).toUpperCase() || "♪";
  return (
    <Card className="@container relative overflow-hidden p-0">
      <div className="flex gap-4 p-4 @[28rem]:p-5">
        <span
          aria-hidden="true"
          lang="ru"
          className="grid size-14 shrink-0 place-items-center rounded-[0.9rem] bg-(image:--foil) font-serif text-3xl leading-none font-semibold text-gold-ink shadow-[inset_0_0_0_1px_var(--gold)]"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 leading-tight break-words">{song.title}</h2>
          {song.artist && <p className="mt-0.5 text-ink-2">{song.artist}</p>}
          <Badge
            tone={song.items > 0 ? "gold" : "neutral"}
            icon={Library}
            className="mt-3"
          >
            {song.items > 0
              ? plural(song.items, "palavra salva", "palavras salvas")
              : "Nenhuma palavra salva ainda"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-sheet-2/50 px-4 py-3 @[28rem]:px-5">
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
          className="ml-auto size-11 px-0 hover:bg-danger-soft hover:text-danger"
          aria-label="Apagar"
          title="Apagar música"
          onClick={() => setConfirming(true)}
        />
      </div>
      {confirming && (
        <div className="p-4 pt-0 @[28rem]:px-5">
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
        </div>
      )}
      {remove.isError && (
        <div className="p-4 pt-0">
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
        "relative flex h-full gap-4 overflow-hidden rounded-card p-4 shadow-card transition-[transform,box-shadow,background-color] duration-150 ease-out-soft @[28rem]:p-5",
        "has-checked:bg-accent-soft/40 has-checked:shadow-[0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
        studied
          ? "bg-sheet-2"
          : "cursor-pointer bg-sheet hover:-translate-y-0.5 active:scale-[.99]",
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
        className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full border border-rule bg-sheet text-transparent transition-[background-color,border-color,transform] duration-150 peer-checked:scale-110 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-disabled:border-hairline peer-disabled:bg-transparent peer-disabled:text-ink-3"
      >
        <Icon icon={Check} size={14} strokeWidth={3} />
      </span>
      <span className="grid min-w-0 flex-1 content-start gap-2">
        <span
          lang="ru"
          className="font-serif text-[2rem] leading-none font-semibold tracking-tight break-words text-ink"
        >
          {entry.text}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sheet-2 px-3 py-0.5 text-sm font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--hairline)]">
            {entry.pronunciation_pt}
          </span>
          {studied && (
            <Badge tone="success" icon={CircleCheck}>
              já estudada
            </Badge>
          )}
        </span>
        <span className="text-lg leading-snug text-ink">
          {entry.meaning_pt}
        </span>
        <span className="text-sm text-ink-3">
          {entry.kind === "expression" ? "expressão" : "palavra"}
          {entry.part_of_speech && ` · ${entry.part_of_speech}`}
        </span>
        {entry.excerpt && (
          <span
            lang="ru"
            className="mt-1 border-l-2 border-gold pl-3 font-serif text-ink-2 italic"
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
      <div
        className={cx(
          "mt-6 grid gap-8",
          analysis.grammar.length > 0 &&
            "@[64rem]:grid-cols-[minmax(0,1fr)_20rem] @[64rem]:items-start",
        )}
      >
        <ul className="grid content-start gap-3 @[44rem]:grid-cols-2">
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
          <section className="@[64rem]:sticky @[64rem]:top-4">
            <h2 className="mb-4 text-h3">Pontos de gramática</h2>
            <ul className="grid gap-3">
              {analysis.grammar.map((g, i) => (
                <li key={i}>
                  <Notice tone="info">
                    <p className="font-medium">{g.point_pt}</p>
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
      </div>
      {confirm.isError && (
        <div className="mt-6">
          <ErrorMessage
            error={confirm.error}
            onRetry={() => confirm.mutate()}
          />
        </div>
      )}
      <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[5] mt-6 grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-card bg-sheet/90 p-3 shadow-float backdrop-blur sm:grid-cols-[1fr_auto_auto] sm:pl-5">
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
      <div
        className={cx(
          "mt-6 grid gap-6 @[52rem]:mt-8",
          adding &&
            "@[52rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @[52rem]:items-start @[52rem]:gap-8",
        )}
      >
        <div className="grid min-w-0 content-start gap-4">
          {songs.isError && (
            <ErrorMessage error={songs.error} onRetry={() => songs.refetch()} />
          )}
          {songs.isPending && (
            <div role="status" className="grid gap-3">
              <span className="sr-only">Carregando…</span>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="animate-pulse rounded-card bg-sheet p-5 shadow-card motion-reduce:animate-none"
                >
                  <div className="flex gap-4">
                    <div className="size-14 rounded-[0.9rem] bg-sheet-2" />
                    <div className="grid flex-1 content-start gap-2">
                      <div className="h-6 w-2/5 rounded-control bg-sheet-2" />
                      <div className="h-4 w-1/4 rounded-control bg-sheet-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {empty && !adding && (
            <section
              className="rise @container relative overflow-hidden rounded-sheet bg-sheet text-center shadow-card"
              style={stagger(1)}
            >
              <div
                aria-hidden="true"
                className="bg-linear-to-b from-sheet-2 to-sheet pt-6"
              >
                <DomeSkyline className="mx-auto block max-h-[7rem] w-full" />
              </div>
              <div className="relative px-6 pt-4 pb-10">
                <div aria-hidden="true" className="ruled absolute inset-0" />
                <GhostLetter
                  letter="Ж"
                  className="-right-[8%] -bottom-[18%] w-[46%]"
                />
                <StampFrame className="stamp-in relative mx-auto grid size-16 place-items-center">
                  <Icon icon={Music2} size={28} />
                </StampFrame>
                <p className="relative mt-5 font-serif text-h2 font-semibold text-balance">
                  Você ainda não adicionou músicas.
                </p>
                <p className="relative mx-auto mt-2 max-w-sm text-ink-2">
                  Cole a letra de uma música em russo e a IA separa as palavras
                  para você estudar. A letra fica só neste computador.
                </p>
                <div className="relative mt-6">{addButton}</div>
              </div>
            </section>
          )}
          <ul className={cx("grid gap-4", !adding && "@[52rem]:grid-cols-2")}>
            {songs.data?.map((song, i) => (
              <li
                key={song.id}
                className="rise"
                style={stagger(Math.min(i, 6))}
              >
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
        </div>
        {adding && (
          <div className="@[52rem]:sticky @[52rem]:top-4">
            <NewSongForm onDone={() => setAdding(false)} />
          </div>
        )}
      </div>
    </>
  );
}
