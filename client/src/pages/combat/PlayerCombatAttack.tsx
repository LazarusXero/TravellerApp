import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../hooks/useApi';
import { CombatDiagram } from '../../components/combat/CombatDiagram';
import type { DiagramObject, DiagramRange } from '../../components/combat/CombatDiagram';
import {
  GunnerWeaponPanel,
  statDM,
  fmtSign,
} from '../../components/combat/GunnerWeaponPanel';
import type {
  GunnerDMs,
  GunnerMount,
  GunnerObject,
  GunnerRange,
} from '../../components/combat/GunnerWeaponPanel';
import { ShipStatusPanel } from '../../components/combat/ShipStatusPanel';

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

interface CharacterCombatRoleRecord {
  role: string;
  mount_id: number | null;
  confirmed: boolean;
}

interface CharacterSkill {
  skillName: string;
  level: number | null;
}

interface Character {
  id: number;
  name: string;
  str: number | null;
  dex: number | null;
  end: number | null;
  int: number | null;
  edu: number | null;
  soc: number | null;
  character_skills: CharacterSkill[];
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

function getBestGunnerSkillDM(character: Character): number {
  const gunnerSkills = character.character_skills.filter(
    (s) => s.skillName.startsWith('Gunner') || s.skillName.includes('Gunner'),
  );
  if (gunnerSkills.length === 0) return -3;
  return gunnerSkills.reduce((best, s) => Math.max(best, s.level ?? -3), -3);
}

function getBestPilotSkillDM(character: Character): number {
  const pilotSkills = character.character_skills.filter(
    (s) => s.skillName.startsWith('Pilot') || s.skillName.includes('Pilot'),
  );
  if (pilotSkills.length === 0) return -3;
  return pilotSkills.reduce((best, s) => Math.max(best, s.level ?? -3), -3);
}

// ── Pilot: Aid Gunner helpers ─────────────────────────────────────────────────

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

// ── Pilot: Aid Gunner Modal ───────────────────────────────────────────────────

function AidGunnerModal({
  sessionId,
  playerShip,
  pilotDM,
  onDone,
  onClose,
}: {
  sessionId: number;
  playerShip: GunnerObject;
  pilotDM: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState('');
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [confirmedDM, setConfirmedDM] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll ? rollNum + pilotDM - 8 : null;
  const previewDM = effect != null ? effectToAidGunnerDM(effect) : null;

  const handleConfirm = async () => {
    if (previewDM == null) return;
    setSubmitting(true);
    setConfirmedDM(previewDM);
    // Always store — even negative DMs penalise gunners
    localStorage.setItem(`combat_aid_gunner_${sessionId}`, String(previewDM));
    // Deduct 1 thrust regardless of outcome
    await apiFetch(`/api/combat/object/${playerShip.id}/thrust-deduct`, {
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
            Pilot task chain — costs 1 thrust, grants Task Chain DM to gunners.
          </p>
        </div>

        {phase === 'ROLLING' && (
          <>
            <div className="space-y-0">
              {/* Roll input */}
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

              {/* Pilot Skill DM */}
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                <span className="text-gray-400 text-sm">+ Pilot Skill DM</span>
                <span className="font-mono text-gray-200 text-sm">{fmtSign(pilotDM)}</span>
              </div>

              {/* Task difficulty */}
              <div className="flex items-start justify-between gap-4 py-1.5">
                <span className="text-gray-400 text-sm">− 8 (task difficulty)</span>
                <span className="font-mono text-gray-200 text-sm">−8</span>
              </div>
            </div>

            {/* Effect */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400 text-sm font-medium">Effect</span>
              <span className={`font-mono text-lg font-bold ${
                effect != null ? (effect >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-700'
              }`}>
                {effect != null ? fmtSign(effect) : '—'}
              </span>
            </div>

            {/* Task chain table */}
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

            {/* Task Chain DM result */}
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
                  ? 'Tell your gunners to apply this DM to their attack rolls.'
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

// ── Pilot: Evasive Action Modal ───────────────────────────────────────────────

function EvasiveActionModal({
  sessionId,
  playerShip,
  onDone,
  onClose,
}: {
  sessionId: number;
  playerShip: GunnerObject;
  onDone: () => void;
  onClose: () => void;
}) {
  const maxThrust = playerShip.current_thrust ?? 0;
  const [thrust, setThrust] = useState(Math.min(1, maxThrust));
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (thrust <= 0) return;
    setSubmitting(true);
    await apiFetch(`/api/combat/object/${playerShip.id}/thrust-deduct`, {
      method: 'PATCH',
      body: JSON.stringify({ amount: thrust }),
    });
    localStorage.setItem(`combat_evasive_${sessionId}`, String(thrust));
    setSubmitting(false);
    onDone();
  };

  if (maxThrust <= 0) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-100">Evasive Action</h3>
          <p className="text-red-400 text-sm">No thrust remaining — cannot take evasive action.</p>
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
          <p className="text-gray-600 text-xs mt-0.5">
            Spend thrust to impose a penalty on enemy attack rolls.
          </p>
        </div>

        <div className="bg-gray-950 rounded-xl p-4 space-y-0">
          <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
            <span className="text-gray-400 text-sm">Available Thrust</span>
            <span className="font-mono text-gray-200 text-sm">{maxThrust}</span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <div>
              <span className="text-gray-400 text-sm">Thrust to spend</span>
              <p className="text-gray-700 text-xs mt-0.5">Each point spent = −1 DM to all attacks against this ship</p>
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

// ── Main Component ────────────────────────────────────────────────────────────

export function PlayerCombatAttack() {
  const { player } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterId, setCharacterId] = useState<number>(0);
  const [role, setRole] = useState<string | null>(null);
  const [mountId, setMountId] = useState<number | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);

  // Pilot action state
  const [aidGunnerUsed, setAidGunnerUsed] = useState(false);
  const [evasiveUsed, setEvasiveUsed] = useState(false);
  const [evasivePenalty, setEvasivePenalty] = useState<number | null>(null);
  const [showAidGunner, setShowAidGunner] = useState(false);
  const [showEvasive, setShowEvasive] = useState(false);

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

  const loadSession = useCallback(async (gId: number) => {
    const res = await apiFetch<CombatSession | null>(
      `/api/combat/session/active?game_id=${gId}`,
    );
    if (res.success) setSession(res.data ?? null);
  }, []);

  // Initial load
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
        setMountId(res.data.mount_id ?? null);
      }
    })();
  }, [session?.id, characterId]);

  // Fetch character data
  useEffect(() => {
    if (!characterId) return;
    (async () => {
      const res = await apiFetch<Character>(`/api/characters/${characterId}`);
      if (res.success && res.data) setCharacter(res.data);
    })();
  }, [characterId]);

  // Restore used-action flags from localStorage when session known
  useEffect(() => {
    if (!session) return;
    setAidGunnerUsed(localStorage.getItem(`combat_aid_gunner_${session.id}`) !== null);
    const storedEvasive = localStorage.getItem(`combat_evasive_${session.id}`);
    setEvasiveUsed(storedEvasive !== null);
    setEvasivePenalty(storedEvasive !== null ? parseInt(storedEvasive, 10) : null);
  }, [session?.id]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    await loadSession(gameId);
  }, [gameId, loadSession]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Attack / Reaction</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const playerShip = session.objects.find((o) => o.is_player_ship) ?? null;
  const inAction = session.current_phase === 'ACTION';
  const inCleanup = session.current_phase === 'CLEANUP';

  const initiativeOrder = [...session.objects]
    .filter((o) => o.initiative != null && o.object_type !== 'MISSILE_SALVO')
    .sort((a, b) => {
      const diff = (b.initiative ?? 0) - (a.initiative ?? 0);
      return diff !== 0 ? diff : (b.current_thrust ?? 0) - (a.current_thrust ?? 0);
    });

  // Resolve the assigned mount
  const assignedMount: GunnerMount | null =
    role === 'GUNNER' && mountId != null && playerShip
      ? (playerShip.weapon_mounts.find((m) => m.id === mountId) as GunnerMount | undefined) ?? null
      : null;

  // Gunner DMs from character
  const gunnerDMs: GunnerDMs = {
    skillDM: character ? getBestGunnerSkillDM(character) : -3,
    dexDM: character ? statDM(character.dex) : 0,
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Attack / Reaction</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round}
          {role && (
            <span className="ml-2 text-nexus-500">
              · Your Role: {ROLE_LABELS[role] ?? role}
            </span>
          )}
        </p>
      </div>

      {/* Phase gates */}
      {(inAction || inCleanup) && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-amber-900/30 border border-amber-700/50">
          <div>
            <p className="text-amber-300 font-semibold text-sm">
              {inAction ? 'Action Phase has begun.' : 'Cleanup Phase has begun.'}
            </p>
            <p className="text-amber-600 text-xs mt-0.5">Proceed when ready.</p>
          </div>
          <button
            onClick={() => navigate(inAction ? '/combat/action' : '/combat')}
            className="btn-primary shrink-0"
          >
            {inAction ? 'Go to Action →' : 'Combat Summary →'}
          </button>
        </div>
      )}

      {/* Initiative order */}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Combat diagram */}
      {playerShip && (
        <div className="card space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Battlefield</h2>
          <CombatDiagram
            referenceObjectId={playerShip.id}
            objects={session.objects as unknown as DiagramObject[]}
            ranges={session.ranges as unknown as DiagramRange[]}
          />
        </div>
      )}

