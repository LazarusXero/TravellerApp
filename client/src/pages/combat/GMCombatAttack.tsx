import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';
import { CombatDiagram } from '../../components/combat/CombatDiagram';
import type { DiagramObject, DiagramRange } from '../../components/combat/CombatDiagram';
import { GunnerWeaponPanel, fmtSign } from '../../components/combat/GunnerWeaponPanel';
import type { GunnerDMs, GunnerObject, GunnerRange } from '../../components/combat/GunnerWeaponPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CombatSession {
  id: number;
  game_id: number;
  name: string;
  current_phase: string;
  current_round: number;
  objects: GunnerObject[];
  ranges: GunnerRange[];
}

// ── Aid Gunner helpers ────────────────────────────────────────────────────────

function effectToAidGunnerDM(effect: number): number {
  if (effect <= -6) return -3;
  if (effect <= -2) return -2;
  if (effect === -1) return -1;
  if (effect === 0) return 0;
  if (effect <= 5) return 1;
  return 2;
}

const AID_GUNNER_TABLE: [string, string][] = [
  ['≤ −6', '−3'],
  ['−5 to −2', '−2'],
  ['−1', '−1'],
  ['0', '+0'],
  ['1 to 5', '+1'],
  ['≥ 6', '+2'],
];

// ── NPC Aid Gunner Modal ──────────────────────────────────────────────────────

