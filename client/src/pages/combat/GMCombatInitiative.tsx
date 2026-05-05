import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';

import { CombatDiagram } from '../../components/combat/CombatDiagram';
import type { DiagramObject, DiagramRange } from '../../components/combat/CombatDiagram';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CombatRange {
  id: number;
  from_object_id: number;
  to_object_id: number;
  band: string;
}

interface CombatObject {
  id: number;
  object_type: string;
  name: string;
  is_player_ship: boolean;
  is_destroyed: boolean;
  initiative: number | null;
  move_intent: string | null;
  move_target_id: number | null;
  hull_current: number | null;
  hull_max: number | null;
  current_thrust: number | null;
  adjusted_max_thrust: number | null;
  missile_quantity: number | null;
  rounds_to_contact: number | null;
  pilot_skill_dm: number | null;
  naval_tactics_dm: number | null;
  leadership_effect: number;
}

interface CombatSession {
  id: number;
  game_id: number;
  name: string;
  current_phase: string;
  current_round: number;
  objects: CombatObject[];
  ranges: CombatRange[];
}

interface LocalRoll {
  d6roll: number;
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roll2d6(): number {
  return (
    Math.floor(Math.random() * 6) + 1 +
    Math.floor(Math.random() * 6) + 1
  );
}

function calcNpcInitiative(obj: CombatObject, d6roll: number): number {
  return (
    d6roll +
    (obj.pilot_skill_dm ?? 0) +
    (obj.current_thrust ?? 0) +
    (obj.naval_tactics_dm ?? 0) +
    (obj.leadership_effect ?? 0)
  );
}

function fmtDM(val: number | null | undefined): string {
  const n = val ?? 0;
  return n >= 0 ? `+${n}` : `${n}`;
}

function objectTag(obj: CombatObject): string {
  if (obj.is_player_ship) return 'Player Ship';
  if (obj.object_type === 'MISSILE_SALVO') return 'Missile';
  if (obj.object_type === 'PLANET') return 'Planet';
  if (obj.object_type === 'STATION') return 'Station';
  return 'NPC';
}

// ── Main component ────────────────────────────────────────────────────────────

export function GMCombatInitiative() {
  const navigate = useNavigate();
  const { notify } = useApp();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState<number | null>(null);

  // Local roll cache: objectId → { d6roll, total }
  const [localRolls, setLocalRolls] = useState<Record<number, LocalRoll>>({});
  const [rolling, setRolling] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadSession = useCallback(async (gId: number) => {
    const res = await apiFetch<CombatSession | null>(
      `/api/combat/session/active?game_id=${gId}`,
    );
    if (res.success && res.data) setSession(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      const gameRes = await apiFetch<{ id: number }>('/api/game');
      if (!gameRes.success || !gameRes.data) { setLoading(false); return; }
      setGameId(gameRes.data.id);
      await loadSession(gameRes.data.id);
      setLoading(false);
    })();
  }, [loadSession]);

