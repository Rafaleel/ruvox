import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ApiError, exportBackup, importBackup, resetData } from "./api/client";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ConfirmPanel } from "./components/ConfirmPanel";

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
  URL.revokeObjectURL(url);
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
      setPending(JSON.parse(await file.text()));
    } catch {
      setReadError("O arquivo não é um backup válido (JSON).");
    }
    // Lets the same file be chosen again after a cancel.
    if (fileInput.current) fileInput.current.value = "";
  };

  const error = exporting.error ?? importing.error ?? resetting.error;

  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold">Seus dados</h2>
      <p className="mt-2 text-muted">
        O backup guarda seu progresso, suas sessões e suas músicas. A chave da
        API não entra no arquivo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={exporting.isPending}
          onClick={() => {
            startOver();
            exporting.mutate();
          }}
        >
          {exporting.isPending ? "Exportando…" : "Exportar backup"}
        </Button>
        <Button
          variant="secondary"
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
        <Button
          variant="secondary"
          disabled={resetting.isPending}
          onClick={() => {
            startOver();
            setConfirmReset(true);
          }}
        >
          Apagar meu progresso
        </Button>
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
            Isto SUBSTITUI todo o seu progresso e todas as suas músicas pelos do
            arquivo. As configurações e a chave da API não mudam.
          </p>
        </ConfirmPanel>
      )}
      {confirmReset && (
        <ConfirmPanel
          title="Apagar seu progresso?"
          confirmLabel="Apagar tudo"
          busy={resetting.isPending}
          onConfirm={() => resetting.mutate()}
          onCancel={() => setConfirmReset(false)}
        >
          <p>
            Isto apaga seu progresso, suas sessões e suas músicas, e não dá para
            desfazer. As configurações e a chave da API continuam como estão.
          </p>
        </ConfirmPanel>
      )}

      <div aria-live="polite" className="mt-3">
        {notice && <p className="text-success">{notice}</p>}
      </div>
      {(error || readError) && (
        <p role="alert" className="mt-3 text-danger">
          {readError ||
            (error instanceof ApiError
              ? error.message
              : "Algo deu errado. Tente de novo.")}
        </p>
      )}
    </Card>
  );
}
