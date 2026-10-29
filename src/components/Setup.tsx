import { useState } from "react";
import { FORMATIONS, POSITIONS, ROLES, STYLES } from "../game/config";
import { generateSide, generateStats, namePool } from "../game/squad";
import type { FormationId, RoleId, Side, StyleId, Team } from "../game/types";
import PlayerCard from "./PlayerCard";

const pill = (on: boolean) =>
  `rounded-lg border px-3 py-2 text-sm font-medium transition ${
    on ? "border-emerald-500 bg-emerald-600/20 text-emerald-200" : "border-slate-700 bg-slate-900 hover:border-slate-500"
  }`;

function randomOf<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default function Setup({ onStart, onBack }: { onStart: (sides: Record<Team, Side>) => void; onBack: () => void }) {
  const [formation, setFormation] = useState<FormationId>("4-3-3");
  const [style, setStyle] = useState<StyleId>("balanced");
  const [slot, setSlot] = useState(10);
  const [role, setRole] = useState<RoleId>(POSITIONS[FORMATIONS["4-3-3"][10]].roles[0]);
  const [stats, setStats] = useState(() => generateStats(FORMATIONS["4-3-3"][10], role, Math.random));

  const position = FORMATIONS[formation][slot];

  function choose(nextFormation: FormationId, nextSlot: number, nextRole?: RoleId) {
    const pos = FORMATIONS[nextFormation][nextSlot];
    const r = nextRole && POSITIONS[pos].roles.includes(nextRole) ? nextRole : POSITIONS[pos].roles[0];
    setFormation(nextFormation);
    setSlot(nextSlot);
    setRole(r);
    setStats(generateStats(pos, r, Math.random));
  }

  function kickOff() {
    const names = namePool(Math.random);
    const us = generateSide("Your side", "us", formation, style, names, Math.random, { slot, role, stats });
    const them = generateSide(
      "The opposition",
      "them",
      randomOf(Object.keys(FORMATIONS) as FormationId[]),
      randomOf(Object.keys(STYLES) as StyleId[]),
      names,
      Math.random,
    );
    onStart({ us, them });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="mb-2 text-sm text-slate-400 hover:text-slate-200">
          ← Back
        </button>
        <h1 className="text-3xl font-bold">Set up</h1>
        <p className="mt-1 text-slate-400">Pick your team's shape and style, then who you are in it.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Formation</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FORMATIONS) as FormationId[]).map((f) => (
            <button
              key={f}
              className={pill(f === formation)}
              onClick={() => {
                const keep = FORMATIONS[f].indexOf(position);
                choose(f, keep >= 0 ? keep : FORMATIONS[f].length - 1, role);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Style</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STYLES) as StyleId[]).map((s) => (
            <button key={s} className={pill(s === style)} onClick={() => setStyle(s)}>
              {STYLES[s].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-400">{STYLES[style].description}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Your position</h2>
        <div className="flex flex-wrap gap-2">
          {FORMATIONS[formation].map((pos, i) => (
            <button key={i} className={pill(i === slot)} onClick={() => choose(formation, i, role)} title={POSITIONS[pos].label}>
              {pos}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Your role</h2>
        <div className="flex flex-wrap gap-2">
          {POSITIONS[position].roles.map((r) => (
            <button key={r} className={pill(r === role)} onClick={() => choose(formation, slot, r)}>
              {ROLES[r].label}
            </button>
          ))}
        </div>
      </section>

      <PlayerCard position={position} role={role} stats={stats} />

      <div className="flex flex-wrap gap-2">
        <button onClick={kickOff} className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold hover:bg-emerald-500">
          Kick off
        </button>
        <button
          onClick={() => setStats(generateStats(position, role, Math.random))}
          className="rounded-lg border border-slate-600 px-4 py-2.5 hover:bg-slate-800"
        >
          Reroll player
        </button>
      </div>
      <p className="text-xs text-slate-500">The opposition get a random formation and style.</p>
    </div>
  );
}
