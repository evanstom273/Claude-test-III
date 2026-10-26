import { POSITIONS, ROLES, STATS, STAT_LABELS, STYLES } from "../game/config";
import type { Footballer, Side } from "../game/types";
import Stars from "./Stars";

export default function Lineups({ sides }: { sides: Side[] }) {
  return (
    <details className="rounded-xl bg-slate-900 p-4">
      <summary className="cursor-pointer font-semibold">Team sheets</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {sides.map((side) => (
          <div key={side.name}>
            <div className="font-semibold">{side.name}</div>
            <div className="mb-2 text-sm text-slate-400">
              {side.formation} · {STYLES[side.style].label}
            </div>
            <ul className="flex flex-col gap-1">
              {side.players.map((p) => (
                <PlayerRow key={p.id} p={p} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function PlayerRow({ p }: { p: Footballer }) {
  return (
    <li>
      <details>
        <summary className={`cursor-pointer text-sm ${p.isUser ? "font-semibold text-sky-300" : ""}`}>
          <span className="inline-block w-10 text-slate-500">{p.position}</span>
          {p.name} <span className="text-slate-500">· {ROLES[p.role].label}</span>
        </summary>
        <dl className="mb-2 ml-10 mt-1 grid grid-cols-[auto_auto] gap-x-3 text-xs" title={POSITIONS[p.position].label}>
          {STATS.map((s) => (
            <div key={s} className="contents">
              <dt className="text-slate-400">{STAT_LABELS[s]}</dt>
              <dd>
                <Stars value={p.stats[s]} />
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}
