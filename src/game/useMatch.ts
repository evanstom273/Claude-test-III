import { useCallback, useEffect, useState } from "react";
import { TICK_MS } from "./config";
import { resolve, startMatch, tick } from "./match";
import type { Action, Player } from "./types";

export function useMatch(player: Player) {
  const [state, setState] = useState(() => startMatch(player));

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setState((s) => tick(s)), TICK_MS);
    return () => clearInterval(id);
  }, [state.running]);

  const play = useCallback(() => setState((s) => (s.finished || s.situation ? s : { ...s, running: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, running: false })), []);
  const act = useCallback((action: Action) => setState((s) => resolve(s, action)), []);

  return { state, play, pause, act };
}
