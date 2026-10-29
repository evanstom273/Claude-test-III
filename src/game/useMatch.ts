import { useCallback, useEffect, useState } from "react";
import { TICK_MS } from "./config";
import { withSkill } from "./dice";
import { resolve, resolveLive, startMatch, tick, type LiveOutcome } from "./match";
import type { Action, Side, Team } from "./types";

export function useMatch(sides: Record<Team, Side>) {
  const [state, setState] = useState(() => startMatch(sides));

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setState((s) => tick(s)), TICK_MS);
    return () => clearInterval(id);
  }, [state.running]);

  const play = useCallback(() => setState((s) => (s.finished || s.situation ? s : { ...s, running: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, running: false })), []);
  /** With a skill result, the user's next roll comes from their timing instead of the dice. */
  const act = useCallback(
    (action: Action, skill?: number) =>
      setState((s) => (skill === undefined ? resolve(s, action) : withSkill(skill, () => resolve(s, action)))),
    [],
  );
  const finishLive = useCallback((outcome: LiveOutcome) => setState((s) => resolveLive(s, outcome)), []);

  return { state, play, pause, act, finishLive };
}
