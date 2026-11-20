import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Route, Routes } from "react-router";
import { getLanStatus, setUnauthorizedHandler } from "./api/client";
import { Alphabet } from "./Alphabet";
import { Home } from "./Home";
import { Layout } from "./Layout";
import { Pairing } from "./Pairing";
import { Play } from "./Play";
import { Progress } from "./Progress";
import { Settings } from "./Settings";
import { Songs } from "./Songs";

export function App() {
  const queryClient = useQueryClient();
  // A failed status request is treated as "no pairing needed" so the app
  // shows its own connection errors instead of a gate nobody can pass.
  const lan = useQuery({
    queryKey: ["lan-status"],
    queryFn: ({ signal }) => getLanStatus(signal),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  // Any 401 means the pairing is gone: ask again and show the gate.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void queryClient.invalidateQueries({ queryKey: ["lan-status"] });
    });
    return () => setUnauthorizedHandler();
  }, [queryClient]);

  if (lan.isPending) return <p role="status">Carregando…</p>;
  if (lan.data?.required && !lan.data.paired) return <Pairing />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play />} />
        <Route path="progress" element={<Progress />} />
        <Route path="songs" element={<Songs />} />
        <Route path="alphabet" element={<Alphabet />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
