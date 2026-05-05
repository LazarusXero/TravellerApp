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
  move_intent: string | null;
  move_target_id: number | null;
  hull_current: number | null;
  hull_max: number | null;
  current_thrust: number | null;
  adjusted_max_thrust: number | null;
  missile_quantity: number | null;
  rounds_to_contact: number | null;
  thrust_spent: number;
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

function thrustPointsToBand(tp: number): string {
  if (tp < 1) return 'ADJACENT';
  if (tp < 2) return 'CLOSE';
  if (tp < 4) return 'SHORT';
  if (tp < 9) return 'MEDIUM';
  if (tp < 19) return 'LONG';
  if (tp < 44) return 'VERY LONG';
  return 'DISTANT';
}

function getRangeTP(
  ranges: CombatRange[],
  fromId: number,
  toId: number,
): number | null {
  const r = ranges.find(
    (x) =>
      (x.from_object_id === fromId && x.to_object_id === toId) ||
      (x.from_object_id === toId && x.to_object_id === fromId),
  );
  return r?.thrust_points ?? null;
}

function getRangeBand(ranges: CombatRange[], fromId: number, toId: number): string | null {
  const r = ranges.find(
    (x) =>
      (x.from_object_id === fromId && x.to_object_id === toId) ||
      (x.from_object_id === toId && x.to_object_id === fromId),
  );
  return r?.band ?? null;
}

function estimatedBand(
  ranges: CombatRange[],
  shipId: number,
  targetId: number,
  intent: string,
  thrustSpent: number,
): string | null {
  const currentTp = getRangeTP(ranges, shipId, targetId);
  if (currentTp == null) return null;
  const delta = intent === 'CLOSE' ? -thrustSpent : intent === 'FLEE' ? thrustSpent : 0;
  const newTp = Math.max(0, Math.min(94, currentTp + delta));
  return thrustPointsToBand(newTp);
}

function bandColor(band: string): string {
  switch (band) {
    case 'ADJACENT': return 'text-red-400';
    case 'CLOSE': return 'text-orange-400';
    case 'SHORT': return 'text-yellow-400';
    case 'MEDIUM': return 'text-emerald-400';
    case 'LONG': return 'text-sky-400';
    case 'VERY LONG': return 'text-blue-400';
    case 'DISTANT': return 'text-violet-400';
    default: return 'text-gray-400';
  }
}

// ── Movement Modal ────────────────────────────────────────────────────────────