  // Polling — keeps player initiative values live as players submit them
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    const poll = async () => {
      const res = await apiFetch<CombatSession | null>(
        `/api/combat/session/active?game_id=${gameId}`,
      );
      if (!cancelled && res.success && res.data) setSession(res.data);
    };
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [gameId]);

  // ── Roll helpers ───────────────────────────────────────────────────────────

  const rollOne = useCallback(async (obj: CombatObject) => {
    if (!session) return;
    const d6roll = roll2d6();
    const total = calcNpcInitiative(obj, d6roll);

    setLocalRolls((prev) => ({ ...prev, [obj.id]: { d6roll, total } }));
    await apiFetch(`/api/combat/object/${obj.id}/initiative`, {
      method: 'POST',
      body: JSON.stringify({ initiative: total }),
    });
    await loadSession(session.game_id);
  }, [session, loadSession]);

  const handleRollAll = async () => {
    if (!session) return;
    const npcShips = session.objects.filter(
      (o) => o.object_type === 'SHIP' && !o.is_player_ship,
    );
    setRolling(true);
    try {
      const rolls: Record<number, LocalRoll> = {};
      for (const obj of npcShips) {
        const d6roll = roll2d6();
        const total = calcNpcInitiative(obj, d6roll);
        rolls[obj.id] = { d6roll, total };
      }
      setLocalRolls((prev) => ({ ...prev, ...rolls }));

      await Promise.all(
        npcShips.map((obj) =>
          apiFetch(`/api/combat/object/${obj.id}/initiative`, {
            method: 'POST',
            body: JSON.stringify({ initiative: rolls[obj.id].total }),
          }),
        ),
      );
      await loadSession(session.game_id);
      notify('success', 'All NPC initiatives rolled.');
    } finally {
      setRolling(false);
    }
  };

  const handleProceed = async () => {
    if (!session) return;
    const res = await apiFetch(`/api/combat/session/${session.id}/phase`, {
      method: 'PATCH',
      body: JSON.stringify({ phase: 'MANOEUVRE' }),
    });
    if (res.success) {
      navigate('/combat/manoeuvre');
    } else {
      notify('error', 'Failed to advance phase.');
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Initiative</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const npcShips = session.objects.filter(
    (o) => o.object_type === 'SHIP' && !o.is_player_ship,
  );
  const missiles = session.objects.filter((o) => o.object_type === 'MISSILE_SALVO');
  const playerShip = session.objects.find((o) => o.is_player_ship) ?? null;

  const allShipsRolled = session.objects
    .filter((o) => o.object_type === 'SHIP')
    .every((o) => o.initiative != null);

  const initiativeOrder = [...session.objects]
    .filter((o) => o.initiative != null)
    .sort((a, b) => {
      const iDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
      if (iDiff !== 0) return iDiff;
      return (b.current_thrust ?? 0) - (a.current_thrust ?? 0);
    });

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
          <h1 className="text-2xl font-bold text-gray-100">Initiative</h1>
          <p className="text-gray-500 text-sm mt-1">
            {session.name} · Round {session.current_round}
          </p>
        </div>
      </div>

      {/* Combat Diagram */}
      {playerShip && (
        <div className="card space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Battlefield</h2>
          <CombatDiagram
            referenceObjectId={playerShip.id}
            objects={session.objects as DiagramObject[]}
            ranges={session.ranges as DiagramRange[]}
          />
        </div>
      )}

      {/* ── SECTION A: NPC Initiative Rolls ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Roll Initiative for NPC Ships
          </h2>
          {npcShips.length > 0 && (
            <button
              onClick={handleRollAll}
              disabled={rolling}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {rolling ? 'Rolling…' : 'Roll All'}
            </button>
          )}
        </div>

        {npcShips.length === 0 ? (
          <div className="card text-center py-6 text-gray-700 text-sm">
            No NPC ships in this session.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {npcShips.map((obj) => {
              const local = localRolls[obj.id];
              const sessionInit = obj.initiative;
              const hasRoll = local != null || sessionInit != null;
              const displayRoll = local?.d6roll ?? null;
              const displayTotal = local?.total ?? sessionInit ?? null;

              return (
                <div key={obj.id} className="card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-gray-100 font-semibold text-sm">{obj.name}</p>
                      <p className="text-gray-600 text-xs">NPC Ship</p>
                    </div>
                    {hasRoll ? (
                      <span className="px-2 py-1 rounded-lg bg-nexus-900/40 border border-nexus-700/50 text-nexus-300 font-mono text-sm font-bold">
                        {displayTotal}
                      </span>
                    ) : (
                      <button
                        onClick={() => rollOne(obj)}
                        disabled={rolling}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Roll Initiative
                      </button>
                    )}
                  </div>

                  {/* Formula rows */}
                  <div className="space-y-1 text-xs border-t border-gray-800 pt-2">
                    <FormulaRow label="2D6 Roll" value={displayRoll != null ? String(displayRoll) : '—'} highlight={displayRoll != null} />
                    <FormulaRow label="Pilot Skill DM" value={fmtDM(obj.pilot_skill_dm)} />
                    <FormulaRow label="Current Thrust" value={fmtDM(obj.current_thrust)} />
                    <FormulaRow label="Tactics DM" value={fmtDM(obj.naval_tactics_dm)} />
                    <FormulaRow label="Leadership Effect" value={fmtDM(obj.leadership_effect)} />
                    <div className="flex justify-between pt-1 border-t border-gray-800">
                      <span className="text-gray-400 font-semibold">Total Initiative</span>
                      <span className={`font-mono font-bold ${displayTotal != null ? 'text-nexus-300' : 'text-gray-700'}`}>
                        {displayTotal != null ? displayTotal : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Re-roll button after first roll */}
                  {hasRoll && (
                    <button
                      onClick={() => rollOne(obj)}
                      disabled={rolling}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Re-roll
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Missile salvos */}
        {missiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-wider">Missile Salvos</p>
            <div className="card space-y-2 py-3">
              {missiles.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-amber-400">{m.name}</span>
                  <span className="text-gray-600 text-xs font-mono">Initiative: 99 (automatic)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION B: Initiative Order ── */}
      {initiativeOrder.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Initiative Order
          </h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950">
                  {['#', 'Name', 'Initiative', 'Type'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {initiativeOrder.map((obj, i) => (
                  <tr key={obj.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 w-8">
                      #{i + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-medium ${obj.is_player_ship ? 'text-nexus-300' : 'text-gray-200'}`}>
                        {obj.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm font-bold text-gray-100">
                      {obj.initiative}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        obj.is_player_ship
                          ? 'bg-nexus-900/40 text-nexus-400'
                          : obj.object_type === 'MISSILE_SALVO'
                            ? 'bg-amber-900/40 text-amber-400'
                            : 'bg-gray-800 text-gray-500'
                      }`}>
                        {objectTag(obj)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION C: Proceed ── */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-300">Proceed to Manoeuvre Phase</p>
          {!allShipsRolled && (
            <p className="text-xs text-gray-600 mt-0.5">
              All ships must have an initiative value before proceeding.
            </p>
          )}
        </div>
        <button onClick={handleProceed} disabled={!allShipsRolled} className="btn-primary shrink-0">
          Proceed →
        </button>
      </div>
    </div>
  );
}

// ── Small sub-component ───────────────────────────────────────────────────────

function FormulaRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={`font-mono ${highlight ? 'text-gray-200' : 'text-gray-500'}`}>{value}</span>
    </div>
  );
}
