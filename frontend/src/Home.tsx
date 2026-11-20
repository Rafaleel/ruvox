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
    <main className="home">
      <div className="book" aria-hidden="true">
        <i />
        <i />
      </div>
      <h1>Ruvox</h1>
      <p className="tagline">Aprenda russo, do alfabeto às músicas.</p>
      <p className="status" role="status" data-connected={connected}>
        {result.isPending
          ? "Conectando ao serviço local…"
          : connected
            ? "Serviço local conectado"
            : "Serviço local indisponível"}
      </p>
    </main>
  );
}
