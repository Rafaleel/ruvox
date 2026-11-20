import { useQuery } from "@tanstack/react-query";
import { health } from "./api/client";

export function Home() {
  const result = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => health(signal),
    retry: false,
  });
  const connected = result.data?.status === "ok";
  return (
    <>
      <h1 className="text-6xl font-extrabold tracking-tighter">Ruvox</h1>
      <p className="mt-3 text-xl">Aprenda russo, do alfabeto às músicas.</p>
      <p
        role="status"
        className="mt-8 flex items-center gap-2.5 border-t border-line pt-4 text-muted"
      >
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${connected ? "bg-success" : "bg-muted"}`}
        />
        {result.isPending
          ? "Conectando ao serviço local…"
          : connected
            ? "Serviço local conectado"
            : "Serviço local indisponível"}
      </p>
    </>
  );
}