function NPCAidGunnerModal({
  sessionId,
  ship,
  onDone,
  onClose,
}: {
  sessionId: number;
  ship: GunnerObject;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState('');
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [confirmedDM, setConfirmedDM] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const pilotDM = ship.pilot_skill_dm ?? -3;

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll ? rollNum + pilotDM - 8 : null;
  const previewDM = effect != null ? effectToAidGunnerDM(effect) : null;

  const handleConfirm = async () => {
    if (previewDM == null) return;
    setSubmitting(true);
    setConfirmedDM(previewDM);
    localStorage.setItem(`combat_npc_aid_gunner_${sessionId}_${ship.id}`, String(previewDM));
    await apiFetch(`/api/combat/object/${ship.id}/thrust-deduct`, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 1 }),
    });
    setSubmitting(false);
    setPhase('RESULT');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-100">Aid Gunner</h3>
          <p className="text-gray-600 text-xs mt-0.5">
            {ship.name} — Pilot task chain; costs 1 thrust
          </p>
        </div>

        {phase === 'ROLLING' && (
          <>
            <div className="space-y-0">
              <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-800/60">
                <div>
                  <span className="text-gray-400 text-sm">Roll 2D6</span>
                  <p className="text-gray-700 text-xs mt-0.5">Enter your physical dice result</p>
                </div>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="2–12"
                  className="input text-sm w-24 text-right"
                />
              </div>
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                <span className="text-gray-400 text-sm">+ Pilot Skill DM</span>
                <span className="font-mono text-gray-200 text-sm">{fmtSign(pilotDM)}</span>
              </div>
              <div className="flex items-start justify-between gap-4 py-1.5">
                <span className="text-gray-400 text-sm">− 8 (task difficulty)</span>
                <span className="font-mono text-gray-200 text-sm">−8</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400 text-sm font-medium">Effect</span>
              <span className={`font-mono text-lg font-bold ${
                effect != null ? (effect >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-700'
              }`}>
                {effect != null ? fmtSign(effect) : '—'}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-600 uppercase tracking-wider">Effect → Task Chain DM</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
                {AID_GUNNER_TABLE.map(([eff, dm]) => (
                  <div
                    key={eff}
                    className={`flex justify-between px-2 py-0.5 rounded ${
                      previewDM != null && previewDM === parseInt(dm.replace('+', ''), 10)
                        ? 'bg-nexus-900/40 text-nexus-400'
                        : 'text-gray-600'
                    }`}
                  >
                    <span>Effect {eff}</span>
                    <span className="font-mono">DM {dm}</span>
                  </div>
                ))}
              </div>
            </div>

            {previewDM != null && (
              <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-nexus-900/20 border border-nexus-800/50">
                <span className="text-nexus-400 font-semibold text-sm">Task Chain DM</span>
                <span className="font-mono text-nexus-300 text-xl font-bold">{fmtSign(previewDM)}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => { void handleConfirm(); }}
                disabled={submitting || previewDM == null}
                className="btn-primary flex-1"
              >
                {submitting ? 'Applying…' : 'Confirm Roll'}
              </button>
            </div>
          </>
        )}

        {phase === 'RESULT' && (
          <>
            <div className="rounded-xl p-5 text-center bg-nexus-900/30 border border-nexus-700/50">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                Task Chain DM — Gunners
              </p>
              <p className="font-mono text-4xl font-bold text-nexus-300">{fmtSign(confirmedDM)}</p>
              <p className="text-nexus-500 text-sm mt-2">
                {confirmedDM >= 0
                  ? 'Apply this DM to all gunner attack rolls this round.'
                  : 'Negative DM — gunner attacks are penalised this round.'}
              </p>
            </div>
            <button onClick={onDone} className="btn-primary w-full">Done</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── NPC Evasive Action Modal ──────────────────────────────────────────────────

function NpcEvasiveModal({
  ship,
  onDone,
  onClose,
}: {
  ship: GunnerObject;
  onDone: (thrust: number) => void;
  onClose: () => void;
}) {
  const maxThrust = ship.current_thrust ?? 0;
  const [thrust, setThrust] = useState(Math.min(1, maxThrust));
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (thrust <= 0) return;
    setSubmitting(true);
    await apiFetch(`/api/combat/object/${ship.id}/thrust-deduct`, {
      method: 'PATCH',
      body: JSON.stringify({ amount: thrust }),
    });
    setSubmitting(false);
    onDone(thrust);
  };

  if (maxThrust <= 0) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-100">Evasive Action — {ship.name}</h3>
          <p className="text-red-400 text-sm">No thrust remaining.</p>
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-100">Evasive Action</h3>
          <p className="text-gray-500 text-xs mt-0.5">{ship.name}</p>
        </div>

        <div className="bg-gray-950 rounded-xl p-4 space-y-0">
          <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
            <span className="text-gray-400 text-sm">Available Thrust</span>
            <span className="font-mono text-gray-200 text-sm">{maxThrust}</span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <div>
              <span className="text-gray-400 text-sm">Thrust to spend</span>
              <p className="text-gray-700 text-xs mt-0.5">Each point = −1 DM to attacks against this ship</p>
            </div>
            <select
              value={thrust}
              onChange={(e) => setThrust(parseInt(e.target.value, 10))}
              className="input text-sm w-20 py-0.5 text-right"
            >
              {Array.from({ length: maxThrust }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-gray-950 rounded-xl p-4 flex items-center justify-between">
          <p className="text-gray-400 text-sm">Attack penalty on this ship</p>
          <span className="font-mono text-amber-300 text-xl font-bold">−{thrust}</span>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => { void handleConfirm(); }}
            disabled={submitting}
            className="btn-primary flex-1"
          >
            {submitting ? 'Applying…' : 'Commit Evasion'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NPC Reactions Panel ───────────────────────────────────────────────────────

function NpcReactionsPanel({
  ship,
  onRefresh,
}: {
  ship: GunnerObject;
  onRefresh: () => void;
}) {
  const [showEvasive, setShowEvasive] = useState(false);
  const [evasivePenalty, setEvasivePenalty] = useState<number | null>(null);

  const thrustLeft = ship.current_thrust ?? 0;
  const evasiveUsed = evasivePenalty !== null;

  return (
    <>
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Reactions</p>
        <div className="flex flex-wrap gap-2">
          {/* Evasive Action */}
          <button
            onClick={() => setShowEvasive(true)}
            disabled={evasiveUsed || thrustLeft <= 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              evasiveUsed || thrustLeft <= 0
                ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed'
                : 'bg-gray-900 border-gray-700 text-amber-300 hover:border-amber-600 hover:bg-amber-900/10 cursor-pointer'
            }`}
          >
            {evasiveUsed
              ? `Evasive Active — −${evasivePenalty} to attacks`
              : `Evasive Action${thrustLeft > 0 ? ` (${thrustLeft} thrust)` : ''}`}
          </button>
        </div>
      </div>

      {showEvasive && (
        <NpcEvasiveModal
          ship={ship}
          onDone={(thrust) => {
            setEvasivePenalty(thrust);
            setShowEvasive(false);
            onRefresh();
          }}
          onClose={() => setShowEvasive(false)}
        />
      )}
    </>
  );
}

// ── NPC Ship Attack Section ───────────────────────────────────────────────────

function NPCShipAttackSection({
  ship,
  session,
  refresh,
}: {
  ship: GunnerObject;
  session: CombatSession;
  refresh: () => void;
}) {
  const [showAidGunner, setShowAidGunner] = useState(false);
  const [aidGunnerUsed, setAidGunnerUsed] = useState(false);

  useEffect(() => {
    setAidGunnerUsed(
      localStorage.getItem(`combat_npc_aid_gunner_${session.id}_${ship.id}`) !== null,
    );
  }, [session.id, ship.id]);

  const gunnerDMs: GunnerDMs = {
    skillDM: ship.gunner_skill_dm ?? -3,
    dexDM: ship.gunner_dex_dm ?? 0,
  };

  const thrustLeft = ship.current_thrust ?? 0;

  return (
    <div className="space-y-3">
      {/* Ship header */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-200">{ship.name}</h3>
        <span className="text-xs text-gray-600 font-mono">
          Initiative {ship.initiative ?? '—'}
        </span>
        <span className="text-xs text-gray-600">
          Hull {ship.hull_current ?? 0}/{ship.hull_max ?? 0}
        </span>
        <span className="text-xs text-gray-600">
          Thrust {ship.current_thrust ?? 0}/{ship.adjusted_max_thrust ?? 0}
        </span>
        {ship.is_destroyed && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">
            Destroyed
          </span>
        )}
        {ship.ew_used && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
            EW used
          </span>
        )}
      </div>

      {/* Per-ship diagram */}
      <div className="card p-3">
        <CombatDiagram
          referenceObjectId={ship.id}
          objects={session.objects as unknown as DiagramObject[]}
          ranges={session.ranges as unknown as DiagramRange[]}
        />
      </div>

      {ship.is_destroyed ? (
        <p className="text-gray-700 text-xs">Ship destroyed — no actions available.</p>
      ) : (
        <div className="card space-y-5">
          {/* Pilot Actions */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Pilot Actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAidGunner(true)}
                disabled={aidGunnerUsed || thrustLeft <= 0}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  aidGunnerUsed || thrustLeft <= 0
                    ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed'
                    : 'bg-gray-900 border-gray-700 text-gray-200 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                }`}
              >
                {aidGunnerUsed
                  ? 'Aid Gunner (used)'
                  : `Aid Gunner${thrustLeft > 0 ? ` (${thrustLeft} thrust)` : ''}`}
              </button>
            </div>
          </div>

          {/* Weapon mounts */}
          {ship.weapon_mounts.length === 0 ? (
            <p className="text-gray-700 text-xs">No weapon mounts on this ship.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Weapons</p>
              {ship.weapon_mounts.map((mount) => (
                <GunnerWeaponPanel
                  key={mount.id}
                  mount={mount}
                  ship={ship}
                  sessionId={session.id}
                  objects={session.objects}
                  ranges={session.ranges}
                  gunnerDMs={gunnerDMs}
                  onRefresh={refresh}
                />
              ))}
            </div>
          )}

          {/* Reactions */}
          <NpcReactionsPanel ship={ship} onRefresh={refresh} />
        </div>
      )}

      {/* Aid Gunner Modal */}
      {showAidGunner && (
        <NPCAidGunnerModal
          sessionId={session.id}
          ship={ship}
          onDone={() => {
            setAidGunnerUsed(true);
            setShowAidGunner(false);
            refresh();
          }}
          onClose={() => setShowAidGunner(false)}
        />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GMCombatAttack() {
  const navigate = useNavigate();
  const { notify } = useApp();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [gameId, setGameId] = useState<number | null>(null);

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

  // ── Advance to Action phase ────────────────────────────────────────────────

  const handleAdvance = async () => {
    if (!session) return;
    setAdvancing(true);
    const res = await apiFetch(`/api/combat/session/${session.id}/phase`, {
      method: 'PATCH',
      body: JSON.stringify({ phase: 'ACTION' }),
    });
    setAdvancing(false);
    if (res.success) {
      navigate('/combat/action');
    } else {
      notify('error', res.error ?? 'Failed to advance phase.');
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
        <h1 className="text-2xl font-bold text-gray-100">Attack / Reaction</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const allShips = session.objects.filter((o) => o.object_type === 'SHIP');
  const npcShips = allShips.filter((o) => !o.is_player_ship);
  const playerShip = allShips.find((o) => o.is_player_ship) ?? null;

  const initiativeOrder = [...allShips]
    .filter((o) => o.initiative != null)
    .sort((a, b) => {
      const diff = (b.initiative ?? 0) - (a.initiative ?? 0);
      return diff !== 0 ? diff : (b.current_thrust ?? 0) - (a.current_thrust ?? 0);
    });

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Attack / Reaction</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round}
        </p>
      </div>

      {/* Initiative order banner */}
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${obj.is_player_ship ? 'bg-nexus-900/40 text-nexus-400' : 'bg-gray-800 text-gray-500'}`}>
                      {obj.is_player_ship ? 'Player' : 'NPC'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Player ship + diagram */}
      {playerShip && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Battlefield</h2>
          <div className="card space-y-3">
            <CombatDiagram
              referenceObjectId={playerShip.id}
              objects={session.objects as unknown as DiagramObject[]}
              ranges={session.ranges as unknown as DiagramRange[]}
            />
          </div>
        </div>
      )}

      {/* NPC ship sections */}
      {npcShips.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">NPC Ships</h2>
          {npcShips
            .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
            .map((ship) => (
              <NPCShipAttackSection
                key={ship.id}
                ship={ship}
                session={session}
                refresh={refresh}
              />
            ))}
        </div>
      )}

      {/* Advance phase */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-300">Proceed to Action Phase</p>
          <p className="text-xs text-gray-600 mt-0.5">
            All attacks have been resolved. Proceed when ready.
          </p>
        </div>
        <button
          onClick={() => { void handleAdvance(); }}
          disabled={advancing}
          className="btn-primary shrink-0"
        >
          {advancing ? 'Advancing…' : 'Proceed to Action →'}
        </button>
      </div>
    </div>
  );
}
