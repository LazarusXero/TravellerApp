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
  thrust_points: number;
}

interface CombatObject {
  id: number;
  object_type: string;
  name: string;
  is_player_ship: boolean;
  is_destroyed: boolean;
  initiative: number | null;
  hull_current: number | null;
  hull_max: number | null;
  current_thrust: number | null;
  adjusted_max_thrust: number | null;
  thrust_spent: number;
  move_intent: string | null;
  move_target_id: number | null;
  leadership_effect: number;
  missile_quantity: number | null;
  rounds_to_contact: number | null;
  fuel_current: number | null;
  fuel_max: number | null;
  fuel_leak_rate: number;
  life_support_status: string | null;
  life_support_timer: number | null;
  increase_thrust_next: boolean;
  increase_power_next: boolean;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function hullColour(current: number | null, max: number | null): string {
  if (current == null || max == null || max === 0) return 'text-gray-500';
  const pct = current / max;
  if (pct <= 0) return 'text-red-500';
  if (pct <= 0.3) return 'text-red-400';
  if (pct <= 0.6) return 'text-amber-400';
  return 'text-emerald-400';
}

function intentLabel(intent: string | null): string {
  if (intent === 'CLOSE') return 'Closing';
  if (intent === 'FLEE') return 'Fleeing';
  if (intent === 'HOLD') return 'Holding';
  return '—';
}

// ── Main component ────────────────────────────────────────────────────────────

export function GMCombatResolution() {
  const navigate = useNavigate();
  const { notify } = useApp();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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
      await loadSession(gameRes.data.id);
      setLoading(false);
    })();
  }, [loadSession]);

  // ── Run cleanup ────────────────────────────────────────────────────────────

  const handleEndRound = async () => {
    if (!session) return;
    setRunning(true);
    try {
      const res = await apiFetch(`/api/combat/session/${session.id}/cleanup`, {
        method: 'PATCH',
      });
      if (res.success) {
        // Clear any round-scoped localStorage keys
        localStorage.removeItem(`combat_evasive_${session.id}`);
        localStorage.removeItem(`combat_aid_gunner_${session.id}`);
        notify('success', `Round ${session.current_round} complete. Starting Round ${session.current_round + 1}.`);
        navigate('/combat/initiative');
      } else {
        notify('error', 'Failed to run end-of-round cleanup.');
      }
    } finally {
      setRunning(false);
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Resolution</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const ships = session.objects.filter((o) => o.object_type === 'SHIP');
  const missiles = session.objects.filter((o) => o.object_type === 'MISSILE_SALVO');
  const playerShip = ships.find((o) => o.is_player_ship) ?? null;

  // Ships with leadership effect set by the Captain this round
  const shipsWithLeadership = ships.filter((o) => o.leadership_effect !== 0);

  // Ships with overload effects pending
  const shipsWithOverload = session.objects.filter(
    (o) => o.increase_thrust_next || o.increase_power_next,
  );

  // Ships with fuel leaks
  const shipsWithFuelLeak = ships.filter((o) => o.fuel_leak_rate > 0);

  // Ships with life support issues
  const shipsWithLifeSupport = ships.filter(
    (o) => o.life_support_status === 'Failing' || o.life_support_status === 'Failed',
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">End of Round</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round} complete
        </p>
      </div>

      {/* Combat Diagram */}
      {playerShip && (
        <div className="card space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Current Positions
          </h2>
          <CombatDiagram
            referenceObjectId={playerShip.id}
            objects={session.objects as DiagramObject[]}
            ranges={session.ranges as DiagramRange[]}
          />
        </div>
      )}

      {/* ── SECTION A: Ship Status Summary ── */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Ship Status — End of Round {session.current_round}
        </h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950">
                {['Ship', 'Hull', 'Initiative', 'Movement', 'Thrust Used'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {ships.map((obj) => (
                <tr
                  key={obj.id}
                  className={`hover:bg-gray-800/30 transition-colors ${obj.is_destroyed ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${obj.is_player_ship ? 'text-nexus-300' : 'text-gray-200'}`}>
                        {obj.name}
                      </span>
                      {obj.is_destroyed && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">
                          Destroyed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <span className={hullColour(obj.hull_current, obj.hull_max)}>
                      {obj.hull_current ?? '—'}/{obj.hull_max ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-gray-300">
                    {obj.initiative ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {intentLabel(obj.move_intent)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                    {obj.thrust_spent > 0 ? obj.thrust_spent : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION B: Missile Salvos ── */}
      {missiles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Missile Salvos
          </h2>
          <div className="card space-y-2">
            {missiles.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-400">{m.name}</span>
                <span className="text-gray-500 font-mono text-xs">
                  {(m.rounds_to_contact ?? 0) > 1
                    ? `${(m.rounds_to_contact ?? 0) - 1} round${(m.rounds_to_contact ?? 0) - 1 !== 1 ? 's' : ''} to contact after this round`
                    : 'Arrives next round'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION C: Pending Effects (things that will apply) ── */}
      {(shipsWithLeadership.length > 0 ||
        shipsWithOverload.length > 0 ||
        shipsWithFuelLeak.length > 0 ||
        shipsWithLifeSupport.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Effects Applying This Cleanup
          </h2>
          <div className="space-y-2">

            {/* Leadership effects carrying forward */}
            {shipsWithLeadership.map((obj) => (
              <div
                key={`lead-${obj.id}`}
                className="card flex items-center gap-3 py-2.5 px-4 border-l-2 border-nexus-600"
              >
                <span className="text-nexus-400 text-xs">⟳</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{obj.name}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    Leadership Effect{' '}
                    <span className="font-mono text-nexus-300 font-bold">
                      {obj.leadership_effect > 0 ? `+${obj.leadership_effect}` : obj.leadership_effect}
                    </span>{' '}
                    carries into next initiative roll
                  </span>
                </div>
              </div>
            ))}

            {/* Overload effects */}
            {shipsWithOverload.map((obj) => (
              <div
                key={`over-${obj.id}`}
                className="card flex items-center gap-3 py-2.5 px-4 border-l-2 border-amber-600"
              >
                <span className="text-amber-400 text-xs">⚡</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{obj.name}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    {obj.increase_thrust_next && 'Thrust +1 from overload drive'}
                    {obj.increase_thrust_next && obj.increase_power_next && ' · '}
                    {obj.increase_power_next && 'Power +10% from overload plant'}
                  </span>
                </div>
              </div>
            ))}

            {/* Fuel leaks */}
            {shipsWithFuelLeak.map((obj) => (
              <div
                key={`fuel-${obj.id}`}
                className="card flex items-center gap-3 py-2.5 px-4 border-l-2 border-red-700"
              >
                <span className="text-red-400 text-xs">⛽</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{obj.name}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    Fuel leak: −{obj.fuel_leak_rate} dt
                    {obj.fuel_current != null && (
                      <> · current {obj.fuel_current} → {Math.max(0, obj.fuel_current - obj.fuel_leak_rate)} dt</>
                    )}
                  </span>
                </div>
              </div>
            ))}

            {/* Life support */}
            {shipsWithLifeSupport.map((obj) => (
              <div
                key={`ls-${obj.id}`}
                className="card flex items-center gap-3 py-2.5 px-4 border-l-2 border-red-600"
              >
                <span className="text-red-400 text-xs">☠</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{obj.name}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    Life support {obj.life_support_status?.toLowerCase()}
                    {obj.life_support_status === 'Failing' && obj.life_support_timer != null && (
                      <> · {obj.life_support_timer - 1 > 0 ? `${obj.life_support_timer - 1} round${obj.life_support_timer - 1 !== 1 ? 's' : ''} remaining` : 'fails this cleanup'}</>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION D: What Cleanup Resets ── */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Cleanup Will Reset
        </h2>
        <div className="card grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-500">
          <ResetRow label="Movement intents & targets" />
          <ResetRow label="Initiative values (re-roll next round)" />
          <ResetRow label="Thrust spent → restored to max" />
          <ResetRow label="Weapon status → Full" />
          <ResetRow label="EW / comms jam flags" />
          <ResetRow label="Round counter → {session.current_round + 1}" value={`Round ${session.current_round + 1}`} />
        </div>
        <p className="text-xs text-gray-700 italic">
          Leadership effects are <span className="text-nexus-400">preserved</span> and will apply to next round's initiative rolls.
        </p>
      </div>

      {/* ── SECTION E: Proceed ── */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-300">End Round {session.current_round}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Apply cleanup, increment round counter, and return to Initiative Phase.
          </p>
        </div>
        <button
          onClick={handleEndRound}
          disabled={running}
          className="btn-primary shrink-0"
        >
          {running ? 'Processing…' : `End Round ${session.current_round} →`}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResetRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-700">✓</span>
      <span>{value ?? label}</span>
    </div>
  );
}
