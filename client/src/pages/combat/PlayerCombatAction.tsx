import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../hooks/useApi';
import {
  statDM,
  fmtSign,
  CriticalHitModal,
} from '../../components/combat/GunnerWeaponPanel';
import type {
  GunnerObject,
  GunnerRange,
  BoardingAction,
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
  boarding: BoardingAction | null;
}

interface CharacterCombatRoleRecord {
  role: string;
  mount_id: number | null;
  confirmed: boolean;
}

interface RoleRecord {
  role: string;
  mount_id: number | null;
  confirmed: boolean;
  character: { id: number; name: string };
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

// ── Skill helpers ─────────────────────────────────────────────────────────────

function getBestSkillDM(character: Character, keyword: string): number {
  const matches = character.character_skills.filter(
    (s) => s.skillName.startsWith(keyword) || s.skillName.includes(keyword),
  );
  if (matches.length === 0) return -3;
  return matches.reduce((best, s) => Math.max(best, s.level ?? -3), -3);
}

function getBestPilotSkillDM(character: Character): number {
  return getBestSkillDM(character, 'Pilot');
}


function getBestSensorSkillDM(character: Character): number {
  const s = character.character_skills.find(
    (sk) =>
      sk.skillName === 'Electronics (Sensors)' ||
      sk.skillName === 'Electronics(Sensors)' ||
      sk.skillName.includes('Sensors'),
  );
  return s?.level ?? -3;
}

function getLeadershipSkillDM(character: Character): number {
  const s = character.character_skills.find(
    (sk) => sk.skillName === 'Leadership' || sk.skillName.includes('Leadership'),
  );
  return s?.level ?? -3;
}

function getEngineerSkillDM(character: Character, keyword = ''): number {
  if (keyword) {
    const specific = character.character_skills.find(
      (sk) => sk.skillName.includes('Engineer') && sk.skillName.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (specific) return specific.level ?? -3;
  }
  return getBestSkillDM(character, 'Engineer');
}

function getEngineerSkillLabel(character: Character): string {
  const best = character.character_skills
    .filter((s) => s.skillName.startsWith('Engineer') || s.skillName.includes('Engineer'))
    .reduce<CharacterSkill | null>(
      (b, s) => (!b || (s.level ?? -3) > (b.level ?? -3) ? s : b),
      null,
    );
  return best?.skillName ?? 'Engineer';
}

function getNavigationSkillDM(character: Character): number {
  const s = character.character_skills.find(
    (sk) =>
      sk.skillName === 'Astrogation' ||
      sk.skillName.includes('Astrogation') ||
      sk.skillName.includes('Navigation'),
  );
  return s?.level ?? -3;
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

// ── Improve Initiative Modal ──────────────────────────────────────────────────

function ImproveInitiativeModal({
  ship,
  character,
  onDone,
  onClose,
}: {
  ship: GunnerObject;
  character: Character;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [effect, setEffect] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const leaderDM = getLeadershipSkillDM(character);
  const socDM = statDM(character.soc);
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
        <p className="text-gray-600 text-xs mt-0.5">
          Leadership check to boost next round's initiative.
        </p>
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
              {effect >= 0 ? `Initiative boosted by ${fmtSign(effect)} next round` : 'Failed — no effect'}
            </p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── Repair System Modal ───────────────────────────────────────────────────────

function RepairSystemModal({
  ship,
  character,
  onDone,
  onClose,
}: {
  ship: GunnerObject;
  character: Character;
  onDone: () => void;
  onClose: () => void;
}) {
  const activeHits = (ship.system_hits ?? []).filter((h) => !h.repaired && !h.beyond_repair);
  const [selectedSystem, setSelectedSystem] = useState<string>(activeHits[0]?.system_name ?? '');
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const engDM = getEngineerSkillDM(character);
  const engLabel = getEngineerSkillLabel(character);
  const intDM = statDM(character.int);
  const eduDM = statDM(character.edu);
  const statBonus = Math.max(intDM, eduDM);

  const hitData = ship.system_hits?.find(
    (h) => h.system_name === selectedSystem && !h.repaired,
  );
  const consecutive =
    ship.repair_progress?.find(
      (p) => p.character_id === character.id && p.system_name === selectedSystem,
    )?.consecutive_bonus ?? 0;

  const target = 8 + (hitData?.severity ?? 0);
  const total = roll + engDM + statBonus + consecutive;
  const previewEffect = total - target;

  const handleConfirm = async () => {
    setSubmitting(true);
    await apiFetch(`/api/combat/object/${ship.id}/repair`, {
      method: 'POST',
      body: JSON.stringify({
        character_id: character.id,
        system_name: selectedSystem,
        effect: total - target,
      }),
    });
    if (total - target >= 0) {
      setResultMsg(`Repair successful — ${selectedSystem} restored.`);
    } else {
      setResultMsg(`Repair failed (Effect ${fmtSign(total - target)}) — bonus accumulated for next attempt.`);
    }
    setSubmitting(false);
    setPhase('RESULT');
  };

  if (activeHits.length === 0) {
    return (
      <Overlay>
        <h3 className="text-lg font-bold text-gray-100">Repair System</h3>
        <p className="text-gray-500 text-sm">No repairable system hits on this ship.</p>
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Repair System</h3>
        <p className="text-gray-600 text-xs mt-0.5">Engineer check to repair a critical hit.</p>
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
            <FormulaRow label={engLabel} value={fmtSign(engDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
            {consecutive > 0 && (
              <FormulaRow label="Consecutive Attempt Bonus" value={fmtSign(consecutive)} />
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
              (total - target) >= 0
                ? 'bg-emerald-900/30 border border-emerald-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}
          >
            <p className={`font-mono text-4xl font-bold mb-1 ${(total - target) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtSign(previewEffect)}
            </p>
            <p className={`text-sm ${(total - target) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {resultMsg}
            </p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
}

// ── Overload Drive Modal ──────────────────────────────────────────────────────

function OverloadDriveModal({
  sessionId,
  ship,
  character,
  onDone,
  onClose,
}: {
  sessionId: number;
  ship: GunnerObject;
  character: Character;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState('');
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT' | 'CRIT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const engDM = getEngineerSkillDM(character, 'Drive') || getEngineerSkillDM(character);
  const intDM = statDM(character.int);
  const eduDM = statDM(character.edu);
  const statBonus = Math.max(intDM, eduDM);
  const overloadDM = ship.overload_drive_dm ?? 0;   // cumulative penalty from prior overloads
  const target = 10;

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll ? rollNum + engDM + statBonus + overloadDM - target : null;

  const handleConfirm = async () => {
    if (effect == null) return;
    setSubmitting(true);
    const res = await apiFetch<{ success: boolean }>(`/api/combat/object/${ship.id}/overload-drive`, {
      method: 'PATCH',
      body: JSON.stringify({ success: effect >= 0, effect }),
    });
    if (res.success) {
      if (effect <= -6) {
        setPhase('CRIT');
        return;
      }
      if (effect >= 0) {
        setResultMsg(`Overload successful — thrust increased next round (Effect ${fmtSign(effect)}).`);
      } else {
        setResultMsg(`Overload failed (Effect ${fmtSign(effect)}).`);
      }
    }
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
        <p className="text-gray-600 text-xs mt-0.5">
          Engineer check to push the manoeuvre drive beyond rated output.
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
            <FormulaRow label="Engineer (M-Drive)" value={fmtSign(engDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
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

// ── Overload Power Modal ──────────────────────────────────────────────────────

function OverloadPowerModal({
  sessionId,
  ship,
  character,
  onDone,
  onClose,
}: {
  sessionId: number;
  ship: GunnerObject;
  character: Character;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState('');
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT' | 'CRIT'>('ROLLING');
  const [resultMsg, setResultMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const engDM = getEngineerSkillDM(character, 'Power') || getEngineerSkillDM(character);
  const intDM = statDM(character.int);
  const eduDM = statDM(character.edu);
  const statBonus = Math.max(intDM, eduDM);
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
    if (effect >= 0) {
      setResultMsg(`Power overloaded — power increased next round (Effect ${fmtSign(effect)}).`);
    } else {
      setResultMsg(`Overload failed (Effect ${fmtSign(effect)}).`);
    }
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
        <p className="text-gray-600 text-xs mt-0.5">
          Engineer check to push the power plant beyond rated output.
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
            <FormulaRow label="Engineer (Power Plant)" value={fmtSign(engDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
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

// ── Jump Modal ────────────────────────────────────────────────────────────────

function JumpModal({
  sessionId,
  ship,
  character,
  onDone,
  onClose,
}: {
  sessionId: number;
  ship: GunnerObject;
  character: Character;
  onDone: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'ASTROGATION' | 'ENGINEERING' | 'RESULT'>('ASTROGATION');
  const [navRoll, setNavRoll] = useState('');
  const [engRoll, setEngRoll] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'failure' | null>(null);

  const navDM = getNavigationSkillDM(character);
  const engDM = getEngineerSkillDM(character, 'J-Drive') || getEngineerSkillDM(character);
  const intDM = statDM(character.int);
  const eduDM = statDM(character.edu);
  const statBonus = Math.max(intDM, eduDM);
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
          {phase === 'ASTROGATION' ? 'Step 1: Astrogation check' : phase === 'ENGINEERING' ? 'Step 2: Engineer (J-Drive) check' : 'Jump result'}
        </p>
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
            <FormulaRow label="Astrogation DM" value={fmtSign(navDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
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
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
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

// ── Boarding Setup Modal ──────────────────────────────────────────────────────

function BoardingSetupModal({
  sessionId,
  playerShip,
  objects,
  onDone,
  onClose,
}: {
  sessionId: number;
  playerShip: GunnerObject;
  objects: GunnerObject[];
  onDone: () => void;
  onClose: () => void;
}) {
  const targets = objects.filter(
    (o) => o.id !== playerShip.id && o.object_type === 'SHIP' && !o.is_destroyed,
  );
  const [targetId, setTargetId] = useState<number>(targets[0]?.id ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = async () => {
    if (!targetId) return;
    setSubmitting(true);
    await apiFetch(`/api/combat/session/${sessionId}/boarding/start`, {
      method: 'POST',
      body: JSON.stringify({
        attacker_object_id: playerShip.id,
        defender_object_id: targetId,
      }),
    });
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    const target = objects.find((o) => o.id === targetId);
    return (
      <Overlay>
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-5 text-center">
          <p className="text-emerald-400 font-bold">Boarding Action Initiated</p>
          <p className="text-emerald-300 text-sm mt-1">
            Boarding {target?.name ?? 'target'} — first resolution next action phase.
          </p>
        </div>
        <button onClick={onDone} className="btn-primary w-full">Done</button>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Initiate Boarding</h3>
        <p className="text-gray-600 text-xs mt-0.5">
          Your marines will board and attempt to seize the target vessel.
        </p>
      </div>

      {targets.length === 0 ? (
        <p className="text-gray-500 text-sm">No valid targets in range.</p>
      ) : (
        <>
          <div>
            <p className="text-gray-400 text-sm mb-1">Target Ship</p>
            <select
              value={targetId}
              onChange={(e) => setTargetId(parseInt(e.target.value, 10))}
              className="input w-full text-sm"
            >
              {targets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40">
            <p className="text-amber-400 text-xs">
              Boarding requires being at ADJACENT range. Ensure you have moved alongside the target this manoeuvre phase.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting || !targetId}
              className="btn-primary flex-1"
            >
              {submitting ? 'Starting…' : 'Initiate Boarding'}
            </button>
          </div>
        </>
      )}
      {targets.length === 0 && (
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      )}
    </Overlay>
  );
}

// ── Boarding Resolution Modal ─────────────────────────────────────────────────

type BoardingOutcome =
  | 'ATTACKER_DEFEATED'
  | 'BOARDING_DEFEATED'
  | 'CONTINUES'
  | 'PACIFICATION_START'
  | 'OVERWHELMING_SUCCESS';

function BoardingResolutionModal({
  sessionId,
  boarding,
  character,
  onDone,
  onClose,
}: {
  sessionId: number;
  boarding: BoardingAction;
  character: Character;
  onDone: () => void;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [outcome, setOutcome] = useState<BoardingOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tacticsDM = getBestSkillDM(character, 'Tactics');
  const intDM = statDM(character.int);
  const carryDM = boarding.carry_forward_dm ?? 0;
  const target = 8;
  const total = roll + tacticsDM + intDM + carryDM;
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
    CONTINUES: 'Inconclusive — boarding continues next round',
    PACIFICATION_START: 'Ship seized — pacification phase begins',
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

  const outcomeColor = (o: BoardingOutcome | null) => {
    if (!o) return 'bg-gray-900';
    if (o === 'OVERWHELMING_SUCCESS' || o === 'PACIFICATION_START') return 'bg-emerald-900/30 border-emerald-700/50';
    if (o === 'ATTACKER_DEFEATED' || o === 'BOARDING_DEFEATED') return 'bg-red-900/30 border-red-700/50';
    return 'bg-amber-900/20 border-amber-700/40';
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Boarding Resolution</h3>
        <p className="text-gray-600 text-xs mt-0.5">
          Tactics + INT check to resolve boarding action.
        </p>
      </div>

      {phase === 'ROLLING' && (
        <>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            <FormulaRow label="Tactics DM" value={fmtSign(tacticsDM)} />
            <FormulaRow label="INT DM" value={fmtSign(intDM)} />
            {carryDM !== 0 && (
              <FormulaRow label="Carry-Forward DM" value={fmtSign(carryDM)} />
            )}
            <FormulaRow label="Target Number" value="8+" last />
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={target} />
          <div className={`px-3 py-2 rounded-lg border text-xs ${outcomeColor(previewOutcome)}`}>
            <span className="text-gray-300">Preview: </span>
            <span className="font-semibold">
              {OUTCOME_LABELS[previewOutcome]}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? 'Resolving…' : 'Confirm Roll'}
            </button>
          </div>
        </>
      )}

      {phase === 'RESULT' && outcome && (
        <>
          <div className={`rounded-xl p-5 text-center border ${outcomeColor(outcome)}`}>
            <p className="font-mono text-3xl font-bold mb-2">{fmtSign(effect)}</p>
            <p className="text-gray-200 font-semibold text-sm">{OUTCOME_LABELS[outcome]}</p>
          </div>
          <button onClick={onDone} className="btn-primary w-full">Done</button>
        </>
      )}
    </Overlay>
  );
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

// ── Aid Gunner Modal ──────────────────────────────────────────────────────────

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
    <Overlay>
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
            <FormulaRow label="+ Pilot Skill DM" value={fmtSign(pilotDM)} />
            <FormulaRow label="− 8 (task difficulty)" value="−8" last />
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
    </Overlay>
  );
}

// ── Evasive Action Modal ──────────────────────────────────────────────────────

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
      <Overlay>
        <h3 className="text-lg font-bold text-gray-100">Evasive Action</h3>
        <p className="text-red-400 text-sm">No thrust remaining — cannot take evasive action.</p>
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Evasive Action</h3>
        <p className="text-gray-600 text-xs mt-0.5">Spend thrust to impose a penalty on enemy attack rolls.</p>
      </div>
      <div className="bg-gray-950 rounded-xl p-4 space-y-0">
        <FormulaRow label="Available Thrust" value={maxThrust} />
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
    </Overlay>
  );
}

// ── Sensor Operator: Jam Communications Modal ────────────────────────────────

function JamCommsModal({
  actingShip,
  objects,
  sensorDM,
  intDM,
  eduDM,
  onDone,
  onClose,
}: {
  actingShip: GunnerObject;
  objects: GunnerObject[];
  sensorDM: number;
  intDM: number;
  eduDM: number;
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

  const statBonus = Math.max(intDM, eduDM);
  const total = roll + sensorDM + statBonus;
  const effect = total - 8;
  const targetName = objects.find((o) => o.id === targetId)?.name ?? 'target';

  const handleConfirm = async () => {
    setSubmitting(true);
    if (effect >= 0) {
      await apiFetch(`/api/combat/object/${actingShip.id}/jam-comms`, {
        method: 'PATCH',
        body: JSON.stringify({ target_object_id: targetId }),
      });
      setResultMsg(`${targetName}'s communications jammed (Effect ${fmtSign(effect)}).`);
    } else {
      setResultMsg(`Jamming attempt failed (Effect ${fmtSign(effect)}).`);
    }
    setSubmitting(false);
    setPhase('RESULT');
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Jam Communications</h3>
        <p className="text-gray-600 text-xs mt-0.5">Electronics (Sensors) check to disrupt target comms.</p>
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
              {targets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            <FormulaRow label="Electronics (Sensors)" value={fmtSign(sensorDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
            <FormulaRow label="Target Number" value="8+" last />
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={8} />
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

// ── Sensor Operator: EW vs Missiles Modal ─────────────────────────────────────

function EWMissilesModal({
  actingShip,
  salvos,
  sensorDM,
  intDM,
  eduDM,
  onDone,
  onClose,
}: {
  actingShip: GunnerObject;
  salvos: GunnerObject[];
  sensorDM: number;
  intDM: number;
  eduDM: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const [salvoId, setSalvoId] = useState<number>(salvos[0]?.id ?? 0);
  const [roll, setRoll] = useState(7);
  const [phase, setPhase] = useState<'ROLLING' | 'RESULT'>('ROLLING');
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const statBonus = Math.max(intDM, eduDM);
  const total = roll + sensorDM + statBonus;
  const effect = total - 8;
  const reduction = effect >= 0 ? Math.max(1, effect) : 0;

  const handleConfirm = async () => {
    setSubmitting(true);
    await apiFetch(`/api/combat/object/${actingShip.id}/sensor-lock`, {
      method: 'PATCH',
      body: JSON.stringify({ target_object_id: salvoId, locked: false }),
    });
    if (effect >= 0) {
      setResultMsg(
        `EW jamming effective — reduces incoming salvo by ${reduction} missile${reduction !== 1 ? 's' : ''} (Effect ${fmtSign(effect)}).`,
      );
    } else {
      setResultMsg(`EW jamming failed (Effect ${fmtSign(effect)}). No reduction.`);
    }
    setSubmitting(false);
    setPhase('RESULT');
  };

  return (
    <Overlay>
      <div>
        <h3 className="text-lg font-bold text-gray-100">EW vs Missiles</h3>
        <p className="text-gray-600 text-xs mt-0.5">
          Electronic warfare to reduce incoming missile salvo effectiveness.
        </p>
      </div>

      {phase === 'ROLLING' && (
        <>
          <div>
            <p className="text-gray-400 text-sm mb-1">Incoming Salvo</p>
            <select
              value={salvoId}
              onChange={(e) => setSalvoId(parseInt(e.target.value, 10))}
              className="input w-full text-sm"
            >
              {salvos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.missile_quantity ?? 0} missiles)
                </option>
              ))}
            </select>
          </div>
          <div className="bg-gray-950 rounded-xl p-4 space-y-0">
            <FormulaRow label="Electronics (Sensors)" value={fmtSign(sensorDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
            <FormulaRow label="Target Number" value="8+" last />
          </div>
          <div className="bg-gray-950 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Missiles Reduced</p>
              <p className="text-gray-400 text-xs mt-0.5">{total} vs 8+</p>
            </div>
            <span className={`font-mono text-2xl font-bold ${effect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {effect >= 0 ? `-${reduction}` : '0'}
            </span>
          </div>
          <EffectPreview roll={roll} setRoll={setRoll} total={total} target={8} />
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { void handleConfirm(); }}
              disabled={submitting || salvos.length === 0}
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

// ── Sensor Lock Modal ─────────────────────────────────────────────────────────

function SensorLockModal({
  actingShip,
  objects,
  ranges,
  sensorDM,
  intDM,
  eduDM,
  onDone,
  onClose,
}: {
  actingShip: GunnerObject;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  sensorDM: number;
  intDM: number;
  eduDM: number;
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

  const statBonus = Math.max(intDM, eduDM);
  const target = objects.find((o) => o.id === targetId);
  const rangeBand =
    ranges.find(
      (r) =>
        (r.from_object_id === actingShip.id && r.to_object_id === targetId) ||
        (r.from_object_id === targetId && r.to_object_id === actingShip.id),
    )?.band ?? null;

  const RANGE_DIFFICULTY: Record<string, number> = {
    ADJACENT: 6, CLOSE: 6, SHORT: 8, MEDIUM: 10, LONG: 12, 'VERY LONG': 14, DISTANT: 16,
  };
  const difficulty = rangeBand ? (RANGE_DIFFICULTY[rangeBand] ?? 8) : 8;
  const sensorCheckDM = actingShip.sensor_check_dm ?? 0;
  const total = roll + sensorDM + statBonus + sensorCheckDM;
  const effect = total - difficulty;

  const handleConfirm = async () => {
    setSubmitting(true);
    if (effect >= 0) {
      await apiFetch(`/api/combat/object/${actingShip.id}/sensor-lock`, {
        method: 'PATCH',
        body: JSON.stringify({ target_object_id: targetId, locked: true }),
      });
      setResultMsg(`Sensor lock acquired on ${target?.name ?? 'target'} (Effect ${fmtSign(effect)}).`);
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
        <p className="text-gray-600 text-xs mt-0.5">Electronics (Sensors) check.</p>
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
            <FormulaRow label="Electronics (Sensors)" value={fmtSign(sensorDM)} />
            <FormulaRow
              label="MAX(INT, EDU) DM"
              value={fmtSign(statBonus)}
              sub={`INT ${fmtSign(intDM)} / EDU ${fmtSign(eduDM)}`}
            />
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

// ── Main Component ────────────────────────────────────────────────────────────

export function PlayerCombatAction() {
  const { player } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterId, setCharacterId] = useState<number>(0);
  const [role, setRole] = useState<string | null>(null);
  const [mountId, setMountId] = useState<number | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [allRoles, setAllRoles] = useState<RoleRecord[]>([]);

  // Modal state — Captain
  const [showImproveInit, setShowImproveInit] = useState(false);
  const [showBoardingSetup, setShowBoardingSetup] = useState(false);
  const [initiativeUsed, setInitiativeUsed] = useState(false);

  // Modal state — Engineer
  const [showRepair, setShowRepair] = useState(false);
  const [showOverloadDrive, setShowOverloadDrive] = useState(false);
  const [showOverloadPower, setShowOverloadPower] = useState(false);
  const [showJump, setShowJump] = useState(false);

  // Modal state — Pilot
  const [aidGunnerUsed, setAidGunnerUsed] = useState(false);
  const [evasiveUsed, setEvasiveUsed] = useState(false);
  const [evasivePenalty, setEvasivePenalty] = useState<number | null>(null);
  const [showAidGunner, setShowAidGunner] = useState(false);
  const [showEvasive, setShowEvasive] = useState(false);

  // Modal state — Sensor Operator
  const [ewUsed, setEwUsed] = useState(false);
  const [showSensorLock, setShowSensorLock] = useState(false);
  const [showJamComms, setShowJamComms] = useState(false);
  const [showEWMissiles, setShowEWMissiles] = useState(false);

  // Modal state — Marine
  const [showBoardingResolution, setShowBoardingResolution] = useState(false);
  const [showMarineBoardingSetup, setShowMarineBoardingSetup] = useState(false);

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

  // Fetch all roles (for Captain crew list)
  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await apiFetch<RoleRecord[]>(`/api/combat/session/${session.id}/roles`);
      if (res.success && res.data) setAllRoles(res.data);
    })();
  }, [session?.id]);

  // Restore localStorage flags
  useEffect(() => {
    if (!session) return;
    setAidGunnerUsed(localStorage.getItem(`combat_aid_gunner_${session.id}`) !== null);
    const storedEvasive = localStorage.getItem(`combat_evasive_${session.id}`);
    setEvasiveUsed(storedEvasive !== null);
    setEvasivePenalty(storedEvasive !== null ? parseInt(storedEvasive, 10) : null);
  }, [session?.id]);

  // Detect GM end-of-round: when phase leaves ACTION → go to Initiative Phase
  useEffect(() => {
    if (!session) return;
    if (session.current_phase === 'INITIATIVE') {
      const sid = session.id;

      // Action-phase flags
      localStorage.removeItem(`combat_aid_gunner_${sid}`);

      // Initiative keys — sweep by prefix so the clearing works regardless of whether
      // characterId has resolved yet (it starts as 0 and loads async).
      // leadership_effect (Improve Initiative) is preserved server-side and flows
      // into the Pilot's formula automatically via the ship object.
      localStorage.removeItem(`combat_initiative_support_${sid}`);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key && (
            key.startsWith(`combat_initiative_${sid}_`) ||
            key.startsWith(`combat_npc_aid_gunner_${sid}_`)
          )
        ) {
          localStorage.removeItem(key);
        }
      }

      navigate('/combat/initiative');
    }
  }, [session?.current_phase, session?.id, navigate]);

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
        <h1 className="text-2xl font-bold text-gray-100">Action / Reaction</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const playerShip = session.objects.find((o) => o.is_player_ship) ?? null;
  const inManoeuvre = session.current_phase === 'MANOEUVRE';
  const inAttack = session.current_phase === 'ATTACK';

  // Gunner — assigned mount for reload check
  const assignedMount = mountId != null
    ? (playerShip?.weapon_mounts.find((m) => m.id === mountId) ?? null)
    : null;
  const assignedMountEmpty = assignedMount?.ammo_status === 'Empty';
  const boarding = session.boarding ?? null;

  const isPlayerInBoarding =
    boarding != null &&
    playerShip != null &&
    (boarding.attacker_object_id === playerShip.id ||
      boarding.defender_object_id === playerShip.id);

  const playerIsAttacker =
    boarding != null && playerShip != null && boarding.attacker_object_id === playerShip.id;

  const incomingSalvos = session.objects.filter(
    (o) =>
      o.object_type === 'MISSILE_SALVO' &&
      o.target_object_id === playerShip?.id &&
      (o.rounds_to_contact ?? 0) <= 0,
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Action / Reaction</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round}
          {role && (
            <span className="ml-2 text-nexus-500">· Your Role: {ROLE_LABELS[role] ?? role}</span>
          )}
        </p>
      </div>

      {/* Phase gates */}
      {(inManoeuvre || inAttack) && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-amber-900/30 border border-amber-700/50">
          <div>
            <p className="text-amber-300 font-semibold text-sm">
              {inManoeuvre ? 'Manoeuvre Phase is active.' : 'Attack Phase is active.'}
            </p>
            <p className="text-amber-600 text-xs mt-0.5">Return when the Action Phase begins.</p>
          </div>
          <button
            onClick={() => navigate(inManoeuvre ? '/combat/manoeuvre' : '/combat/attack')}
            className="btn-primary shrink-0"
          >
            {inManoeuvre ? 'Go to Manoeuvre →' : 'Go to Attack →'}
          </button>
        </div>
      )}

      {/* Role-specific content */}
      {!inManoeuvre && !inAttack && (

        <>
          {/* ── CAPTAIN ── */}
          {role === 'CAPTAIN' && playerShip && (
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Captain Actions</h2>

              <ShipStatusPanel ship={playerShip} boarding={boarding} />

              {/* Crew roster */}
              {allRoles.length > 0 && (
                <div className="card space-y-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider">Crew Assignments</p>
                  <div className="space-y-1">
                    {allRoles.map((r) => (
                      <div key={r.character.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{r.character.name}</span>
                        <span className="text-gray-600 text-xs">{ROLE_LABELS[r.role] ?? r.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="card space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowImproveInit(true)}
                    disabled={initiativeUsed}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border transition-colors ${
                      initiativeUsed
                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                        : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-200">Improve Initiative</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {initiativeUsed ? 'Used this round' : 'Leadership + SOC check (8+) — boosts next round initiative'}
                    </p>
                  </button>

                  {!isPlayerInBoarding && (
                    <button
                      onClick={() => setShowBoardingSetup(true)}
                      className="flex-1 text-left px-4 py-3 rounded-xl border bg-gray-900 border-gray-700 hover:border-red-700/60 hover:bg-red-900/10 cursor-pointer transition-colors"
                    >
                      <p className="font-semibold text-sm text-red-300">Initiate Boarding</p>
                      <p className="text-gray-600 text-xs mt-0.5">Order marines to board a target ship</p>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ENGINEER ── */}
          {role === 'ENGINEER' && playerShip && (
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Engineer Actions</h2>

              <ShipStatusPanel ship={playerShip} boarding={boarding} />

              <div className="card space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Repair */}
                  <button
                    onClick={() => setShowRepair(true)}
                    disabled={(playerShip.system_hits ?? []).filter((h) => !h.repaired && !h.beyond_repair).length === 0}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                      (playerShip.system_hits ?? []).filter((h) => !h.repaired && !h.beyond_repair).length === 0
                        ? 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                        : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-200">Repair System</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Engineer check to fix a critical hit
                    </p>
                  </button>

                  {/* Overload Drive */}
                  <button
                    onClick={() => setShowOverloadDrive(true)}
                    className="text-left px-4 py-3 rounded-xl border bg-gray-900 border-gray-700 hover:border-amber-700/60 hover:bg-amber-900/10 cursor-pointer transition-colors"
                  >
                    <p className="font-semibold text-sm text-amber-300">Overload Drive</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Push M-Drive for extra thrust next round{' '}
                      {(playerShip.overload_drive_dm ?? 0) < 0 && (
                        <span className="text-red-500">({fmtSign(playerShip.overload_drive_dm ?? 0)} DM)</span>
                      )}
                    </p>
                  </button>

                  {/* Overload Power */}
                  <button
                    onClick={() => setShowOverloadPower(true)}
                    className="text-left px-4 py-3 rounded-xl border bg-gray-900 border-gray-700 hover:border-amber-700/60 hover:bg-amber-900/10 cursor-pointer transition-colors"
                  >
                    <p className="font-semibold text-sm text-amber-300">Overload Power</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Push power plant for extra output next round{' '}
                      {(playerShip.overload_power_dm ?? 0) < 0 && (
                        <span className="text-red-500">({fmtSign(playerShip.overload_power_dm ?? 0)} DM)</span>
                      )}
                    </p>
                  </button>

                  {/* Jump */}
                  {playerShip.j_drive_status !== 'Destroyed' && playerShip.j_drive_status !== 'Disabled' && (
                    <button
                      onClick={() => setShowJump(true)}
                      className="text-left px-4 py-3 rounded-xl border bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <p className="font-semibold text-sm text-gray-200">Execute Jump</p>
                      <p className="text-gray-600 text-xs mt-0.5">Astrogation + Engineer (J-Drive) checks</p>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SENSOR OPERATOR ── */}
          {role === 'SENSOR OPERATOR' && playerShip && (
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Sensor Operator Actions</h2>

              {(playerShip.ew_used || ewUsed) && (
                <div className="px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-700/40">
                  <p className="text-amber-400 text-sm font-medium">EW action already used this round.</p>
                  <p className="text-amber-700 text-xs mt-0.5">Only one EW action is permitted per round.</p>
                </div>
              )}

              <div className="card space-y-3">
                {/* Acquire Sensor Lock */}
                <button
                  onClick={() => setShowSensorLock(true)}
                  disabled={playerShip.ew_used || ewUsed}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    playerShip.ew_used || ewUsed
                      ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                      : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                  }`}
                >
                  <p className="font-semibold text-sm text-gray-200">Acquire Sensor Lock</p>
                  <p className="text-gray-600 text-xs mt-0.5">Electronics (Sensors) check — locks onto a target</p>
                </button>

                {/* Jam Communications */}
                <button
                  onClick={() => setShowJamComms(true)}
                  disabled={playerShip.ew_used || ewUsed}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    playerShip.ew_used || ewUsed
                      ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                      : 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                  }`}
                >
                  <p className="font-semibold text-sm text-gray-200">Jam Communications</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Electronics (Sensors) check — disrupts target comms
                  </p>
                </button>

                {/* EW vs Missiles — only if salvos inbound */}
                {incomingSalvos.length > 0 && (
                  <button
                    onClick={() => setShowEWMissiles(true)}
                    disabled={playerShip.ew_used || ewUsed}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      playerShip.ew_used || ewUsed
                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                        : 'bg-gray-900 border-amber-800/50 hover:border-amber-600 hover:bg-amber-900/10 cursor-pointer'
                    }`}
                  >
                    <p className="font-semibold text-sm text-amber-300">
                      EW vs Missiles ({incomingSalvos.length} salvo{incomingSalvos.length !== 1 ? 's' : ''} inbound)
                    </p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Electronics (Sensors) check — reduce incoming missile hits
                    </p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── GUNNER ── */}
          {role === 'GUNNER' && playerShip && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Gunner Actions</h2>
              <div className="card space-y-3">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                  {assignedMount?.ammo_status === 'Reloading'
                    ? 'Reloading — turret will be ready next round.'
                    : 'Fire weapons actions are taken in the Attack Phase.'}
                </div>
                <button
                  onClick={() => {
                    if (!assignedMount || !assignedMountEmpty) return;
                    void apiFetch(`/api/combat/mount/${assignedMount.id}/ammo-status`, {
                      method: 'PATCH',
                      body: JSON.stringify({ ammo_status: 'Reloading' }),
                    }).then(() => { void refresh(); });
                  }}
                  disabled={!assignedMountEmpty}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    assignedMountEmpty
                      ? 'bg-gray-900 border-gray-700 hover:border-nexus-600 hover:bg-gray-800 cursor-pointer'
                      : 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <p className={`font-semibold text-sm ${assignedMountEmpty ? 'text-gray-200' : 'text-gray-600'}`}>
                    Reload Turret
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {assignedMount?.ammo_status === 'Reloading'
                      ? 'Reload in progress — ready next round'
                      : assignedMountEmpty
                      ? `${assignedMount?.mount_type ?? 'Turret'} is empty — begin reload`
                      : assignedMount
                      ? `${assignedMount.mount_type} — ${assignedMount.ammo_status.toLowerCase()} (no reload needed)`
                      : 'No turret assigned'}
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* ── PILOT ── */}
          {role === 'PILOT' && playerShip && character && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Pilot Actions</h2>

              <div className="card space-y-3">
                <p className="text-gray-500 text-xs">
                  Thrust remaining: {playerShip.current_thrust ?? 0} / {playerShip.adjusted_max_thrust ?? 0}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
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
                      {aidGunnerUsed ? 'Used this round' : 'Pilot check — costs 1 thrust, grants task chain DM'}
                    </p>
                  </button>

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
            </div>
          )}

          {/* ── MARINE ── */}
          {role === 'MARINE' && playerShip && (
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Marine Actions</h2>

              {isPlayerInBoarding && boarding && character && (
                <div className="card space-y-3">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-700/40">
                    <span className="text-xl mt-0.5">⚔</span>
                    <div>
                      <p className="text-red-300 font-semibold text-sm">
                        Boarding in progress — {boarding.phase === 'PACIFICATION' ? 'Pacification' : 'Resolution'}
                      </p>
                      {boarding.carry_forward_dm !== 0 && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          Carry-forward DM: {fmtSign(boarding.carry_forward_dm)}
                        </p>
                      )}
                    </div>
                  </div>

                  {boarding.phase === 'RESOLUTION' && playerIsAttacker && (
                    <button
                      onClick={() => setShowBoardingResolution(true)}
                      className="w-full text-left px-4 py-3 rounded-xl border bg-gray-900 border-red-700/50 hover:border-red-500 hover:bg-red-900/10 cursor-pointer transition-colors"
                    >
                      <p className="font-semibold text-sm text-red-300">Resolve Boarding</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        Tactics + INT check to determine outcome
                      </p>
                    </button>
                  )}

                  {boarding.phase === 'PACIFICATION' && (
                    <div className="px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40">
                      <p className="text-amber-400 text-xs">
                        Pacification phase — {boarding.pacification_timer ?? '?'} rounds to secure vessel.
                        {boarding.pacification_paused && ' ⚠ Paused — return to Adjacent range.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!isPlayerInBoarding && (
                <div className="card space-y-3">
                  <p className="text-gray-500 text-sm">No active boarding action.</p>
                  <button
                    onClick={() => setShowMarineBoardingSetup(true)}
                    className="w-full text-left px-4 py-3 rounded-xl border bg-gray-900 border-gray-700 hover:border-red-700/60 hover:bg-red-900/10 cursor-pointer transition-colors"
                  >
                    <p className="font-semibold text-sm text-red-300">Initiate Boarding</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Lead marines to board a target ship
                    </p>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PASSENGER ── */}
          {role === 'PASSENGER' && (
            <div className="card py-10 text-center space-y-2">
              <p className="text-gray-500 text-sm font-medium">Stand By</p>
              <p className="text-gray-700 text-xs">
                You are a passenger. No actions are available during the Action Phase.
              </p>
            </div>
          )}

          {/* No role */}
          {!role && (
            <div className="card py-10 text-center">
              <p className="text-gray-600 text-sm">No confirmed role — ask the GM or return to Setup.</p>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}

      {showImproveInit && playerShip && character && (
        <ImproveInitiativeModal
          ship={playerShip}
          character={character}
          onDone={() => { setInitiativeUsed(true); setShowImproveInit(false); void refresh(); }}
          onClose={() => setShowImproveInit(false)}
        />
      )}

      {showBoardingSetup && playerShip && (
        <BoardingSetupModal
          sessionId={session.id}
          playerShip={playerShip}
          objects={session.objects}
          onDone={() => { setShowBoardingSetup(false); void refresh(); }}
          onClose={() => setShowBoardingSetup(false)}
        />
      )}

      {showRepair && playerShip && character && (
        <RepairSystemModal
          ship={playerShip}
          character={character}
          onDone={() => { setShowRepair(false); void refresh(); }}
          onClose={() => setShowRepair(false)}
        />
      )}

      {showOverloadDrive && playerShip && character && (
        <OverloadDriveModal
          sessionId={session.id}
          ship={playerShip}
          character={character}
          onDone={() => { setShowOverloadDrive(false); void refresh(); }}
          onClose={() => setShowOverloadDrive(false)}
        />
      )}

      {showOverloadPower && playerShip && character && (
        <OverloadPowerModal
          sessionId={session.id}
          ship={playerShip}
          character={character}
          onDone={() => { setShowOverloadPower(false); void refresh(); }}
          onClose={() => setShowOverloadPower(false)}
        />
      )}

      {showJump && playerShip && character && (
        <JumpModal
          sessionId={session.id}
          ship={playerShip}
          character={character}
          onDone={() => { setShowJump(false); void refresh(); }}
          onClose={() => setShowJump(false)}
        />
      )}

      {showSensorLock && playerShip && character && (
        <SensorLockModal
          actingShip={playerShip}
          objects={session.objects}
          ranges={session.ranges}
          sensorDM={getBestSensorSkillDM(character)}
          intDM={statDM(character.int)}
          eduDM={statDM(character.edu)}
          onDone={() => { setEwUsed(true); setShowSensorLock(false); void refresh(); }}
          onClose={() => setShowSensorLock(false)}
        />
      )}

      {showJamComms && playerShip && character && (
        <JamCommsModal
          actingShip={playerShip}
          objects={session.objects}
          sensorDM={getBestSensorSkillDM(character)}
          intDM={statDM(character.int)}
          eduDM={statDM(character.edu)}
          onDone={() => { setEwUsed(true); setShowJamComms(false); void refresh(); }}
          onClose={() => setShowJamComms(false)}
        />
      )}

      {showEWMissiles && playerShip && character && (
        <EWMissilesModal
          actingShip={playerShip}
          salvos={incomingSalvos}
          sensorDM={getBestSensorSkillDM(character)}
          intDM={statDM(character.int)}
          eduDM={statDM(character.edu)}
          onDone={() => { setEwUsed(true); setShowEWMissiles(false); void refresh(); }}
          onClose={() => setShowEWMissiles(false)}
        />
      )}

      {showAidGunner && playerShip && character && (
        <AidGunnerModal
          sessionId={session.id}
          playerShip={playerShip}
          pilotDM={getBestPilotSkillDM(character)}
          onDone={() => { setAidGunnerUsed(true); setShowAidGunner(false); void refresh(); }}
          onClose={() => setShowAidGunner(false)}
        />
      )}

      {showEvasive && playerShip && (
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

      {showBoardingResolution && boarding && character && (
        <BoardingResolutionModal
          sessionId={session.id}
          boarding={boarding}
          character={character}
          onDone={() => { setShowBoardingResolution(false); void refresh(); }}
          onClose={() => setShowBoardingResolution(false)}
        />
      )}

      {showMarineBoardingSetup && playerShip && (
        <BoardingSetupModal
          sessionId={session.id}
          playerShip={playerShip}
          objects={session.objects}
          onDone={() => { setShowMarineBoardingSetup(false); void refresh(); }}
          onClose={() => setShowMarineBoardingSetup(false)}
        />
      )}

    </div>
  );
}