      {/* Role-specific section */}
      {!inAction && !inCleanup && (
        <>
          {/* ── GUNNER ── */}
          {role === 'GUNNER' && assignedMount && playerShip && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Gunner Actions</h2>
              <GunnerWeaponPanel
                mount={assignedMount}
                ship={playerShip as GunnerObject}
                sessionId={session.id}
                objects={session.objects}
                ranges={session.ranges}
                gunnerDMs={gunnerDMs}
                onRefresh={refresh}
              />
            </div>
          )}

          {role === 'GUNNER' && !assignedMount && (
            <div className="card text-center py-8 text-gray-700 text-sm">
              No weapon mount assigned. Return to Setup to re-confirm your role.
            </div>
          )}

          {/* ── PILOT ── */}
          {role === 'PILOT' && playerShip && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Pilot Actions</h2>

              <div className="card space-y-3">
                <p className="text-gray-500 text-xs">
                  Thrust remaining: {playerShip.current_thrust ?? 0} / {playerShip.adjusted_max_thrust ?? 0}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Aid Gunner */}
                  <button
                    onClick={() => setShowAidGunner(true)}
                    disabled={aidGunnerUsed}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border transition-colors ${
                      aidGunnerUsed
                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                        : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-200">Aid Gunner</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {aidGunnerUsed
                        ? 'Used this round'
                        : 'Pilot check — costs 1 thrust, grants task chain DM'}
                    </p>
                  </button>

                  {/* Evasive Action */}
                  <button
                    onClick={() => setShowEvasive(true)}
                    disabled={evasiveUsed || (playerShip.current_thrust ?? 0) <= 0}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border transition-colors ${
                      evasiveUsed || (playerShip.current_thrust ?? 0) <= 0
                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                        : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-200">Evasive Action</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {evasiveUsed && evasivePenalty != null
                        ? `Active — tell GM: −${evasivePenalty} to all attacks against this ship`
                        : evasiveUsed
                        ? 'Used this round'
                        : 'Spend thrust to penalise incoming attacks'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Modals */}
              {showAidGunner && character && (
                <AidGunnerModal
                  sessionId={session.id}
                  playerShip={playerShip}
                  pilotDM={getBestPilotSkillDM(character)}
                  onDone={() => {
                    setAidGunnerUsed(true);
                    setShowAidGunner(false);
                    void refresh();
                  }}
                  onClose={() => setShowAidGunner(false)}
                />
              )}
              {showEvasive && (
                <EvasiveActionModal
                  sessionId={session.id}
                  playerShip={playerShip}
                  onDone={() => {
                    setEvasiveUsed(true);
                    const stored = localStorage.getItem(`combat_evasive_${session.id}`);
                    setEvasivePenalty(stored !== null ? parseInt(stored, 10) : null);
                    setShowEvasive(false);
                    void refresh();
                  }}
                  onClose={() => setShowEvasive(false)}
                />
              )}
            </div>
          )}

          {/* ── SENSOR OPERATOR ── */}
          {role === 'SENSOR OPERATOR' && playerShip && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Sensor Operator</h2>
              <div className="card space-y-2">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stand By</h2>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                  Awaiting attack resolution.
                </div>
                <p className="text-gray-700 text-xs">
                  Sensor Lock, Jam Communications, and EW vs Missiles are taken in the Action Phase.
                </p>
              </div>
            </div>
          )}

          {/* ── CAPTAIN ── */}
          {role === 'CAPTAIN' && playerShip && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Captain Overview</h2>
              <ShipStatusPanel ship={playerShip} />
              <div className="card space-y-2">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stand By</h2>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                  Awaiting attack resolution.
                </div>
                <p className="text-gray-700 text-xs">
                  Leadership and tactical actions are taken in the Action Phase.
                </p>
              </div>
            </div>
          )}

          {/* ── ENGINEER ── */}
          {role === 'ENGINEER' && playerShip && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Engineer Overview</h2>
              <ShipStatusPanel ship={playerShip} />
              <div className="card space-y-2">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stand By</h2>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                  Awaiting attack resolution.
                </div>
                <p className="text-gray-700 text-xs">
                  Repair and engineering actions are taken in the Action Phase.
                </p>
              </div>
            </div>
          )}

          {/* ── MARINE / PASSENGER ── */}
          {(role === 'MARINE' || role === 'PASSENGER') && (
            <div className="card space-y-2">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stand By</h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                {role === 'MARINE'
                  ? 'Awaiting boarding or security actions in the Action Phase.'
                  : 'No actions available during the Attack Phase.'}
              </div>
            </div>
          )}

          {/* ── No role ── */}
          {!role && (
            <div className="card text-center py-8 text-gray-700 text-sm">
              No role confirmed. Return to the Setup page to select your role.
            </div>
          )}
        </>
      )}
    </div>
  );
}
