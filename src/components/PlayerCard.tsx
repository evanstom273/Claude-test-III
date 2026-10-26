import { POSITIONS, ROLES, STATS, STAT_LABELS } from "../game/config";
import type { PositionCode, RoleId, Stats } from "../game/types";
import Stars from "./Stars";

export default function PlayerCard({ position, role, stats }: { position: PositionCode; role: RoleId; stats: Stats }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{POSITIONS[position].label}</div>
      <div className="text-lg font-semibold">{ROLES[role].label}</div>
      <p className="text-sm text-slate-400">{ROLES[role].description}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_auto_auto_1fr_auto_auto]">
        {STATS.map((stat) => (
          <div key={stat} className="contents">
            <dt className="text-slate-300">{STAT_LABELS[stat]}</dt>
            <dd>
              <Stars value={stats[stat]} />
            </dd>
            <dd className="text-right tabular-nums text-slate-400">{stats[stat]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
