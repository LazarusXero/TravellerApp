import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi';
import { fmtSign, CriticalHitModal } from '../../components/combat/GunnerWeaponPanel';
import type { GunnerObject, GunnerRange, BoardingAction } from '../../components/combat/GunnerWeaponPanel';
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
  boarding: BoardingAction | null;
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5">
        {children}
      </div>
    </div>
  );
}

function FormulaRow({
  label,
  value,
  sub,
  last,
}: {
  label: string;
  value: string | number;
  sub?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-1.5 ${
        !last ? 'border-b border-gray-800/60' : ''
      }`}
    >
      <div>
        <span className="text-gray-400 text-sm">{label}</span>
        {sub && <p className="text-gray-700 text-xs mt-0.5">{sub}</p>}
      </div>
      <span className="font-mono text-gray-200 text-sm">{value}</span>
    </div>
  );
}

function EffectPreview({
  roll,
  setRoll,
  total,
  target,
}: {
  roll: number;
  setRoll: (n: number) => void;
  total: number;
  target: number;
}) {
  const effect = total - target;
  return (
    <>
      <div className="space-y-2">
        <p className="text-gray-400 text-sm">2D6 roll result:</p>
        <input
          type="number"
          min={2}
          max={12}
          value={roll}
          onChange={(e) => setRoll(Math.min(12, Math.max(2, parseInt(e.target.value) || 2)))}
          className="input w-full text-center text-xl font-mono"
        />
      </div>
      <div className="bg-gray-950 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider">Effect</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {total} vs {target}+
          </p>
        </div>
        <span
          className={`font-mono text-2xl font-bold ${
            effect >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {fmtSign(effect)}
        </span>
      </div>
    </>
  );
}

// ── NPC Improve Initiative Modal ──────────────────────────────────────────────

function NPCImproveInitiativeModal({
  ship,
  onDone,
  onClose,
}: {
  ship: GunnerObject;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [effect, setEffect] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const leaderDM = ship.leadership_skill_dm ?? 0;
  const socDM = ship.captain_soc_dm ?? 0;
  const target = 8;
  const total = roll + leaderDM + socDM;

  const handleConfirm = async () => {
    setSubmitting(true);
    const finalEffect = total - target;
    setEffect(finalEffect);
    await apiFetch(`/api/combat/object/${ship.id}/leadership-effect`, {
      method: 'PATCH',
      body: JSON.stringify({ effect: finalEffect }),
    });
    setSubmitting(false);
    setPhase('RESULT');
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Improve Initiative</h3>
        <p className="text-gray-500 text-xs mt-0.5">{ship.name}</p>
      </div>

      {phase === 'ROLLING' && (
        <>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            <FormulaRow label="Leadership DM" value={fmtSign(leaderDM)} />
            <FormulaRow label="SOC DM" value={fmtSign(socDM)} />
            <FormulaRow label="Target Number" value="8+" last />
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={target} />
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? 'Applying…' : 'Confirm Roll'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && (
        <>
          <div
            className={`rounded-xl p-5 text-center ${
              effect >= 0
                ? 'bg-emerald-900/30 border border-emerald-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}
          >
            <p className={`font-mono text-4xl font-bold mb-1 ${effect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtSign(effect)}
            </p>
            <p className={`text-sm font-semibold ${effect >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {effect >= 0
                ? `Initiative boosted by ${fmtSign(effect)} next round`
                : 'Failed — no effect'}
            </p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── NPC Repair Modal ──────────────────────────────────────────────────────────

function NPCRepairModal({
  ship,
  onDone,
  onClose,
}: {
  ship: GunnerObject;
  onDone: () => void;
  onClose: () => void;
}) {
  const activeHits = (ship.system_hits ?? []).filter((h) => !h.repaired && !h.beyond_repair);
  const [selectedSystem, setSelectedSystem] = useState<string>(activeHits[0]?.system_name ?? '');
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const engDM = ship.engineer_skill_dm ?? 0;
  const statBonus = ship.engineer_int_dm ?? 0;
  const hitData = ship.system_hits?.find((h) => h.system_name === selectedSystem && !h.repaired);
  const consecutive =
    ship.repair_progress?.find((p) => p.system_name === selectedSystem)?.consecutive_bonus ?? 0;

  const target = 8 + (hitData?.severity ?? 0);
  const total = roll + engDM + statBonus + consecutive;
  const effect = total - target;

  const handleConfirm = async () => {
    setSubmitting(true);
    // For NPC ships use character_id = 0 (NPC placeholder)
    await apiFetch(`/api/combat/object/${ship.id}/repair`, {
      method: 'POST',
      body: JSON.stringify({
        character_id: 0,
        system_name: selectedSystem,
        effect,
      }),
    });
    setResultMsg(
      effect >= 0
        ? `Repair successful — ${selectedSystem} restored.`
        : `Repair failed (Effect ${fmtSign(effect)}).`,
    );
    setSubmitting(false);
    setPhase('RESULT');
  };

  if (activeHits.length === 0) {
    return (
      <Overlay>
        <h3 className="text-lg font-bold text-gray-100">Repair System</h3>
        <p className="text-gray-500 text-sm">No repairable system hits on {ship.name}.</p>
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Repair System</h3>
        <p className="text-gray-500 text-xs mt-0.5">{ship.name}</p>
      </div>

      {phase === 'ROLLING' && (
        <>
          <div>
            <p className="text-gray-400 text-sm mb-1">System to Repair</p>
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="input w-full text-sm"
            >
              {activeHits.map((h) => (
                <option key={h.id} value={h.system_name}>
                  {h.system_name} (Sev {h.severity})
                </option>
              ))}
            </select>
          </div>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            <FormulaRow label="Engineer Skill DM" value={fmtSign(engDM)} />
            <FormulaRow label="INT DM" value={fmtSign(statBonus)} />
            {consecutive > 0 && (
              <FormulaRow label="Consecutive Bonus" value={fmtSign(consecutive)} />
            )}
            <FormulaRow
              label="Target Number"
              value={`${target}+`}
              sub={`Base 8 + Severity ${hitData?.severity ?? 0}`}
              last
            />
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={target} />
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting || !selectedSystem}
              className="btn-primary flex-1"
            >
              {submitting ? 'Applying…' : 'Confirm Roll'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && (
        <>
          <div
            className={`rounded-xl p-5 text-center ${
              effect >= 0
                ? 'bg-emerald-900/30 border border-emerald-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}
          >
            <p className={`font-mono text-4xl font-bold mb-1 ${effect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtSign(effect)}
            </p>
            <p className={`text-sm ${effect >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {resultMsg}
            </p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── NPC Overload Drive Modal ──────────────────────────────────────────────────

function NPCOverloadDriveModal({
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
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT' | 'CRIT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const engDM = ship.engineer_skill_dm ?? 0;
  const statBonus = ship.engineer_int_dm ?? 0;
  const overloadDM = ship.overload_drive_dm ?? 0;   // cumulative penalty from prior overloads
  const target = 10;

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll ? rollNum + engDM + statBonus + overloadDM - target : null;

  const handleConfirm = async () => {
    if (effect == null) return;
    setSubmitting(true);
    await apiFetch(`/api/combat/object/${ship.id}/overload-drive`, {
      method: 'PATCH',
      body: JSON.stringify({ success: effect >= 0, effect }),
    });
    if (effect <= -6) {
      setPhase('CRIT');
      return;
    }
    setResultMsg(
      effect >= 0
        ? `Drive overloaded — thrust increased next round (Effect ${fmtSign(effect)}).`
        : `Overload failed (Effect ${fmtSign(effect)}).`,
    );
    setSubmitting(false);
    setPhase('RESULT');
  };

  if (phase === 'CRIT') {
    return (
      <CriticalHitModal
        targetId={ship.id}
        targetName={ship.name}
        targetMounts={ship.weapon_mounts}
        targetCrewMembers={ship.crew_members}
        sessionId={sessionId}
        severity={1}
        lockedSystemName="M-Drive"
        onClose={onDone}
      />
    );
  }

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Overload Drive</h3>
        <p className="text-gray-500 text-xs mt-0.5">{ship.name}</p>
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
            <FormulaRow label="Engineer Skill DM" value={fmtSign(engDM)} />
            <FormulaRow label="INT DM" value={fmtSign(statBonus)} />
            {overloadDM !== 0 && (
              <FormulaRow
                label="Overload Penalty DM"
                value={fmtSign(overloadDM)}
                sub="Cumulative penalty from prior overload attempts this combat"
              />
            )}
            <FormulaRow label="Target Number" value="10+" last />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-gray-400 text-sm font-medium">Effect</span>
            <span className={`font-mono text-lg font-bold ${
              effect != null ? (effect >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-700'
            }`}>
              {effect != null ? fmtSign(effect) : '—'}
            </span>
          </div>
          <p className="text-red-500 text-xs">Effect ≤ −6 causes a Critical Hit on M-Drive (severity +1).</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting || effect == null}
              className="btn-primary flex-1"
            >
              {submitting ? 'Applying…' : 'Confirm Roll'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && (
        <>
          <div
            className={`rounded-xl p-5 text-center ${
              effect != null && effect >= 0
                ? 'bg-emerald-900/30 border border-emerald-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}
          >
            <p className={`font-mono text-4xl font-bold mb-1 ${effect != null && effect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {effect != null ? fmtSign(effect) : '—'}
            </p>
            <p className={`text-sm ${effect != null && effect >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {resultMsg}
            </p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── NPC Overload Power Modal ──────────────────────────────────────────────────

function NPCOverloadPowerModal({
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
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT' | 'CRIT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const engDM = ship.engineer_skill_dm ?? 0;
  const statBonus = ship.engineer_int_dm ?? 0;
  const overloadDM = ship.overload_power_dm ?? 0;   // cumulative penalty from prior overloads
  const target = 10;

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll ? rollNum + engDM + statBonus + overloadDM - target : null;

  const handleConfirm = async () => {
    if (effect == null) return;
    setSubmitting(true);
    await apiFetch(`/api/combat/object/${ship.id}/overload-power`, {
      method: 'PATCH',
      body: JSON.stringify({ success: effect >= 0, effect }),
    });
    if (effect <= -6) {
      setPhase('CRIT');
      return;
    }
    setResultMsg(
      effect >= 0
        ? `Power overloaded — power increased next round (Effect ${fmtSign(effect)}).`
        : `Overload failed (Effect ${fmtSign(effect)}).`,
    );
    setSubmitting(false);
    setPhase('RESULT');
  };

  if (phase === 'CRIT') {
    return (
      <CriticalHitModal
        targetId={ship.id}
        targetName={ship.name}
        targetMounts={ship.weapon_mounts}
        targetCrewMembers={ship.crew_members}
        sessionId={sessionId}
        severity={1}
        lockedSystemName="Power Plant"
        onClose={onDone}
      />
    );
  }

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Overload Power</h3>
        <p className="text-gray-500 text-xs mt-0.5">{ship.name}</p>
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
            <FormulaRow label="Engineer Skill DM" value={fmtSign(engDM)} />
            <FormulaRow label="INT DM" value={fmtSign(statBonus)} />
            {overloadDM !== 0 && (
              <FormulaRow
                label="Overload Penalty DM"
                value={fmtSign(overloadDM)}
                sub="Cumulative penalty from prior overload attempts this combat"
              />
            )}
            <FormulaRow label="Target Number" value="10+" last />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-gray-400 text-sm font-medium">Effect</span>
            <span className={`font-mono text-lg font-bold ${
              effect != null ? (effect >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-700'
            }`}>
              {effect != null ? fmtSign(effect) : '—'}
            </span>
          </div>
          <p className="text-red-500 text-xs">Effect ≤ −6 causes a Critical Hit on Power Plant (severity +1).</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting || effect == null}
              className="btn-primary flex-1"
            >
              {submitting ? 'Applying…' : 'Confirm Roll'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && (
        <>
          <div
            className={`rounded-xl p-5 text-center ${
              effect != null && effect >= 0
                ? 'bg-emerald-900/30 border border-emerald-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}
          >
            <p className={`font-mono text-4xl font-bold mb-1 ${effect != null && effect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {effect != null ? fmtSign(effect) : '—'}
            </p>
            <p className={`text-sm ${effect != null && effect >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{resultMsg}</p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── Boarding Resolution Modal (GM) ────────────────────────────────────────────

type BoardingOutcome =
  | 'ATTACKER_DEFEATED'
  | 'BOARDING_DEFEATED'
  | 'CONTINUES'
  | 'PACIFICATION_START'
  | 'OVERWHELMING_SUCCESS';

function GMBoardingResolutionModal({
  sessionId,
  boarding,
  objects,
  onDone,
  onClose,
}: {
  sessionId: number;
  boarding: BoardingAction;
  objects: GunnerObject[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [outcome, setOutcome] = useState<BoardingOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const attacker = objects.find((o) => o.id === boarding.attacker_object_id);
  const carryDM = boarding.carry_forward_dm ?? 0;
  const target = 8;
  const total = roll + carryDM;
  const effect = total - target;

  function effectToOutcome(e: number): BoardingOutcome {
    if (e <= -7) return 'ATTACKER_DEFEATED';
    if (e <= -4) return 'BOARDING_DEFEATED';
    if (e <= 3) return 'CONTINUES';
    if (e <= 6) return 'PACIFICATION_START';
    return 'OVERWHELMING_SUCCESS';
  }

  const previewOutcome = effectToOutcome(effect);

  const OUTCOME_LABELS: Record<BoardingOutcome, string> = {
    ATTACKER_DEFEATED: 'Boarding party routed — action ends',
    BOARDING_DEFEATED: 'Attackers driven back — action ends',
    CONTINUES: 'Inconclusive — boarding continues',
    PACIFICATION_START: 'Ship seized — pacification begins',
    OVERWHELMING_SUCCESS: 'Complete success — ship captured',
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    await apiFetch(`/api/combat/session/${sessionId}/boarding/resolve`, {
      method: 'POST',
      body: JSON.stringify({ boarding_result: effect }),
    });
    setOutcome(previewOutcome);
    setSubmitting(false);
    setPhase('RESULT');
  };

  const colorClass = (o: BoardingOutcome | null) => {
    if (!o) return 'bg-gray-900';
    if (o === 'OVERWHELMING_SUCCESS' || o === 'PACIFICATION_START')
      return 'bg-emerald-900/30 border-emerald-700/50';
    if (o === 'ATTACKER_DEFEATED' || o === 'BOARDING_DEFEATED')
      return 'bg-red-900/30 border-red-700/50';
    return 'bg-amber-900/20 border-amber-700/40';
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Boarding Resolution</h3>
        <p className="text-gray-500 text-xs mt-0.5">
          {attacker?.name ?? 'Attacker'} — Boarding check
        </p>
      </div>

      {phase === 'ROLLING' && (
        <>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            {carryDM !== 0 && (
              <FormulaRow label="Carry-Forward DM" value={fmtSign(carryDM)} />
            )}
            <FormulaRow label="2D6 vs 8+" value="" last />
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={target} />
          <div className={`px-3 py-2 rounded-lg border text-xs ${colorClass(previewOutcome)}`}>
            <span className="text-gray-300">Preview: </span>
            <span className="font-semibold">{OUTCOME_LABELS[previewOutcome]}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? 'Resolving…' : 'Confirm'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && outcome && (
        <>
          <div className={`rounded-xl p-5 text-center border ${colorClass(outcome)}`}>
            <p className="font-mono text-3xl font-bold mb-2">{fmtSign(effect)}</p>
            <p className="text-gray-200 font-semibold text-sm">{OUTCOME_LABELS[outcome]}</p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── NPC Sensor Lock Modal ─────────────────────────────────────────────────────

function NpcSensorLockModal({
  actingShip,
  objects,
  ranges,
  onDone,
  onClose,
}: {
  actingShip: GunnerObject;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  onDone: () => void;
  onClose: () => void;
}) {
  const targets = objects.filter(
    (o) => o.id !== actingShip.id && o.object_type === 'SHIP' && !o.is_destroyed,
  );
  const [targetId, setTargetId] = useState<number>(targets[0]?.id ?? 0);
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const skillDM = actingShip.sensor_op_skill_dm ?? -3;
  const intDM = actingShip.sensor_op_int_dm ?? 0;
  const sensorCheckDM = actingShip.sensor_check_dm ?? 0;

  const rangeBand = ranges.find(
    (r) =>
      (r.from_object_id === actingShip.id && r.to_object_id === targetId) ||
      (r.from_object_id === targetId && r.to_object_id === actingShip.id),
  )?.band ?? null;

  const RANGE_DIFFICULTY: Record<string, number> = {
    ADJACENT: 6, CLOSE: 6, SHORT: 8, MEDIUM: 10, LONG: 12, 'VERY LONG': 14, DISTANT: 16,
  };
  const difficulty = rangeBand ? (RANGE_DIFFICULTY[rangeBand] ?? 8) : 8;
  const total = roll + skillDM + intDM + sensorCheckDM;
  const effect = total - difficulty;

  const handleConfirm = async () => {
    setSubmitting(true);
    if (effect >= 0) {
      await apiFetch(`/api/combat/object/${actingShip.id}/sensor-lock`, {
        method: 'PATCH',
        body: JSON.stringify({ target_object_id: targetId, locked: true }),
      });
      const targetName = objects.find((o) => o.id === targetId)?.name ?? 'target';
      setResultMsg(`Sensor lock acquired on ${targetName} (Effect ${fmtSign(effect)}).`);
    } else {
      setResultMsg(`Failed to acquire sensor lock (Effect ${fmtSign(effect)}).`);
    }
    setSubmitting(false);
    setPhase('RESULT');
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Acquire Sensor Lock</h3>
        <p className="text-gray-500 text-xs mt-0.5">{actingShip.name}</p>
      </div>

      {phase === 'ROLLING' && (
        <>
          <div>
            <p className="text-gray-400 text-sm mb-1">Target</p>
            <select
              value={targetId}
              onChange={(e) => setTargetId(parseInt(e.target.value, 10))}
              className="input w-full text-sm"
            >
              {targets.map((o) => {
                const rb = ranges.find(
                  (r) =>
                    (r.from_object_id === actingShip.id && r.to_object_id === o.id) ||
                    (r.from_object_id === o.id && r.to_object_id === actingShip.id),
                )?.band;
                return (
                  <option key={o.id} value={o.id}>
                    {o.name}{rb ? ` (${rb})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            <FormulaRow label="Sensor Op Skill" value={fmtSign(skillDM)} />
            <FormulaRow label="INT DM" value={fmtSign(intDM)} />
            {sensorCheckDM !== 0 && (
              <FormulaRow label="Sensor Check DM" value={fmtSign(sensorCheckDM)} />
            )}
            <FormulaRow
              label="Target Number"
              value={`${difficulty}+`}
              sub={rangeBand ? `${rangeBand} range` : undefined}
              last
            />
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={difficulty} />
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting || targets.length === 0}
              className="btn-primary flex-1"
            >
              {submitting ? 'Applying…' : 'Confirm Roll'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && (
        <>
          <div
            className={`rounded-xl p-5 text-center ${
              effect >= 0
                ? 'bg-emerald-900/30 border border-emerald-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}
          >
            <p className={`font-mono text-4xl font-bold mb-1 ${effect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtSign(effect)}
            </p>
            <p className={`text-sm ${effect >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{resultMsg}</p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── NPC Jump Modal ────────────────────────────────────────────────────────────

function NPCJumpModal({
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
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'ASTROGATION' | 'ENGINEERING' | 'RESULT'>('ASTROGATION');
  const [navRoll, setNavRoll] = useState('');
  const [engRoll, setEngRoll] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'failure' | null>(null);

  // NPC ship stores pilot DM as proxy for Astrogation, engineer DM + INT DM for engineering
  const navDM = ship.pilot_skill_dm ?? -3;
  const engDM = ship.engineer_skill_dm ?? -3;
  const statBonus = ship.engineer_int_dm ?? 0;
  const jDriveDM = ship.j_drive_check_dm ?? 0;

  const navTarget = 8;
  const navRollNum = parseInt(navRoll, 10);
  const validNavRoll = !isNaN(navRollNum) && navRollNum >= 2 && navRollNum <= 12;
  const navEffect = validNavRoll ? navRollNum + navDM + statBonus - navTarget : null;

  const engTarget = 8;
  const engRollNum = parseInt(engRoll, 10);
  const validEngRoll = !isNaN(engRollNum) && engRollNum >= 2 && engRollNum <= 12;
  const engEffect = validEngRoll ? engRollNum + engDM + statBonus + jDriveDM - engTarget : null;

  const handleAstrogation = () => {
    if (navEffect == null) return;
    if (navEffect >= 0) setPhase('ENGINEERING');
    else { setOutcome('failure'); setPhase('RESULT'); }
  };

  const handleEngineering = async () => {
    if (engEffect == null) return;
    setSubmitting(true);
    if (engEffect >= 0) {
      await apiFetch(`/api/combat/session/${sessionId}/phase`, {
        method: 'PATCH',
        body: JSON.stringify({ phase: 'CLEANUP' }),
      });
      setOutcome('success');
    } else {
      setOutcome('failure');
    }
    setSubmitting(false);
    setPhase('RESULT');
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Execute Jump</h3>
        <p className="text-gray-600 text-xs mt-0.5">
          {phase === 'ASTROGATION'
            ? 'Step 1: Astrogation check'
            : phase === 'ENGINEERING'
            ? 'Step 2: Engineer (J-Drive) check'
            : 'Jump result'}
        </p>
        <p className="text-gray-700 text-xs mt-0.5">{ship.name}</p>
      </div>

      {phase === 'ASTROGATION' && (
        <>
          <div className="space-y-0">
            <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-800/60">
              <div>
                <span className="text-gray-400 text-sm">Roll 2D6</span>
                <p className="text-gray-700 text-xs mt-0.5">Enter your physical dice result</p>
              </div>
              <input
                type="number" min={2} max={12} value={navRoll}
                onChange={(e) => setNavRoll(e.target.value)}
                placeholder="2–12" className="input text-sm w-24 text-right"
              />
            </div>
            <FormulaRow
              label="Astrogation DM"
              value={fmtSign(navDM)}
              sub="(Pilot Skill as proxy)"
            />
            <FormulaRow label="INT DM" value={fmtSign(statBonus)} />
            <FormulaRow label="Target Number" value="8+" last />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-gray-400 text-sm font-medium">Effect</span>
            <span className={`font-mono text-lg font-bold ${
              navEffect != null ? (navEffect >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-700'
            }`}>
              {navEffect != null ? fmtSign(navEffect) : '—'}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleAstrogation}
              disabled={navEffect == null}
              className="btn-primary flex-1"
            >
              {navEffect != null && navEffect >= 0 ? 'Success → Engineering' : 'Fail (confirm)'}
            </button>
          </div>
        </>
      )}

      {phase === 'ENGINEERING' && (
        <>
          <div className="px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-700/40">
            <p className="text-emerald-400 text-xs">
              Astrogation passed (Effect {navEffect != null ? fmtSign(navEffect) : '—'}) — proceed to engineering check.
            </p>
          </div>
          <div className="space-y-0">
            <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-800/60">
              <div>
                <span className="text-gray-400 text-sm">Roll 2D6</span>
                <p className="text-gray-700 text-xs mt-0.5">Enter your physical dice result</p>
              </div>
              <input
                type="number" min={2} max={12} value={engRoll}
                onChange={(e) => setEngRoll(e.target.value)}
                placeholder="2–12" className="input text-sm w-24 text-right"
              />
            </div>
            <FormulaRow label="Engineer (J-Drive)" value={fmtSign(engDM)} />
            <FormulaRow label="INT DM" value={fmtSign(statBonus)} />
            {jDriveDM !== 0 && (
              <FormulaRow label="J-Drive Damage DM" value={fmtSign(jDriveDM)} />
            )}
            <FormulaRow label="Target Number" value="8+" last />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
            <span className="text-gray-400 text-sm font-medium">Effect</span>
            <span className={`font-mono text-lg font-bold ${
              engEffect != null ? (engEffect >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-700'
            }`}>
              {engEffect != null ? fmtSign(engEffect) : '—'}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleEngineering(); }}
              disabled={submitting || engEffect == null}
              className="btn-primary flex-1"
            >
              {submitting ? 'Applying…' : 'Confirm Engineering'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && (
        <>
          {outcome === 'success' ? (
            <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-5 text-center">
              <p className="text-emerald-400 font-bold text-lg">Jump Initiated!</p>
              <p className="text-emerald-300 text-sm mt-1">
                The ship is entering jumpspace. Combat ends.
              </p>
            </div>
          ) : (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-5 text-center">
              <p className="text-red-400 font-bold text-lg">Jump Failed</p>
              <p className="text-red-300 text-sm mt-1">
                The jump attempt failed. The ship remains in normal space.
              </p>
            </div>
          )}
          <button
            onClick={() => {
              if (outcome === 'success') navigate('/combat/resolution');
              else onDone();
            }}
            className="btn-primary w-full"
          >
            {outcome === 'success' ? 'Go to Combat Summary →' : 'Done'}
          </button>
        </>
      )}
    </Overlay>
  );
}

// ── NPC Ship Section ──────────────────────────────────────────────────────────

function NPCShipSection({
  ship,
  sessionId,
  boarding,
  objects,
  ranges,
  onRefresh,
}: {
  ship: GunnerObject;
  sessionId: number;
  boarding: BoardingAction | null;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  onRefresh: () => void;
}) {
  const [showImproveInit, setShowImproveInit] = useState(false);
  const [showRepair, setShowRepair] = useState(false);
  const [showOverloadDrive, setShowOverloadDrive] = useState(false);
  const [showOverloadPower, setShowOverloadPower] = useState(false);
  const [showBoardingResolution, setShowBoardingResolution] = useState(false);
  const [showSensorLock, setShowSensorLock] = useState(false);
  const [showJump, setShowJump] = useState(false);

  const shipBoarding =
    boarding != null &&
    (boarding.attacker_object_id === ship.id || boarding.defender_object_id === ship.id)
      ? boarding
      : null;

  const isAttacker = boarding?.attacker_object_id === ship.id;

  const hasRepairableHits =
    (ship.system_hits ?? []).filter((h) => !h.repaired && !h.beyond_repair).length > 0;

  const emptyMounts = (ship.weapon_mounts ?? []).filter((m) => m.ammo_status === 'Empty');
  const hasEmptyMounts = emptyMounts.length > 0;

  const handleReloadTurrets = async () => {
    await Promise.all(
      emptyMounts.map((m) =>
        apiFetch(`/api/combat/mount/${m.id}/ammo-status`, {
          method: 'PATCH',
          body: JSON.stringify({ ammo_status: 'Reloading' }),
        }),
      ),
    );
    onRefresh();
  };

  return (
    <div className="card space-y-4">
      {/* Ship header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-100">{ship.name}</h2>
          <p className="text-gray-600 text-xs mt-0.5">
            Hull {ship.hull_current ?? '—'}/{ship.hull_max ?? '—'} ·{' '}
            Thrust {ship.current_thrust ?? '—'}/{ship.adjusted_max_thrust ?? '—'} ·{' '}
            Initiative {ship.initiative ?? '—'}
          </p>
        </div>
        {ship.is_destroyed && (
          <span className="px-2 py-1 text-xs rounded-full bg-red-900/40 text-red-400 border border-red-700/50">
            Destroyed
          </span>
        )}
      </div>

      {/* Critical damage summary */}
      {(ship.system_hits ?? []).filter((h) => !h.repaired).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ship.system_hits
            .filter((h) => !h.repaired)
            .map((h) => (
              <span
                key={h.id}
                className="px-2 py-0.5 text-xs rounded bg-red-900/30 text-red-400 border border-red-800/50"
              >
                {h.system_name} Sev {h.severity}
                {h.beyond_repair && ' ✕'}
              </span>
            ))}
        </div>
      )}

      {/* Boarding status */}
      {shipBoarding && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-700/40">
          <span className="text-lg mt-0.5">⚔</span>
          <div className="space-y-0.5">
            <p className="text-red-300 font-semibold text-sm">
              {shipBoarding.phase === 'PACIFICATION' ? 'Pacification' : 'Boarding Resolution'} —{' '}
              {isAttacker ? 'Attacker' : 'Defender'}
            </p>
            {shipBoarding.carry_forward_dm !== 0 && (
              <p className="text-gray-500 text-xs">
                Carry-forward: {fmtSign(shipBoarding.carry_forward_dm)}
              </p>
            )}
            {shipBoarding.phase === 'PACIFICATION' && shipBoarding.pacification_timer != null && (
              <p className="text-amber-400 text-xs">
                Rounds to secure: {shipBoarding.pacification_timer}
                {shipBoarding.pacification_paused && ' · ⚠ Paused'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {!ship.is_destroyed && (
        <div className="space-y-2">
          <p className="text-xs text-gray-700 uppercase tracking-wider">Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">

            {/* Improve Initiative */}
            <button
              onClick={() => setShowImproveInit(true)}
              className="text-left px-3 py-2.5 rounded-xl border bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 transition-colors"
            >
              <p className="font-semibold text-xs text-gray-200">Improve Initiative</p>
              <p className="text-gray-700 text-xs mt-0.5">Leadership check</p>
            </button>

            {/* Repair */}
            <button
              onClick={() => setShowRepair(true)}
              disabled={!hasRepairableHits}
              className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                !hasRepairableHits
                  ? 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                  : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
              }`}
            >
              <p className="font-semibold text-xs text-gray-200">Repair System</p>
              <p className="text-gray-700 text-xs mt-0.5">Engineer check</p>
            </button>

            {/* Overload Drive */}
            <button
              onClick={() => setShowOverloadDrive(true)}
              className="text-left px-3 py-2.5 rounded-xl border bg-gray-900 border-gray-700 hover:border-amber-700/60 hover:bg-amber-900/10 transition-colors"
            >
              <p className="font-semibold text-xs text-amber-300">Overload Drive</p>
              <p className="text-gray-700 text-xs mt-0.5">
                {(ship.overload_drive_dm ?? 0) < 0
                  ? `DM ${fmtSign(ship.overload_drive_dm ?? 0)}`
                  : 'Push M-Drive'}
              </p>
            </button>

            {/* Overload Power */}
            <button
              onClick={() => setShowOverloadPower(true)}
              className="text-left px-3 py-2.5 rounded-xl border bg-gray-900 border-gray-700 hover:border-amber-700/60 hover:bg-amber-900/10 transition-colors"
            >
              <p className="font-semibold text-xs text-amber-300">Overload Power</p>
              <p className="text-gray-700 text-xs mt-0.5">
                {(ship.overload_power_dm ?? 0) < 0
                  ? `DM ${fmtSign(ship.overload_power_dm ?? 0)}`
                  : 'Push Power Plant'}
              </p>
            </button>

            {/* Reload Turret */}
            <button
              onClick={() => { void handleReloadTurrets(); }}
              disabled={!hasEmptyMounts}
              className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                !hasEmptyMounts
                  ? 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                  : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
              }`}
            >
              <p className={`font-semibold text-xs ${hasEmptyMounts ? 'text-gray-200' : 'text-gray-600'}`}>
                Reload Turret{emptyMounts.length > 1 ? 's' : ''}
              </p>
              <p className="text-gray-700 text-xs mt-0.5">
                {hasEmptyMounts
                  ? `${emptyMounts.length} mount${emptyMounts.length > 1 ? 's' : ''} empty`
                  : 'No empty mounts'}
              </p>
            </button>

            {/* Sensor Lock */}
            <button
              onClick={() => setShowSensorLock(true)}
              disabled={ship.ew_used}
              className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                ship.ew_used
                  ? 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                  : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-nexus-900/10 cursor-pointer'
              }`}
            >
              <p className={`font-semibold text-xs ${ship.ew_used ? 'text-gray-600' : 'text-nexus-300'}`}>
                Sensor Lock
              </p>
              <p className="text-gray-700 text-xs mt-0.5">
                {ship.ew_used ? 'EW used this round' : 'Electronics (Sensors) check'}
              </p>
            </button>

            {/* Execute Jump */}
            {ship.j_drive_status !== 'Destroyed' && ship.j_drive_status !== 'Disabled' && (
              <button
                onClick={() => setShowJump(true)}
                className="text-left px-3 py-2.5 rounded-xl border bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 transition-colors"
              >
                <p className="font-semibold text-xs text-gray-200">Execute Jump</p>
                <p className="text-gray-700 text-xs mt-0.5">Astrogation + Engineer (J-Drive)</p>
              </button>
            )}
          </div>

          {/* Boarding resolve button */}
          {shipBoarding && shipBoarding.phase === 'RESOLUTION' && isAttacker && (
            <button
              onClick={() => setShowBoardingResolution(true)}
              className="w-full text-left px-4 py-3 rounded-xl border bg-gray-900 border-red-700/50 hover:border-red-500 hover:bg-red-900/10 transition-colors mt-2"
            >
              <p className="font-semibold text-sm text-red-300">Resolve Boarding</p>
              <p className="text-gray-600 text-xs mt-0.5">Roll to determine boarding outcome</p>
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showImproveInit && (
        <NPCImproveInitiativeModal
          ship={ship}
          onDone={() => { setShowImproveInit(false); onRefresh(); }}
          onClose={() => setShowImproveInit(false)}
        />
      )}

      {showRepair && (
        <NPCRepairModal
          ship={ship}
          onDone={() => { setShowRepair(false); onRefresh(); }}
          onClose={() => setShowRepair(false)}
        />
      )}

      {showOverloadDrive && (
        <NPCOverloadDriveModal
          sessionId={sessionId}
          ship={ship}
          onDone={() => { setShowOverloadDrive(false); onRefresh(); }}
          onClose={() => setShowOverloadDrive(false)}
        />
      )}

      {showOverloadPower && (
        <NPCOverloadPowerModal
          sessionId={sessionId}
          ship={ship}
          onDone={() => { setShowOverloadPower(false); onRefresh(); }}
          onClose={() => setShowOverloadPower(false)}
        />
      )}

      {showBoardingResolution && shipBoarding && (
        <GMBoardingResolutionModal
          sessionId={sessionId}
          boarding={shipBoarding}
          objects={[]}
          onDone={() => { setShowBoardingResolution(false); onRefresh(); }}
          onClose={() => setShowBoardingResolution(false)}
        />
      )}

      {showSensorLock && (
        <NpcSensorLockModal
          actingShip={ship}
          objects={objects}
          ranges={ranges}
          onDone={() => { setShowSensorLock(false); onRefresh(); }}
          onClose={() => setShowSensorLock(false)}
        />
      )}

      {showJump && (
        <NPCJumpModal
          sessionId={sessionId}
          ship={ship}
          onDone={() => { setShowJump(false); onRefresh(); }}
          onClose={() => setShowJump(false)}
        />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GMCombatAction() {
  const navigate = useNavigate();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [showPlayerShipStatus, setShowPlayerShipStatus] = useState(false);

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

  const refresh = useCallback(() => {
    if (gameId) void loadSession(gameId);
  }, [gameId, loadSession]);

  const handleAdvance = async () => {
    if (!session) return;
    setAdvancing(true);

    // Clear round-specific localStorage keys before cleanup
    const sid = session.id;
    localStorage.removeItem(`combat_aid_gunner_${sid}`);
    // Initiative keys — Pilot and Captain get fresh rolls next round
    localStorage.removeItem(`combat_initiative_support_${sid}`);
    // Sweep all per-character initiative keys for this session
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key && (
          key.startsWith(`combat_npc_aid_gunner_${sid}_`) ||
          key.startsWith(`combat_initiative_${sid}_`)
        )
      ) {
        localStorage.removeItem(key);
      }
    }

    // Run round-end cleanup (resets initiative, reloads ammo, ticks missile salvos, etc.)
    await apiFetch(`/api/combat/session/${session.id}/cleanup`, {
      method: 'PATCH',
    });

    setAdvancing(false);
    navigate('/combat/initiative');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Action / Reaction</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const npcShips = session.objects
    .filter((o) => !o.is_player_ship && o.object_type === 'SHIP')
    .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));

  const playerShip = session.objects.find((o) => o.is_player_ship) ?? null;
  const boarding = session.boarding ?? null;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
          <h1 className="text-2xl font-bold text-gray-100">Action / Reaction</h1>
          <p className="text-gray-500 text-sm mt-1">
            {session.name} · Round {session.current_round} · Phase: {session.current_phase}
          </p>
        </div>
      </div>

      {/* Player ship status (collapsible) */}
      {playerShip && (
        <div className="card space-y-3">
          <button
            onClick={() => setShowPlayerShipStatus((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Player Ship — {playerShip.name}
            </p>
            <span className="text-gray-600 text-xs">
              {showPlayerShipStatus ? '▲ Hide' : '▼ Status'}
            </span>
          </button>
          {showPlayerShipStatus && (
            <ShipStatusPanel ship={playerShip} boarding={boarding} />
          )}
        </div>
      )}

      {/* Active boarding banner (if NPC is attacker/defender but not shown in their section) */}
      {boarding && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-900/20 border border-red-700/40">
          <span className="text-xl mt-0.5">⚔</span>
          <div>
            <p className="text-red-300 font-semibold text-sm">
              Active Boarding Action — {boarding.phase}
            </p>
            <p className="text-gray-600 text-xs mt-0.5">
              Attacker obj #{boarding.attacker_object_id} vs Defender obj #{boarding.defender_object_id}
              {boarding.carry_forward_dm !== 0 && ` · Carry DM ${fmtSign(boarding.carry_forward_dm)}`}
            </p>
          </div>
        </div>
      )}

      {/* NPC ship sections */}
      {npcShips.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-gray-600 text-sm">No NPC ships in this session.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {npcShips.map((ship) => (
            <NPCShipSection
              key={ship.id}
              ship={ship}
              sessionId={session.id}
              boarding={boarding}
              objects={session.objects}
              ranges={session.ranges}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Phase advance */}
      <div className="border-t border-gray-800 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-gray-300 font-semibold text-sm">End Action Phase</p>
            <p className="text-gray-600 text-xs mt-0.5">
              Run round-end cleanup and begin next round's Initiative Phase.
            </p>
          </div>
          <button
            onClick={() => { void handleAdvance(); }}
            disabled={advancing}
            className="btn-primary shrink-0"
          >
            {advancing ? 'Advancing…' : 'End Round / Next Round →'}
          </button>
        </div>
      </div>

    </div>
  );
}
