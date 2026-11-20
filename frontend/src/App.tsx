import { Route, Routes } from "react-router";
import { Alphabet } from "./Alphabet";
import { Home } from "./Home";
import { Layout } from "./Layout";
import { Play } from "./Play";
import { Settings } from "./Settings";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play />} />
        <Route path="alphabet" element={<Alphabet />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
