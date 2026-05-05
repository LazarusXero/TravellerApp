import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../hooks/useApi';
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

interface CharacterCombatRoleRecord {
  role: string;
  mount_id: number | null;
  confirmed: boolean;
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

function getRangeTP(ranges: CombatRange[], fromId: number, toId: number): number | null {
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

const ROLE_LABELS: Record<string, string> = {
  CAPTAIN: 'Captain',
  PILOT: 'Pilot',
  GUNNER: 'Gunner',
  ENGINEER: 'Engineer',
  'SENSOR OPERATOR': 'Sensor Operator',
  MARINE: 'Marine / Boarding Party',
  PASSENGER: 'Passenger',
};

// ── Movement Declaration Modal ─────────────────────────────────────────────────

function MovementModal({
  playerShip,
  session,
  onClose,
  onSaved,
}: {
  playerShip: CombatObject;
  session: CombatSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useApp();

  const otherObjects = session.objects.filter(
    (o) => o.id !== playerShip.id && o.object_type !== 'MISSILE_SALVO',
  );

  const [intent, setIntent] = useState<'CLOSE' | 'FLEE' | 'HOLD'>('HOLD');
  const [targetId, setTargetId] = useState<number | null>(
    otherObjects.length > 0 ? otherObjects[0].id : null,
  );
  const [thrustSpent, setThrustSpent] = useState(0);
  const [saving, setSaving] = useState(false);

  // If re-declaring, restore previously spent thrust to get the true available amount
  const maxThrust = (playerShip.current_thrust ?? 0) + (playerShip.move_intent != null ? (playerShip.thrust_spent ?? 0) : 0);

  const targetBand =
    targetId != null ? getRangeBand(session.ranges, playerShip.id, targetId) : null;

  const estBand = (() => {
    if (intent === 'HOLD' || targetId == null) return null;
    const currentTp = getRangeTP(session.ranges, playerShip.id, targetId);
    if (currentTp == null) return null;
    const delta = intent === 'CLOSE' ? -thrustSpent : thrustSpent;
    const newTp = Math.max(0, Math.min(94, currentTp + delta));
    return thrustPointsToBand(newTp);
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      const body =
        intent === 'HOLD'
          ? { move_intent: 'HOLD', move_target_id: null, thrust_spent: 0 }
          : { move_intent: intent, move_target_id: targetId, thrust_spent: thrustSpent };

      const res = await apiFetch(`/api/combat/object/${playerShip.id}/move`, {
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
          <h2 className="text-base font-bold text-gray-100">{playerShip.name}</h2>
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
                const band = getRangeBand(session.ranges, playerShip.id, o.id);
                return (
                  <option key={o.id} value={o.id}>
                    {o.name}{band ? ` (${band})` : ''}
                  </option>
                );
              })}
            </select>
            {targetBand && (
              <p className="text-xs text-gray-600">
                Current range to target:{' '}
                <span className={`font-medium ${bandColor(targetBand)}`}>{targetBand}</span>
              </p>
            )}
          </div>
        )}

        {/* Thrust */}
        {intent !== 'HOLD' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-wider">
              Thrust to Spend{' '}
              <span className="text-gray-700 normal-case">(max {maxThrust})</span>
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

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
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

// ── Pilot Section ─────────────────────────────────────────────────────────────

function PilotSection({
  playerShip,
  session,
  onRefresh,
}: {
  playerShip: CombatObject;
  session: CombatSession;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const targetName =
    playerShip.move_target_id != null
      ? session.objects.find((o) => o.id === playerShip.move_target_id)?.name
      : null;

  const intentLabel =
    playerShip.move_intent === 'HOLD'
      ? 'Hold Position'
      : playerShip.move_intent === 'CLOSE'
        ? 'Close'
        : playerShip.move_intent === 'FLEE'
          ? 'Flee'
          : null;

  if (playerShip.move_intent != null) {
    return (
      <div className="card space-y-3">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Movement Declared</h2>
        <div className="px-4 py-3 rounded-xl bg-nexus-900/40 border border-nexus-700/50">
          <p className="text-nexus-300 font-semibold text-sm">
            {intentLabel}
            {targetName ? ` towards ${targetName}` : ''}
            {playerShip.move_intent !== 'HOLD' && playerShip.thrust_spent > 0
              ? ` — ${playerShip.thrust_spent} thrust`
              : ''}
          </p>
          <p className="text-nexus-600 text-xs mt-0.5">Waiting for GM to resolve movement…</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Change movement
        </button>
        {showModal && (
          <MovementModal
            playerShip={playerShip}
            session={session}
            onClose={() => setShowModal(false)}
            onSaved={() => { setShowModal(false); onRefresh(); }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <MovementModal
          playerShip={playerShip}
          session={session}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onRefresh(); }}
        />
      )}
      <div className="card space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Declare Movement</h2>
          <p className="text-gray-500 text-sm mt-1">
            Choose how the ship moves this round. You have {playerShip.current_thrust ?? 0} thrust available.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          Declare Movement
        </button>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PlayerCombatManoeuvre() {
  const { player } = useAuth();
  const { notify: _notify } = useApp();
  const navigate = useNavigate();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterId, setCharacterId] = useState<number>(0);
  const [role, setRole] = useState<string | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);

  // Live character ID
  useEffect(() => {
    if (!player?.id) return;
    (async () => {
      const res = await apiFetch<{ active_character_id: number | null }>(
        `/api/players/${player.id}`,
      );
      if (res.success && res.data) {
        setCharacterId(res.data.active_character_id ?? 0);
      }
    })();
  }, [player?.id]);

  // Load game + session
  const loadSession = useCallback(async (gId: number) => {
    const res = await apiFetch<CombatSession | null>(
      `/api/combat/session/active?game_id=${gId}`,
    );
    if (res.success) setSession(res.data ?? null);
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

  // Fetch confirmed role
  useEffect(() => {
    if (!session || !characterId) return;
    (async () => {
      const res = await apiFetch<CharacterCombatRoleRecord | null>(
        `/api/combat/session/${session.id}/role/${characterId}`,
      );
      if (res.success && res.data?.confirmed) {
        setRole(res.data.role);
      }
    })();
  }, [session?.id, characterId]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    await loadSession(gameId);
  }, [gameId, loadSession]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Manoeuvre</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const playerShip = session.objects.find((o) => o.is_player_ship) ?? null;
  const inAttack = session.current_phase === 'ATTACK';

  const initiativeOrder = [...session.objects]
    .filter((o) => o.initiative != null && o.object_type !== 'MISSILE_SALVO')
    .sort((a, b) => {
      const diff = (b.initiative ?? 0) - (a.initiative ?? 0);
      return diff !== 0 ? diff : (b.current_thrust ?? 0) - (a.current_thrust ?? 0);
    });

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Manoeuvre</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round}
          {role && (
            <span className="ml-2 text-nexus-500">
              · Your Role: {ROLE_LABELS[role] ?? role}
            </span>
          )}
        </p>
      </div>

      {/* Phase gate: ATTACK started */}
      {inAttack && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-amber-900/30 border border-amber-700/50">
          <div>
            <p className="text-amber-300 font-semibold text-sm">Attack Phase has begun.</p>
            <p className="text-amber-600 text-xs mt-0.5">Proceed when ready.</p>
          </div>
          <button
            onClick={() => navigate('/combat/attack')}
            className="btn-primary shrink-0"
          >
            Go to Attack →
          </button>
        </div>
      )}

      {/* Initiative Order */}
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

      {/* Role-specific section */}
      {!inAttack && (
        <>
          {role === 'PILOT' && playerShip ? (
            <PilotSection
              playerShip={playerShip}
              session={session}
              onRefresh={refresh}
            />
          ) : role === 'PILOT' && !playerShip ? (
            <div className="card text-center py-8 text-gray-700 text-sm">
              No player ship found in this session.
            </div>
          ) : role ? (
            <div className="card space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stand By</h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                The Pilot is declaring the ship's movement.
              </div>
              <p className="text-gray-700 text-xs">
                You will be notified when the Attack Phase begins.
              </p>
            </div>
          ) : (
            <div className="card text-center py-8 text-gray-700 text-sm">
              No role confirmed. Return to the Setup page to select your role.
            </div>
          )}
        </>
      )}
    </div>
  );
}
