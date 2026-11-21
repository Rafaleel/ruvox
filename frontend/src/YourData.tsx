import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { exportBackup, importBackup, resetData } from "./api/client";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ConfirmPanel } from "./components/ConfirmPanel";
import { friendlyError } from "./components/ErrorMessage";
import { Notice } from "./components/Notice";
import { Section } from "./components/Section";

const COUNT_LABELS: [string, string][] = [
  ["songs", "músicas"],
  ["items", "itens"],
  ["sessions", "sessões"],
  ["attempts", "respostas"],
];

function download(data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "ruvox-backup.json";
  document.body.append(link);
  link.click();
  link.remove();
  // WebKit cancels the download if the URL is revoked right away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function YourData() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(undefined);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const [readError, setReadError] = useState("");

  // Imported or erased data changes every screen: drop cached answers.
  const refreshAll = () => queryClient.invalidateQueries();

  const exporting = useMutation({
    mutationFn: exportBackup,
    onSuccess: (data) => {
      download(data);
      setNotice("Backup exportado.");
    },
  });
  const importing = useMutation({
    mutationFn: importBackup,
    onSuccess: (counts) => {
      setPending(undefined);
      setNotice(
        "Backup importado: " +
          COUNT_LABELS.map(
            ([key, label]) => `${counts[key] ?? 0} ${label}`,
          ).join(", ") +
          ".",
      );
      refreshAll();
    },
    onError: () => setPending(undefined),
  });
  const resetting = useMutation({
    mutationFn: resetData,
    onSuccess: () => {
      setConfirmReset(false);
      setNotice("Progresso apagado.");
      refreshAll();
    },
  });

  const startOver = () => {
    setNotice("");
    setReadError("");
    exporting.reset();
    importing.reset();
    resetting.reset();
  };

  const pickFile = async (file: File | undefined) => {
    startOver();
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (typeof data !== "object" || data === null || Array.isArray(data))
        throw new Error("not an object");
      setPending(data);
    } catch {
      setReadError("O arquivo não é um backup válido (JSON).");
    }
    // Lets the same file be chosen again after a cancel.
    if (fileInput.current) fileInput.current.value = "";
  };

  const error = exporting.error ?? importing.error ?? resetting.error;

  return (
    <Section
      title="Seus dados"
      description="O backup guarda seu progresso, suas sessões e suas músicas. A chave da API não entra no arquivo."
    >
      <Card className="grid gap-5">
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="secondary"
            icon={Download}
            loading={exporting.isPending}
            onClick={() => {
              startOver();
              exporting.mutate();
            }}
          >
            {exporting.isPending ? "Exportando…" : "Exportar backup"}
          </Button>
          <Button
            variant="secondary"
            icon={Upload}
            disabled={importing.isPending}
            onClick={() => fileInput.current?.click()}
          >
            Importar backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Arquivo de backup"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {pending !== undefined && (
          <ConfirmPanel
            title="Importar este backup?"
            confirmLabel="Substituir meus dados"
            busy={importing.isPending}
            onConfirm={() => importing.mutate(pending)}
            onCancel={() => setPending(undefined)}
          >
            <p>
              Isto SUBSTITUI todo o seu progresso e todas as suas músicas pelos
              do arquivo. As configurações e a chave da API não mudam.
            </p>
          </ConfirmPanel>
        )}

        <div aria-live="polite" className="grid gap-3 empty:hidden">
          {notice && <Notice tone="success">{notice}</Notice>}
        </div>
        {(error || readError) && (
          <Notice tone="danger">{readError || friendlyError(error)}</Notice>
        )}

        <div className="grid gap-3 border-t border-hairline pt-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h3 className="text-base font-semibold">Começar do zero</h3>
            <p className="text-sm text-ink-2">
              Apaga progresso, sessões e músicas. As configurações e a chave da
              API ficam.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={Trash2}
            className="sm:shrink-0"
            loading={resetting.isPending}
            onClick={() => {
              startOver();
              setConfirmReset(true);
            }}
          >
            Apagar meu progresso
          </Button>
        </div>
        {confirmReset && (
          <ConfirmPanel
            title="Apagar seu progresso?"
            confirmLabel="Apagar tudo"
            busy={resetting.isPending}
            onConfirm={() => resetting.mutate()}
            onCancel={() => setConfirmReset(false)}
          >
            <p>
              Isto apaga seu progresso, suas sessões e suas músicas, e não dá
              para desfazer. As configurações e a chave da API continuam como
              estão.
            </p>
          </ConfirmPanel>
        )}
      </Card>
    </Section>
  );
}