function MovementModal({
  ship,
  session,
  onClose,
  onSaved,
}: {
  ship: CombatObject;
  session: CombatSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useApp();

  const otherObjects = session.objects.filter(
    (o) => o.id !== ship.id && o.object_type !== 'MISSILE_SALVO',
  );

  const [intent, setIntent] = useState<'CLOSE' | 'FLEE' | 'HOLD'>('HOLD');
  const [targetId, setTargetId] = useState<number | null>(
    otherObjects.length > 0 ? otherObjects[0].id : null,
  );
  const [thrustSpent, setThrustSpent] = useState(0);
  const [saving, setSaving] = useState(false);

  // If re-declaring, restore previously spent thrust to get the true available amount
  const maxThrust = (ship.current_thrust ?? 0) + (ship.move_intent != null ? (ship.thrust_spent ?? 0) : 0);

  const targetBand =
    targetId != null ? getRangeBand(session.ranges, ship.id, targetId) : null;

  const estBand =
    intent !== 'HOLD' && targetId != null
      ? estimatedBand(session.ranges, ship.id, targetId, intent, thrustSpent)
      : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body =
        intent === 'HOLD'
          ? { move_intent: 'HOLD', move_target_id: null, thrust_spent: 0 }
          : { move_intent: intent, move_target_id: targetId, thrust_spent: thrustSpent };

      const res = await apiFetch(`/api/combat/object/${ship.id}/move`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.success) {
        onSaved();
        onClose();
      } else {
        notify('error', res.error ?? 'Failed to save movement.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6">
        <div>
          <h2 className="text-base font-bold text-gray-100">{ship.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Declare movement intent</p>
        </div>

        {/* Intent */}
        <div className="space-y-2">
          <p className="text-xs text-gray-600 uppercase tracking-wider">Movement Intent</p>
          <div className="flex gap-2">
            {(['CLOSE', 'FLEE', 'HOLD'] as const).map((i) => (
              <button
                key={i}
                onClick={() => {
                  setIntent(i);
                  if (i === 'HOLD') setThrustSpent(0);
                }}
                className={[
                  'flex-1 py-2 rounded-xl border text-sm font-medium transition-colors',
                  intent === i
                    ? 'bg-nexus-900/40 border-nexus-600 text-nexus-300'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600',
                ].join(' ')}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Target */}
        {intent !== 'HOLD' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-wider">Target</p>
            <select
              value={targetId ?? ''}
              onChange={(e) => setTargetId(parseInt(e.target.value, 10))}
              className="input text-sm"
            >
              <option value="">— Select target —</option>
              {otherObjects.map((o) => {
                const band = getRangeBand(session.ranges, ship.id, o.id);
                return (
                  <option key={o.id} value={o.id}>
                    {o.name}{band ? ` (${band})` : ''}
                  </option>
                );
              })}
            </select>
            {targetBand && (
              <p className="text-xs text-gray-600">
                Current range to target: <span className={`font-medium ${bandColor(targetBand)}`}>{targetBand}</span>
              </p>
            )}
          </div>
        )}

        {/* Thrust */}
        {intent !== 'HOLD' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-wider">
              Thrust to Spend <span className="text-gray-700 normal-case">(max {maxThrust})</span>
            </p>
            <select
              value={thrustSpent}
              onChange={(e) => setThrustSpent(parseInt(e.target.value, 10))}
              className="input text-sm"
            >
              {Array.from({ length: maxThrust + 1 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* Estimated band */}
        {estBand && targetId != null && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-gray-400 text-sm">Estimated new range</span>
            <span className={`font-mono font-semibold text-sm ${bandColor(estBand)}`}>{estBand}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving || (intent !== 'HOLD' && targetId == null)}
            className="btn-primary flex-1"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NPC Ship Card ─────────────────────────────────────────────────────────────

function NpcShipCard({
  ship,
  session,
  onRefresh,
}: {
  ship: CombatObject;
  session: CombatSession;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const intentLabel =
    ship.move_intent === 'HOLD'
      ? 'Hold Position'
      : ship.move_intent === 'CLOSE'
        ? 'Close'
        : ship.move_intent === 'FLEE'
          ? 'Flee'
          : null;

  const targetName =
    ship.move_target_id != null
      ? session.objects.find((o) => o.id === ship.move_target_id)?.name
      : null;

  return (
    <>
      {showModal && (
        <MovementModal
          ship={ship}
          session={session}
          onClose={() => setShowModal(false)}
          onSaved={onRefresh}
        />
      )}

      <div className="card space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-gray-100 font-semibold text-sm">{ship.name}</p>
            <p className="text-gray-600 text-xs">
              Initiative {ship.initiative ?? '—'} · Thrust {ship.current_thrust ?? 0}/{ship.adjusted_max_thrust ?? 0}
            </p>
          </div>
          {ship.move_intent != null ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-400">
                {intentLabel}
                {targetName ? ` → ${targetName}` : ''}
                {ship.move_intent !== 'HOLD' && ship.thrust_spent > 0 ? ` (${ship.thrust_spent}T)` : ''}
              </span>
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="btn-secondary text-xs px-3 py-1.5 shrink-0"
            >
              Declare Movement
            </button>
          )}
        </div>

        {/* Mini combat diagram */}
        <div className="rounded-xl overflow-hidden bg-gray-950 border border-gray-800 p-3">
          <CombatDiagram
            referenceObjectId={ship.id}
            objects={session.objects as DiagramObject[]}
            ranges={session.ranges as DiagramRange[]}
          />
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GMCombatManoeuvre() {
  const navigate = useNavigate();
  const { notify } = useApp();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadSession = useCallback(async (gameId: number) => {
    const res = await apiFetch<CombatSession | null>(
      `/api/combat/session/active?game_id=${gameId}`,
    );
    if (res.success && res.data) setSession(res.data);
  }, []);

  const [gameId, setGameId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const gameRes = await apiFetch<{ id: number }>('/api/game');
      if (!gameRes.success || !gameRes.data) { setLoading(false); return; }
      setGameId(gameRes.data.id);
      await loadSession(gameRes.data.id);
      setLoading(false);
    })();
  }, [loadSession]);

  // Polling
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    const poll = async () => {
      const res = await apiFetch<CombatSession | null>(
        `/api/combat/session/active?game_id=${gameId}`,
      );
      if (!cancelled && res.success) setSession(res.data ?? null);
    };
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [gameId]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    await loadSession(gameId);
  }, [gameId, loadSession]);

  // ── Resolve & advance ──────────────────────────────────────────────────────

  const handleResolve = async () => {
    if (!session) return;
    setResolving(true);
    try {
      // Only advance the phase — movement intent and thrust_spent are recorded on each
      // object and will be applied to range changes during end-of-round cleanup.
      // Do NOT call cleanup here; that would reset current_thrust back to max,
      // erasing the thrust spent during this movement phase.
      const phaseRes = await apiFetch(`/api/combat/session/${session.id}/phase`, {
        method: 'PATCH',
        body: JSON.stringify({ phase: 'ATTACK' }),
      });
      if (phaseRes.success) {
        navigate('/combat/attack');
      } else {
        notify('error', phaseRes.error ?? 'Failed to advance phase.');
      }
    } finally {
      setResolving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Manoeuvre</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const allShips = session.objects.filter((o) => o.object_type === 'SHIP');
  const npcShips = allShips.filter((o) => !o.is_player_ship);
  const playerShip = allShips.find((o) => o.is_player_ship) ?? null;
  const missiles = session.objects.filter((o) => o.object_type === 'MISSILE_SALVO');

  const initiativeOrder = [...allShips]
    .filter((o) => o.initiative != null)
    .sort((a, b) => {
      const diff = (b.initiative ?? 0) - (a.initiative ?? 0);
      return diff !== 0 ? diff : (b.current_thrust ?? 0) - (a.current_thrust ?? 0);
    });

  const allShipsHaveMoveIntent = allShips.every((o) => o.move_intent != null);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Manoeuvre</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round}
        </p>
      </div>

      {/* Initiative Order Banner */}
      {initiativeOrder.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 bg-gray-950 border-b border-gray-800">
            <p className="text-xs text-gray-600 uppercase tracking-wider">Initiative Order</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-800/60">
              {initiativeOrder.map((obj, i) => (
                <tr key={obj.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-gray-600 w-8">#{i + 1}</td>
                  <td className="px-4 py-2">
                    <span className={`font-medium text-sm ${obj.is_player_ship ? 'text-nexus-300' : 'text-gray-200'}`}>
                      {obj.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-sm text-gray-400">{obj.initiative}</td>
                  <td className="px-4 py-2 text-right">
                    {obj.move_intent != null ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
                        {obj.move_intent}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-600">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Player ship status */}
      {playerShip && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Player Ship</h2>
          <div className="card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-nexus-300 font-semibold text-sm">{playerShip.name}</p>
                <p className="text-gray-600 text-xs">
                  Initiative {playerShip.initiative ?? '—'} · Thrust {playerShip.current_thrust ?? 0}/{playerShip.adjusted_max_thrust ?? 0}
                </p>
              </div>
              {playerShip.move_intent != null ? (
                <span className="px-2 py-1 text-xs rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-400">
                  {playerShip.move_intent}
                  {playerShip.move_target_id != null && (
                    <> → {session.objects.find((o) => o.id === playerShip.move_target_id)?.name}</>
                  )}
                </span>
              ) : (
                <span className="text-xs text-amber-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                  Awaiting player
                </span>
              )}
            </div>
            <div className="rounded-xl overflow-hidden bg-gray-950 border border-gray-800 p-3">
              <CombatDiagram
                referenceObjectId={playerShip.id}
                objects={session.objects as DiagramObject[]}
                ranges={session.ranges as DiagramRange[]}
              />
            </div>
          </div>
        </div>
      )}

      {/* NPC Ships */}
      {npcShips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            NPC Ships
          </h2>
          <div className="space-y-4">
            {npcShips
              .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
              .map((ship) => (
                <NpcShipCard
                  key={ship.id}
                  ship={ship}
                  session={session}
                  onRefresh={refresh}
                />
              ))}
          </div>
        </div>
      )}

      {/* Missile Salvos */}
      {missiles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Missile Salvos</h2>
          <div className="card space-y-3">
            {missiles.map((m) => {
              const targetObj = m.move_target_id != null
                ? session.objects.find((o) => o.id === m.move_target_id)
                : null;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                  <div>
                    <span className="text-amber-400 font-medium text-sm">{m.name}</span>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {m.missile_quantity ?? '?'}× missiles ·{' '}
                      {m.rounds_to_contact != null
                        ? `${m.rounds_to_contact} round${m.rounds_to_contact !== 1 ? 's' : ''} to contact`
                        : 'Contact this round'}
                      {targetObj && <> · Target: {targetObj.name}</>}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/50">
                    Auto
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolve & Advance */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-300">Resolve Movement &amp; Advance to Attack Phase</p>
          {!allShipsHaveMoveIntent && (
            <p className="text-xs text-gray-600 mt-0.5">
              All ships must declare a movement intent before proceeding.
            </p>
          )}
        </div>
        <button
          onClick={() => { void handleResolve(); }}
          disabled={!allShipsHaveMoveIntent || resolving}
          className="btn-primary shrink-0"
        >
          {resolving ? 'Resolving…' : 'Resolve Movement →'}
        </button>
      </div>
    </div>
  );
}
