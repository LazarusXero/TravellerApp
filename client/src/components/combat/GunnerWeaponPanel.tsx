import { useState } from 'react';
import { apiFetch } from '../../hooks/useApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GunnerWeapon {
  id: number;
  weapon_type: string;
  damage: string;
  ammo_count: number;
  /** Maximum effective range band (e.g. 'MEDIUM', 'LONG'). Targets beyond this cannot be attacked. */
  range?: string;
}

export interface GunnerMount {
  id: number;
  mount_type: string;
  mount_status: string; // Operational|Bane|Disabled|Destroyed
  ammo_status: string;  // Full|Fired|Reloading|Empty
  point_defense_dm: number;
  weapons: GunnerWeapon[];
}

export interface GunnerCrewMember {
  id: number;
  name: string;
  status: string;
}

export interface GunnerSystemHit {
  id: number;
  system_name: string;
  severity: number;
  max_severity: number;
  repaired: boolean;
  beyond_repair: boolean;
}

export interface GunnerRepairProgress {
  id: number;
  character_id: number;
  system_name: string;
  consecutive_bonus: number;
}

export interface BoardingAction {
  session_id: number;
  attacker_object_id: number;
  defender_object_id: number;
  phase: string; // 'RESOLUTION' | 'PACIFICATION'
  carry_forward_dm: number;
  pacification_paused: boolean;
  rounds_remaining: number | null;
  pacification_timer: number | null;
}

export interface GunnerObject {
  id: number;
  name: string;
  object_type: string;
  is_player_ship: boolean;
  is_destroyed: boolean;
  initiative: number | null;
  current_armor: number | null;
  hull_current: number | null;
  hull_max: number | null;
  hull_severity: number;
  tl: number | null;
  sensor_lock_status: string;
  sensor_check_dm: number;
  ew_used: boolean;
  current_thrust: number | null;
  adjusted_max_thrust: number | null;
  life_support_status: string | null;
  life_support_timer: number | null;
  comms_jammed: boolean;
  missile_quantity: number | null;
  rounds_to_contact: number | null;
  target_object_id: number | null;
  move_target_id: number | null;
  weapon_mounts: GunnerMount[];
  crew_members: GunnerCrewMember[];
  system_hits: GunnerSystemHit[];
  repair_progress: GunnerRepairProgress[];
  gunner_skill_dm: number | null;
  gunner_dex_dm: number | null;
  pilot_skill_dm: number | null;
  sensor_op_skill_dm: number | null;
  sensor_op_int_dm: number | null;
  engineer_skill_dm: number | null;
  engineer_int_dm: number | null;
  leadership_skill_dm: number | null;
  captain_soc_dm: number | null;
  leadership_effect: number;
  overload_drive_dm: number;
  overload_power_dm: number;
  increase_thrust_next: boolean;
  increase_power_next: boolean;
  power_max: number | null;
  power_used: number | null;
  j_drive_status: string | null;
  j_drive_check_dm: number;
  m_drive_status: string | null;
  fuel_tank_status: string | null;
  fuel_current: number | null;
}

export interface GunnerRange {
  from_object_id: number;
  to_object_id: number;
  band: string;
  thrust_points: number;
}

export interface GunnerDMs {
  skillDM: number;
  dexDM: number;
}

export interface GunnerWeaponPanelProps {
  mount: GunnerMount;
  ship: GunnerObject;
  sessionId: number;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  gunnerDMs: GunnerDMs;
  onRefresh: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function statDM(score: number | null | undefined): number {
  if (score == null) return 0;
  if (score === 0) return -3;
  if (score <= 2) return -2;
  if (score <= 5) return -1;
  if (score <= 8) return 0;
  if (score <= 11) return 1;
  if (score <= 14) return 2;
  return 3;
}

export function fmtSign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Numeric ordering of range bands — used to compare a target's range against a weapon's max range. */
const RANGE_ORDER: Record<string, number> = {
  ADJACENT: 0, CLOSE: 1, SHORT: 2, MEDIUM: 3, LONG: 4, 'VERY LONG': 5, DISTANT: 6,
};

/** Universal range DM for direct-fire weapons.
 *  SHORT: +1 · LONG: −2 · VERY LONG: −4 · DISTANT: −6 · all others: 0 */
const UNIVERSAL_RANGE_DM: Record<string, number> = {
  ADJACENT: 0, CLOSE: 0, SHORT: 1, MEDIUM: 0, LONG: -2, 'VERY LONG': -4, DISTANT: -6,
};

/** Range DM for missile weapons.
 *  Only DISTANT incurs a penalty (−6); all other range bands are DM +0. */
const MISSILE_RANGE_DM: Record<string, number> = {
  ADJACENT: 0, CLOSE: 0, SHORT: 0, MEDIUM: 0, LONG: 0, 'VERY LONG': 0, DISTANT: -6,
};

/** Additional hit DM granted by laser weapon type. */
const LASER_WEAPON_DM: Record<string, number> = {
  'Beam Laser': 4,
  'Pulse Laser': 2,
};

/** Fallback max range by weapon type, used when the weapon record does not supply a range field. */
const WEAPON_TYPE_MAX_RANGE: Record<string, string> = {
  'Beam Laser': 'MEDIUM',
  'Pulse Laser': 'LONG',
  'Ion Cannon': 'LONG',
};

/** Universal range DM for non-missile direct-fire weapons.
 *  SHORT: +1 · LONG: −2 · VERY LONG: −4 · DISTANT: −6 · all others: 0
 *  Input is normalised to uppercase so mixed-case DB values ('Long', 'Medium') work correctly. */
export function universalRangeDM(band: string | null): number {
  if (!band) return 0;
  return UNIVERSAL_RANGE_DM[band.toUpperCase()] ?? 0;
}

/** Range DM for missile launch checks.
 *  Only DISTANT incurs a penalty (−6); all other range bands are DM +0.
 *  Input is normalised to uppercase so mixed-case DB values work correctly. */
export function missileRangeDM(band: string | null): number {
  if (!band) return 0;
  return MISSILE_RANGE_DM[band.toUpperCase()] ?? 0;
}

/** Additional hit DM for laser weapon types (Beam Laser +4, Pulse Laser +2, others 0). */
export function laserWeaponDM(weaponType: string): number {
  return LASER_WEAPON_DM[weaponType] ?? 0;
}

/** Returns true if the target's range band is within the weapon's maximum range.
 *  Both inputs are normalised to uppercase before lookup so mixed-case DB values
 *  ('Medium', 'Long') are handled correctly. Returns true (allow) when either
 *  value is absent or the weapon's max range is DISTANT (unrestricted). */
export function isTargetInRange(
  weaponMaxRange: string | null | undefined,
  targetBand: string | null,
): boolean {
  if (!targetBand || !weaponMaxRange) return true;
  const maxUpper = weaponMaxRange.toUpperCase();
  const bandUpper = targetBand.toUpperCase();
  if (maxUpper === 'DISTANT') return true;
  return (RANGE_ORDER[bandUpper] ?? 0) <= (RANGE_ORDER[maxUpper] ?? 6);
}

/** @deprecated Use universalRangeDM + laserWeaponDM separately. */
export function rangeDMForWeapon(weaponType: string, band: string | null): number {
  return universalRangeDM(band) + laserWeaponDM(weaponType);
}

/** Returns true if the weapon type represents a missile weapon (case-insensitive). */
function isMissileWeapon(weaponType: string): boolean {
  return weaponType.toLowerCase().includes('missile');
}

/** Returns true if the weapon type represents a sandcaster (case-insensitive). */
function isSandcasterWeapon(weaponType: string): boolean {
  return weaponType.toLowerCase().includes('sandcaster');
}

export function getRangeBand(ranges: GunnerRange[], aId: number, bId: number): string | null {
  return ranges.find(
    (r) =>
      (r.from_object_id === aId && r.to_object_id === bId) ||
      (r.from_object_id === bId && r.to_object_id === aId),
  )?.band ?? null;
}

const ROUNDS_TO_CONTACT: Record<string, number> = {
  ADJACENT: 0, CLOSE: 0, SHORT: 0, MEDIUM: 0, LONG: 1, 'VERY LONG': 4, DISTANT: 10,
};

const HIT_LOCATION: Record<number, string> = {
  2: 'Sensors', 3: 'Power Plant', 4: 'Fuel', 5: 'Weapon', 6: 'Armor',
  7: 'Hull', 8: 'M-Drive', 9: 'Cargo', 10: 'J-Drive', 11: 'Crew', 12: 'Computer',
};

function parseDiceNotation(notation: string): number {
  // e.g. "2D" → 2, "1D" → 1, "4D" → 4
  const m = notation.match(/^(\d+)D/i);
  return m ? parseInt(m[1], 10) : 1;
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function FormulaRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60 last:border-0">
      <div>
        <span className="text-gray-400 text-sm">{label}</span>
        {sub && <p className="text-gray-700 text-xs mt-0.5">{sub}</p>}
      </div>
      <span className="font-mono text-gray-200 text-sm shrink-0">{value}</span>
    </div>
  );
}

function EffectBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="font-mono text-gray-700 text-xl font-bold">—</span>;
  return (
    <span className={`font-mono text-xl font-bold ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {fmtSign(value)}
    </span>
  );
}

function DropdownRow({
  label, sub, value, min, max, onChange,
}: {
  label: string; sub?: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60 last:border-0">
      <div>
        <span className="text-gray-400 text-sm">{label}</span>
        {sub && <p className="text-gray-700 text-xs mt-0.5">{sub}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="input text-sm w-20 py-0.5 text-right"
      >
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <option key={n} value={n}>{fmtSign(n)}</option>
        ))}
      </select>
    </div>
  );
}

// ── CriticalHit Follow-up ─────────────────────────────────────────────────────

interface CritFollowUpProps {
  rollRequired: string;
  targetId: number;
  mountStatusToApply: string | null;
  targetMounts: GunnerMount[];
  targetCrewMembers: GunnerCrewMember[];
  onDone: (summary: string) => void;
}

function CritFollowUp({
  rollRequired, targetId, mountStatusToApply, targetMounts, targetCrewMembers, onDone,
}: CritFollowUpProps) {
  const [roll, setRoll] = useState('');
  const [crewMemberId, setCrewMemberId] = useState<number>(targetCrewMembers[0]?.id ?? 0);
  const [saving, setSaving] = useState(false);

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 1;

  async function applyFuelLeak(lRate: number) {
    setSaving(true);
    await apiFetch(`/api/combat/object/${targetId}/fuel-leak`, {
      method: 'PATCH', body: JSON.stringify({ leak_rate: lRate }),
    });
    setSaving(false);
    onDone(`Fuel leak rate: ${lRate} tons/round`);
  }

  async function applyArmorDamage(reduction: number) {
    setSaving(true);
    await apiFetch(`/api/combat/object/${targetId}/armor-damage`, {
      method: 'PATCH', body: JSON.stringify({ reduction }),
    });
    setSaving(false);
    onDone(`Armor reduced by ${reduction}`);
  }

  async function applyHullDamage(dmg: number) {
    setSaving(true);
    await apiFetch(`/api/combat/object/${targetId}/damage`, {
      method: 'POST', body: JSON.stringify({ damage: dmg, ignore_armor: true }),
    });
    setSaving(false);
    onDone(`${dmg} additional hull damage (armor bypassed)`);
  }

  async function applyMountStatus(mId: number) {
    if (!mountStatusToApply) return;
    setSaving(true);
    await apiFetch(`/api/combat/mount/${mId}/status`, {
      method: 'PATCH', body: JSON.stringify({ mount_status: mountStatusToApply }),
    });
    setSaving(false);
    onDone(`Mount status: ${mountStatusToApply}`);
  }

  async function applyCrewDamage(dmg: number, target: 'SINGLE' | 'ALL') {
    setSaving(true);
    const body: Record<string, unknown> = { damage: dmg, target };
    if (target === 'SINGLE') body.crew_member_id = crewMemberId;
    await apiFetch(`/api/combat/object/${targetId}/crew-damage`, {
      method: 'PATCH', body: JSON.stringify(body),
    });
    setSaving(false);
    onDone(`${dmg} crew damage (${target})`);
  }

  async function applyLifeSupport(timer: number, unit: 'HOURS' | 'ROUNDS') {
    setSaving(true);
    await apiFetch(`/api/combat/object/${targetId}/life-support-timer`, {
      method: 'PATCH', body: JSON.stringify({ timer, unit }),
    });
    setSaving(false);
    onDone(`Life support failing: ${timer} ${unit.toLowerCase()} remaining`);
  }

  async function applyHullSeverity(inc: number) {
    setSaving(true);
    await apiFetch(`/api/combat/object/${targetId}/hull-severity`, {
      method: 'PATCH', body: JSON.stringify({ increase: inc }),
    });
    setSaving(false);
    onDone(`Hull severity increased by ${inc}`);
  }

  // ── FUEL LEAK (1D / 10) ──
  if (rollRequired === 'FUEL_LEAK_1D_OVER_10') {
    const result = validRoll ? +(rollNum / 10).toFixed(2) : null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D for fuel leak rate, divide by 10:</p>
        <div className="flex items-center gap-2">
          <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
            placeholder="1–6" className="input text-sm w-24 text-right" />
          {result != null && <span className="text-gray-400 text-sm">÷ 10 = {result} tons/round</span>}
        </div>
        <button onClick={() => result != null && void applyFuelLeak(result)}
          disabled={result == null || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Leak Rate'}
        </button>
      </div>
    );
  }

  // ── FUEL LEAK (1D) ──
  if (rollRequired === 'FUEL_LEAK_1D') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D for fuel leak rate (tons/round):</p>
        <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder="1–6" className="input text-sm w-24 text-right" />
        <button onClick={() => validRoll && void applyFuelLeak(rollNum)}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Leak Rate'}
        </button>
      </div>
    );
  }

  // ── ARMOR D3 ──
  if (rollRequired === 'ARMOR_D3') {
    const d3 = validRoll ? Math.ceil(rollNum / 2) : null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D6, divide by 2, round up (D3):</p>
        <div className="flex items-center gap-2">
          <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
            placeholder="1–6" className="input text-sm w-24 text-right" />
          {d3 != null && <span className="text-gray-400 text-sm">ceiling({rollNum} ÷ 2) = {d3}</span>}
        </div>
        <button onClick={() => d3 != null && void applyArmorDamage(d3)}
          disabled={d3 == null || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Reduce Armor'}
        </button>
      </div>
    );
  }

  // ── ARMOR 1D or 2D ──
  if (rollRequired === 'ARMOR_1D' || rollRequired === 'ARMOR_2D') {
    const dice = rollRequired === 'ARMOR_1D' ? '1D' : '2D';
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll {dice} for armor reduction:</p>
        <input type="number" min={1} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder={dice} className="input text-sm w-24 text-right" />
        <button onClick={() => validRoll && void applyArmorDamage(rollNum)}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Reduce Armor'}
        </button>
      </div>
    );
  }

  // ── HULL XD ──
  if (/^HULL_\d+D$/.test(rollRequired)) {
    const xd = rollRequired.replace('HULL_', '');
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll {xd} for additional hull damage (bypasses armor):</p>
        <input type="number" min={1} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder={xd} className="input text-sm w-24 text-right" />
        <button onClick={() => validRoll && void applyHullDamage(rollNum)}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Hull Damage'}
        </button>
      </div>
    );
  }

  // ── HULL_1D (from power/fuel hull severity) ──
  if (rollRequired === 'HULL_1D') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D for hull severity increase:</p>
        <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder="1–6" className="input text-sm w-24 text-right" />
        <button onClick={() => validRoll && void applyHullSeverity(rollNum)}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Hull Severity'}
        </button>
      </div>
    );
  }

  // ── RANDOM WEAPON MOUNT ──
  if (rollRequired === 'RANDOM_WEAPON_MOUNT') {
    const [selectedMountIdx, setSelectedMountIdx] = useState<number | null>(null);
    const mCount = targetMounts.length;
    const rollIdx = validRoll && rollNum >= 1 && rollNum <= mCount ? rollNum - 1 : null;
    const effectiveMountIdx = selectedMountIdx ?? rollIdx;
    const targetMount = effectiveMountIdx != null ? targetMounts[effectiveMountIdx] : null;

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll randomly to select affected weapon mount.</p>
        {targetMounts.length === 0 ? (
          <p className="text-gray-600 text-xs">No weapon mounts on target.</p>
        ) : (
          <>
            <div className="space-y-1 text-xs">
              {targetMounts.map((m, i) => (
                <div key={m.id} className="flex gap-2 text-gray-500">
                  <span className="font-mono w-4">{i + 1}.</span>
                  <span>{m.mount_type} ({m.weapons.map((w) => w.weapon_type).join(', ') || 'empty'})</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">Roll 1D{mCount}:</span>
              <input type="number" min={1} max={mCount} value={roll}
                onChange={(e) => { setRoll(e.target.value); setSelectedMountIdx(null); }}
                placeholder={`1–${mCount}`} className="input text-sm w-20 text-right" />
            </div>
            {targetMount && (
              <p className="text-nexus-400 text-sm">Selected: {targetMount.mount_type} → {mountStatusToApply}</p>
            )}
            {targetMount && (
              <button onClick={() => void applyMountStatus(targetMount.id)} disabled={saving}
                className="btn-primary text-sm">
                {saving ? 'Applying…' : `Apply ${mountStatusToApply} to Mount`}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // ── CREW 1D SINGLE ──
  if (rollRequired === 'CREW_1D_SINGLE') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D for damage to a random crew member:</p>
        <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder="1–6" className="input text-sm w-24 text-right" />
        {targetCrewMembers.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Select crew member hit:</label>
            <select value={crewMemberId} onChange={(e) => setCrewMemberId(parseInt(e.target.value, 10))}
              className="input text-sm">
              {targetCrewMembers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
              ))}
            </select>
          </div>
        )}
        <button onClick={() => validRoll && void applyCrewDamage(rollNum, 'SINGLE')}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Crew Damage'}
        </button>
      </div>
    );
  }

  // ── CREW 1D ALL or 3D ALL ──
  if (rollRequired === 'CREW_1D_ALL' || rollRequired === 'CREW_3D_ALL') {
    const dice = rollRequired === 'CREW_1D_ALL' ? '1D' : '3D';
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll {dice} for damage to all occupants:</p>
        <input type="number" min={1} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder={dice} className="input text-sm w-24 text-right" />
        <button onClick={() => validRoll && void applyCrewDamage(rollNum, 'ALL')}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Crew Damage (All)'}
        </button>
      </div>
    );
  }

  // ── LIFE SUPPORT HOURS ──
  if (rollRequired === 'LIFE_SUPPORT_1D_HOURS') {
    const rounds = validRoll ? rollNum * 10 : null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D for life support failure timer (hours):</p>
        <div className="flex items-center gap-2">
          <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
            placeholder="1–6" className="input text-sm w-24 text-right" />
          {rounds != null && <span className="text-gray-400 text-sm">= {rounds} rounds</span>}
        </div>
        <button onClick={() => validRoll && void applyLifeSupport(rollNum, 'HOURS')}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Timer'}
        </button>
      </div>
    );
  }

  // ── LIFE SUPPORT ROUNDS ──
  if (rollRequired === 'LIFE_SUPPORT_1D_ROUNDS') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 font-medium">Roll 1D for life support failure timer (rounds):</p>
        <input type="number" min={1} max={6} value={roll} onChange={(e) => setRoll(e.target.value)}
          placeholder="1–6" className="input text-sm w-24 text-right" />
        <button onClick={() => validRoll && void applyLifeSupport(rollNum, 'ROUNDS')}
          disabled={!validRoll || saving} className="btn-primary text-sm">
          {saving ? 'Applying…' : 'Apply Timer'}
        </button>
      </div>
    );
  }

  // ── Generic fallback ──
  return (
    <div className="space-y-2">
      <p className="text-amber-400 text-sm">Manual resolution required: <code className="font-mono text-xs">{rollRequired}</code></p>
      <button onClick={() => onDone('Manual resolution noted.')} className="btn-secondary text-sm">
        Mark Resolved
      </button>
    </div>
  );
}

// ── Critical Hit Modal ─────────────────────────────────────────────────────────

export interface CriticalHitModalProps {
  targetId: number;
  targetName: string;
  targetMounts: GunnerMount[];
  targetCrewMembers: GunnerCrewMember[];
  sessionId: number;
  severity: number;
  /** When set, skips the location roll and locks the critical hit to this system. */
  lockedSystemName?: string;
  onClose: () => void;
}

type CritPhase = 'LOCATION' | 'APPLYING' | 'FOLLOW_UP' | 'DONE';

interface CritHitServerResponse {
  object: GunnerObject;
  system_hit: { system_name: string; severity: number };
  roll_required: string | null;
  hull_severity_increase: number | null;
  mount_status_to_apply: string | null;
}

export function CriticalHitModal({
  targetId, targetName, targetMounts, targetCrewMembers, sessionId, severity, lockedSystemName, onClose,
}: CriticalHitModalProps) {
  const [locationRollStr, setLocationRollStr] = useState('');
  const [phase, setPhase] = useState<CritPhase>('LOCATION');
  const [applying, setApplying] = useState(false);
  const [serverResp, setServerResp] = useState<CritHitServerResponse | null>(null);
  const [followUpSummary, setFollowUpSummary] = useState<string | null>(null);

  const locationRoll = parseInt(locationRollStr, 10);
  const validLocation = !isNaN(locationRoll) && locationRoll >= 2 && locationRoll <= 12;
  const systemName = lockedSystemName ?? (validLocation ? (HIT_LOCATION[locationRoll] ?? null) : null);
  const finalSeverity = Math.min(6, Math.max(1, severity));

  const handleApply = async () => {
    if (!systemName) return;
    setApplying(true);
    const res = await apiFetch<CritHitServerResponse>(`/api/combat/object/${targetId}/critical-hit`, {
      method: 'POST',
      body: JSON.stringify({ system_name: systemName, severity: finalSeverity, session_id: sessionId }),
    });
    setApplying(false);
    if (res.success && res.data) {
      setServerResp(res.data);
      if (res.data.roll_required) {
        setPhase('FOLLOW_UP');
      } else {
        setPhase('DONE');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-red-800/50 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6 my-4">
        <div>
          <p className="text-red-400 text-xs uppercase tracking-widest mb-1">Critical Hit!</p>
          <h2 className="text-base font-bold text-gray-100">{targetName}</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Severity {finalSeverity}
          </p>
        </div>

        {phase === 'LOCATION' && (
          <>
            {lockedSystemName ? (
              <div className="px-3 py-2 rounded-xl bg-red-900/30 border border-red-800/50">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">System Auto-Assigned</p>
                <p className="text-red-300 font-semibold text-sm">{lockedSystemName}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  {Object.entries(HIT_LOCATION).map(([roll, loc]) => (
                    <div key={roll} className={`flex gap-1.5 ${systemName === loc ? 'text-red-400' : ''}`}>
                      <span className="font-mono w-4">{roll}:</span>
                      <span>{loc}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 uppercase tracking-wider">Roll 2D6 for hit location:</label>
                  <input type="number" min={2} max={12} value={locationRollStr}
                    onChange={(e) => setLocationRollStr(e.target.value)}
                    placeholder="2–12" className="input text-sm w-24 text-right" />
                  {systemName && (
                    <div className="px-3 py-2 rounded-xl bg-red-900/30 border border-red-800/50">
                      <p className="text-red-300 font-semibold text-sm">Location: {systemName}</p>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => { void handleApply(); }} disabled={!systemName || applying}
                className="btn-primary flex-1 bg-red-700 hover:bg-red-600">
                {applying ? 'Applying…' : 'Apply Critical Hit'}
              </button>
            </div>
          </>
        )}

        {phase === 'FOLLOW_UP' && serverResp?.roll_required && (
          <>
            <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/40 text-xs text-red-400">
              {serverResp.system_hit.system_name} — Severity {serverResp.system_hit.severity}
            </div>
            <CritFollowUp
              rollRequired={serverResp.roll_required}
              targetId={targetId}
              mountStatusToApply={serverResp.mount_status_to_apply}
              targetMounts={targetMounts}
              targetCrewMembers={targetCrewMembers}
              onDone={(summary) => { setFollowUpSummary(summary); setPhase('DONE'); }}
            />
          </>
        )}

        {phase === 'DONE' && (
          <>
            <div className="px-3 py-2 rounded-xl bg-emerald-900/30 border border-emerald-800/50 space-y-1">
              <p className="text-emerald-400 text-sm font-semibold">Critical hit applied.</p>
              {serverResp && (
                <p className="text-gray-500 text-xs">
                  {serverResp.system_hit.system_name} severity {serverResp.system_hit.severity}
                  {followUpSummary ? ` — ${followUpSummary}` : ''}
                </p>
              )}
            </div>
            <button onClick={onClose} className="btn-secondary w-full">Close</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sustained Damage Modal ─────────────────────────────────────────────────────

function SustainedDamageModal({
  targetId, targetName, targetMounts, targetCrewMembers, sessionId, onClose,
}: Omit<CriticalHitModalProps, 'severity'>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-amber-800/50 rounded-2xl shadow-xl w-full max-w-md space-y-4 p-6">
        <div>
          <p className="text-amber-400 font-bold text-sm">⚠ Sustained Damage!</p>
          <p className="text-gray-400 text-sm mt-1">
            {targetName} has taken significant hull damage. A Severity 1 critical hit has been triggered.
          </p>
        </div>
        <CriticalHitModal
          targetId={targetId}
          targetName={targetName}
          targetMounts={targetMounts}
          targetCrewMembers={targetCrewMembers}
          sessionId={sessionId}
          severity={1}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

// ── Resolve Salvo Modal ────────────────────────────────────────────────────────

interface ResolveSalvoModalProps {
  salvo: GunnerObject;
  target: GunnerObject | null;
  sessionId: number;
  weaponDamage: string;
  onClose: () => void;
  onRefresh: () => void;
}

function ResolveSalvoModal({ salvo, target, sessionId, weaponDamage, onClose, onRefresh }: ResolveSalvoModalProps) {
  const [salvoEffect, setSalvoEffect] = useState(salvo.missile_quantity ?? 1);
  const [pdEffect, setPdEffect] = useState(0);
  const [ewEffect, setEwEffect] = useState(0);
  const [evaEffect, setEvaEffect] = useState(0);
  const [damageRoll, setDamageRoll] = useState('');
  const [applying, setApplying] = useState(false);
  const [showSustained, setShowSustained] = useState(false);
  const [sustainedData, setSustainedData] = useState<{ targetId: number; targetName: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const finalEffect = Math.max(0, salvoEffect - pdEffect - ewEffect - evaEffect);
  const targetArmor = target?.current_armor ?? 0;
  const damageNum = parseInt(damageRoll, 10);
  const validDamage = !isNaN(damageNum) && damageNum >= 0;
  const netDamage = validDamage ? Math.max(0, damageNum - targetArmor) : null;
  const totalDamage = netDamage != null ? netDamage * finalEffect : null;

  const handleApplyDamage = async () => {
    if (!target || !validDamage) return;
    setApplying(true);
    const res = await apiFetch<{
      object: GunnerObject; effective_damage: number; destroyed: boolean; sustained_damage_triggered: boolean;
    }>(`/api/combat/object/${target.id}/damage`, {
      method: 'POST',
      body: JSON.stringify({ damage: totalDamage, session_id: sessionId }),
    });
    if (res.success && res.data) {
      const { destroyed, sustained_damage_triggered, object } = res.data;
      let msg = `${target.name} hull: ${object.hull_current}/${object.hull_max}`;
      if (destroyed) msg = `${target.name} destroyed!`;
      setResult(msg);
      if (sustained_damage_triggered) {
        setSustainedData({ targetId: target.id, targetName: target.name });
        setShowSustained(true);
      }
    }
    // Delete the salvo
    await apiFetch(`/api/combat/session/${sessionId}/object/${salvo.id}`, { method: 'DELETE' });
    localStorage.removeItem(`combat_pending_salvo_${sessionId}`);
    setApplying(false);
    onRefresh();
  };

  const handleDismiss = async () => {
    await apiFetch(`/api/combat/session/${sessionId}/object/${salvo.id}`, { method: 'DELETE' });
    localStorage.removeItem(`combat_pending_salvo_${sessionId}`);
    onRefresh();
    onClose();
  };

  if (showSustained && sustainedData) {
    return (
      <SustainedDamageModal
        targetId={sustainedData.targetId}
        targetName={sustainedData.targetName}
        targetMounts={target?.weapon_mounts ?? []}
        targetCrewMembers={target?.crew_members ?? []}
        sessionId={sessionId}
        onClose={() => { setShowSustained(false); if (result) onClose(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-amber-700/40 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6 my-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-widest mb-1">Resolve Missile Salvo</p>
          <h2 className="text-base font-bold text-gray-100">{salvo.name}</h2>
          {target && (
            <p className="text-gray-500 text-sm mt-0.5">
              Target: {target.name} — Armor {target.current_armor ?? 0}
            </p>
          )}
        </div>

        {result ? (
          <div className="px-3 py-2 rounded-xl bg-emerald-900/30 border border-emerald-800/50">
            <p className="text-emerald-300 text-sm font-semibold">{result}</p>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                <span className="text-gray-400 text-sm">Salvo Effect (missiles remaining)</span>
                <input type="number" min={0} value={salvoEffect}
                  onChange={(e) => setSalvoEffect(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="input text-sm w-20 text-right" />
              </div>
              <DropdownRow label="− Point Defence Effect" sub="(determined by GM discussion)"
                value={pdEffect} min={0} max={6} onChange={setPdEffect} />
              <DropdownRow label="− Electronic Warfare Effect" value={ewEffect} min={0} max={6} onChange={setEwEffect} />
              <DropdownRow label="− Evasive Action Effect" value={evaEffect} min={0} max={6} onChange={setEvaEffect} />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400 text-sm font-medium">Final Salvo Effect</span>
              <span className={`font-mono font-bold text-lg ${finalEffect > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                {finalEffect}
              </span>
            </div>

            {finalEffect >= 1 ? (
              <div className="space-y-3 pt-1">
                <p className="text-gray-400 text-sm">
                  Roll salvo damage as <strong className="text-amber-300">{weaponDamage}</strong> against {target?.name ?? '—'} (armor {targetArmor}).
                </p>
                <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                  <span className="text-gray-400 text-sm">Enter Damage Roll</span>
                  <input type="number" min={0} value={damageRoll}
                    onChange={(e) => setDamageRoll(e.target.value)}
                    placeholder="roll" className="input text-sm w-24 text-right" />
                </div>
                {totalDamage != null && (
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>({damageNum} − {targetArmor}) × {finalEffect} = {totalDamage} damage</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={() => { void handleApplyDamage(); }}
                    disabled={!validDamage || applying} className="btn-primary flex-1">
                    {applying ? 'Applying…' : 'Apply Salvo Damage'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">No damage — salvo ineffective.</p>
                <div className="flex gap-3">
                  <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={() => { void handleDismiss(); }} className="btn-secondary flex-1">
                    Dismiss Salvo
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {result && <button onClick={onClose} className="btn-secondary w-full">Close</button>}
      </div>
    </div>
  );
}

// ── Damage Modal ───────────────────────────────────────────────────────────────

const LASER_WEAPON_TYPES = new Set(['Beam Laser', 'Pulse Laser', 'Ion Cannon']);

interface DamageModalProps {
  targetId: number;
  targetName: string;
  targetMounts: GunnerMount[];
  targetCrewMembers: GunnerCrewMember[];
  targetArmor: number;
  weaponDamage: string;
  weaponType: string;
  effect: number;
  mountId: number;
  sessionId: number;
  onClose: () => void;
  onRefresh: () => void;
}

function DamageModal({
  targetId, targetName, targetMounts, targetCrewMembers, targetArmor,
  weaponDamage, weaponType, effect, mountId, sessionId, onClose, onRefresh,
}: DamageModalProps) {
  const [damageRoll, setDamageRoll] = useState('');
  const [sandcasterEffect, setSandcasterEffect] = useState(0);
  const [dealsNoDamage, setDealsNoDamage] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showCrit, setShowCrit] = useState(false);
  const [showSustained, setShowSustained] = useState(false);
  const [sustainedData, setSustainedData] = useState<{ targetId: number; targetName: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isLaser = LASER_WEAPON_TYPES.has(weaponType);
  const diceNum = parseInt(damageRoll, 10);
  const validRoll = !isNaN(diceNum) && diceNum >= 0;
  // Sandcaster acts as bonus armor against laser attacks
  const effectiveDamage = validRoll ? Math.max(0, diceNum - sandcasterEffect) : null;
  const netDamage = effectiveDamage != null ? Math.max(0, effectiveDamage - targetArmor) : null;
  const isCrit = effect >= 6;

  const markFired = async () => {
    await apiFetch(`/api/combat/mount/${mountId}/ammo-status`, {
      method: 'PATCH', body: JSON.stringify({ ammo_status: 'Fired' }),
    });
  };

  const handleApplyDamage = async () => {
    if (!validRoll || effectiveDamage == null) return;
    setApplying(true);
    const res = await apiFetch<{
      object: GunnerObject; effective_damage: number; destroyed: boolean; sustained_damage_triggered: boolean;
    }>(`/api/combat/object/${targetId}/damage`, {
      // Send post-sandcaster damage; server will still subtract armor on top
      method: 'POST', body: JSON.stringify({ damage: effectiveDamage, session_id: sessionId }),
    });
    await markFired();
    setApplying(false);
    if (res.success && res.data) {
      const { destroyed, sustained_damage_triggered, object } = res.data;
      let msg = `${targetName} hull: ${object.hull_current}/${object.hull_max}`;
      if (destroyed) msg = `${targetName} destroyed!`;
      setResult(msg);
      if (sustained_damage_triggered) {
        setSustainedData({ targetId, targetName });
        setShowSustained(true);
      } else if (isCrit && !dealsNoDamage) {
        setShowCrit(true);
      }
    }
    onRefresh();
  };

  const handleNoDamage = async () => {
    await markFired();
    onRefresh();
    onClose();
  };

  if (showSustained && sustainedData) {
    return (
      <SustainedDamageModal
        targetId={sustainedData.targetId}
        targetName={sustainedData.targetName}
        targetMounts={targetMounts}
        targetCrewMembers={targetCrewMembers}
        sessionId={sessionId}
        onClose={() => { setShowSustained(false); if (isCrit) setShowCrit(true); else onClose(); }}
      />
    );
  }

  if (showCrit) {
    const critSeverity = Math.ceil((effectiveDamage ?? diceNum) / 10);
    return (
      <CriticalHitModal
        targetId={targetId}
        targetName={targetName}
        targetMounts={targetMounts}
        targetCrewMembers={targetCrewMembers}
        sessionId={sessionId}
        severity={critSeverity}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6 my-4">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Damage Roll</p>
          <h2 className="text-base font-bold text-gray-100">{targetName}</h2>
          {isCrit && (
            <p className="text-red-400 text-xs mt-0.5 font-semibold">Effect {fmtSign(effect)} — Critical Hit!</p>
          )}
        </div>

        {result && (
          <div className="px-3 py-2 rounded-xl bg-emerald-900/30 border border-emerald-800/50">
            <p className="text-emerald-300 text-sm font-semibold">{result}</p>
          </div>
        )}

        {!result && (
          <>
            <p className="text-gray-400 text-sm">Roll <strong className="text-gray-200">{weaponDamage}</strong></p>
            <div className="space-y-0">
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                <span className="text-gray-400 text-sm">Enter Damage Roll</span>
                <input type="number" min={0} value={damageRoll}
                  onChange={(e) => setDamageRoll(e.target.value)}
                  placeholder="roll" className="input text-sm w-24 text-right" />
              </div>
              {isLaser && (
                <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                  <div>
                    <span className="text-gray-400 text-sm">− Sandcaster Armor Bonus</span>
                    <p className="text-gray-700 text-xs mt-0.5">Active sandcaster protection against this laser attack</p>
                  </div>
                  <select
                    value={sandcasterEffect}
                    onChange={(e) => setSandcasterEffect(parseInt(e.target.value, 10))}
                    className="input text-sm w-20 py-0.5 text-right"
                  >
                    {Array.from({ length: 21 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>{n === 0 ? '0' : `-${n}`}</option>
                    ))}
                  </select>
                </div>
              )}
              {netDamage != null && (
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <span className="text-gray-400 text-sm">Hull damage</span>
                  <span className="font-mono text-gray-200 text-sm">
                    {isLaser && sandcasterEffect > 0
                      ? `${diceNum} − ${sandcasterEffect} − ${targetArmor} = ${netDamage}`
                      : `${diceNum} − ${targetArmor} = ${netDamage}`}
                  </span>
                </div>
              )}
              {isCrit && validRoll && (
                <div className="flex items-start justify-between gap-4 py-1.5 text-red-400">
                  <span className="text-sm font-semibold">Crit Severity</span>
                  <span className="font-mono text-sm font-bold">
                    ceiling({effectiveDamage} ÷ 10) = {Math.ceil((effectiveDamage ?? diceNum) / 10)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">Damage dealt?</span>
              <button
                onClick={() => setDealsNoDamage(false)}
                className={`px-3 py-1 rounded-lg text-sm border transition-colors ${!dealsNoDamage ? 'bg-nexus-900/40 border-nexus-600 text-nexus-300' : 'border-gray-700 text-gray-600 hover:border-gray-600'}`}
              >Yes</button>
              <button
                onClick={() => setDealsNoDamage(true)}
                className={`px-3 py-1 rounded-lg text-sm border transition-colors ${dealsNoDamage ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-700 text-gray-600 hover:border-gray-600'}`}
              >No</button>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              {dealsNoDamage ? (
                <button onClick={() => { void handleNoDamage(); }} className="btn-secondary flex-1">
                  No Damage — Close
                </button>
              ) : (
                <button
                  onClick={() => { void handleApplyDamage(); }}
                  disabled={!validRoll || applying}
                  className={`flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-colors disabled:opacity-40 ${isCrit ? 'bg-red-700 hover:bg-red-600 text-white' : 'btn-primary'}`}
                >
                  {applying ? 'Applying…' : isCrit ? 'Apply Damage + Critical Hit' : 'Apply Damage'}
                </button>
              )}
            </div>
          </>
        )}

        {result && <button onClick={onClose} className="btn-secondary w-full">Close</button>}
      </div>
    </div>
  );
}

// ── Attack Modal ───────────────────────────────────────────────────────────────

interface AttackModalProps {
  mount: GunnerMount;
  ship: GunnerObject;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  gunnerDMs: GunnerDMs;
  sessionId: number;
  onClose: () => void;
  onRefresh: () => void;
}

function AttackModal({ mount, ship, objects, ranges, gunnerDMs, sessionId, onClose, onRefresh }: AttackModalProps) {
  const nonMissileWeapons = mount.weapons.filter((w) => !isMissileWeapon(w.weapon_type) && !isSandcasterWeapon(w.weapon_type));
  const [selectedWeapon, setSelectedWeapon] = useState<GunnerWeapon>(nonMissileWeapons[0]);

  // Weapon max range — use weapon record field (normalised to uppercase), then
  // type-based fallback, then 'DISTANT' (unrestricted). Normalisation ensures that
  // mixed-case DB values like 'Medium' are treated the same as 'MEDIUM'.
  const weaponMaxRange = (
    selectedWeapon?.range ??
    WEAPON_TYPE_MAX_RANGE[selectedWeapon?.weapon_type ?? ''] ??
    'DISTANT'
  ).toUpperCase();
  const allTargets = objects.filter((o) => o.id !== ship.id && !o.is_destroyed && o.object_type !== 'MISSILE_SALVO');
  const validTargets = allTargets.filter((t) =>
    isTargetInRange(weaponMaxRange, getRangeBand(ranges, ship.id, t.id)),
  );

  const [targetId, setTargetId] = useState<number>(validTargets[0]?.id ?? 0);
  const [roll, setRoll] = useState('');
  const [aidGunnerDM, setAidGunnerDM] = useState(0);
  const [evasiveDM, setEvasiveDM] = useState(0);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [calculatedEffect, setCalculatedEffect] = useState<number | null>(null);

  const target = objects.find((o) => o.id === targetId) ?? null;
  const rangeBand = target ? getRangeBand(ranges, ship.id, target.id) : null;
  // Universal range DM applies to all direct-fire weapons.
  // Laser weapon DM (Beam+4, Pulse+2) applies only to laser types — never to missiles
  // that might slip through the nonMissileWeapons filter.
  const isMissile = isMissileWeapon(selectedWeapon?.weapon_type ?? '');
  const rangeDM = universalRangeDM(rangeBand);
  const weaponDM = isMissile ? 0 : laserWeaponDM(selectedWeapon?.weapon_type ?? '');
  const isBoon = target?.sensor_lock_status === 'SENSOR LOCKED';
  const isBane = mount.mount_status === 'Bane';

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;

  const effect = validRoll
    ? rollNum + gunnerDMs.skillDM + gunnerDMs.dexDM + rangeDM + weaponDM + aidGunnerDM - evasiveDM - 8
    : null;

  const handleResolve = () => {
    if (effect == null) return;
    setCalculatedEffect(effect);
    if (effect >= 0) {
      setShowDamageModal(true);
    } else {
      // Miss — just mark fired
      void apiFetch(`/api/combat/mount/${mount.id}/ammo-status`, {
        method: 'PATCH', body: JSON.stringify({ ammo_status: 'Fired' }),
      }).then(() => { onRefresh(); onClose(); });
    }
  };

  if (showDamageModal && calculatedEffect != null && target) {
    return (
      <DamageModal
        targetId={target.id}
        targetName={target.name}
        targetMounts={target.weapon_mounts}
        targetCrewMembers={target.crew_members}
        targetArmor={target.current_armor ?? 0}
        weaponDamage={selectedWeapon?.damage ?? '—'}
        weaponType={selectedWeapon?.weapon_type ?? ''}
        effect={calculatedEffect}
        mountId={mount.id}
        sessionId={sessionId}
        onClose={() => { setShowDamageModal(false); onClose(); }}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6 my-4">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Fire Weapon</p>
          <h2 className="text-base font-bold text-gray-100">{mount.mount_type}</h2>
        </div>

        {/* Weapon selection */}
        {nonMissileWeapons.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Select weapon to fire:</label>
            <select value={selectedWeapon?.weapon_type ?? ''}
              onChange={(e) => {
                const w = nonMissileWeapons.find((x) => x.weapon_type === e.target.value);
                if (!w) return;
                const newRange = (w.range ?? WEAPON_TYPE_MAX_RANGE[w.weapon_type] ?? 'DISTANT').toUpperCase();
                setSelectedWeapon(w);
                // Auto-switch target if current target is out of range with new weapon
                const currentBand = target ? getRangeBand(ranges, ship.id, target.id) : null;
                if (!isTargetInRange(newRange, currentBand)) {
                  const newValid = allTargets.filter((t) =>
                    isTargetInRange(newRange, getRangeBand(ranges, ship.id, t.id)),
                  );
                  setTargetId(newValid[0]?.id ?? 0);
                }
              }}
              className="input text-sm">
              {nonMissileWeapons.map((w) => (
                <option key={w.id} value={w.weapon_type}>{w.weapon_type}</option>
              ))}
            </select>
          </div>
        )}
        {nonMissileWeapons.length === 1 && (
          <p className="text-gray-500 text-sm">Firing: <strong className="text-gray-200">{selectedWeapon?.weapon_type}</strong></p>
        )}

        {/* Target */}
        <div className="space-y-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Select target:</label>
          {validTargets.length === 0 ? (
            <p className="text-red-400 text-xs py-1">
              No targets within weapon range
              {weaponMaxRange !== 'DISTANT' ? ` (max: ${weaponMaxRange})` : ''}.
            </p>
          ) : (
            <select value={targetId} onChange={(e) => setTargetId(parseInt(e.target.value, 10))}
              className="input text-sm">
              {validTargets.map((t) => {
                const band = getRangeBand(ranges, ship.id, t.id);
                const locked = t.sensor_lock_status === 'SENSOR LOCKED';
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}{band ? ` — ${band}` : ''}{locked ? ' — 🔒' : ' — ○'}
                  </option>
                );
              })}
            </select>
          )}
          {rangeBand && (
            <p className="text-xs text-gray-600">
              Range: {rangeBand} → DM{fmtSign(rangeDM)}
              {weaponMaxRange !== 'DISTANT' && ` · Weapon max: ${weaponMaxRange}`}
            </p>
          )}
        </div>

        {/* Formula */}
        <div className="space-y-0">
          <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
            <div>
              <span className="text-gray-400 text-sm">
                {isBoon ? 'Roll 2D6 (Boon — roll 3D6 highest 2):' : 'Roll 2D6:'}
              </span>
              {isBane && <p className="text-amber-500 text-xs mt-0.5">Bane: roll 3D6 take lowest 2</p>}
            </div>
            <input type="number" min={2} max={12} value={roll} onChange={(e) => setRoll(e.target.value)}
              placeholder="2–12" className="input text-sm w-24 text-right" />
          </div>
          <FormulaRow label="+ Gunner Skill DM" value={fmtSign(gunnerDMs.skillDM)} />
          <FormulaRow label="+ DEX DM" value={fmtSign(gunnerDMs.dexDM)} />
          <FormulaRow
            label="+ Range DM"
            value={fmtSign(rangeDM)}
            sub={rangeBand
              ? `${rangeBand} — Short +1, Long −2, Very Long −4, Distant −6, others 0`
              : undefined}
          />
          {weaponDM !== 0 && (
            <FormulaRow
              label={`+ ${selectedWeapon?.weapon_type} Weapon DM`}
              value={fmtSign(weaponDM)}
              sub={`${selectedWeapon?.weapon_type} modifier`}
            />
          )}
          <DropdownRow label="+ Aid Gunner Task Chain DM"
            sub="(result of Pilot's Aid Gunner action)"
            value={aidGunnerDM} min={-3} max={2} onChange={setAidGunnerDM} />
          <DropdownRow label="− Evasive Action DM"
            sub="(determined by GM discussion)"
            value={evasiveDM} min={0} max={4} onChange={setEvasiveDM} />
          <FormulaRow label="− 8 (task difficulty)" value="−8" />
        </div>

        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800">
          <span className="text-gray-400 text-sm font-medium">Effect</span>
          <EffectBadge value={effect} />
        </div>

        {effect != null && effect < 0 && (
          <p className="text-red-400 text-sm">Miss — no effect.</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleResolve}
            disabled={!validRoll || validTargets.length === 0}
            className="btn-primary flex-1"
          >
            Resolve Attack
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Missile Launch Modal ───────────────────────────────────────────────────────

interface MissileLaunchModalProps {
  mount: GunnerMount;
  ship: GunnerObject;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  gunnerDMs: GunnerDMs;
  sessionId: number;
  onClose: () => void;
  onRefresh: () => void;
}

function MissileLaunchModal({ mount, ship, objects, ranges, sessionId, onClose, onRefresh }: MissileLaunchModalProps) {
  const missileWeapon = mount.weapons.find((w) => isMissileWeapon(w.weapon_type));
  const targets = objects.filter((o) => o.id !== ship.id && !o.is_destroyed && o.object_type === 'SHIP');
  const [targetId, setTargetId] = useState<number>(targets[0]?.id ?? 0);
  const [roll, setRoll] = useState('');
  const [launching, setLaunching] = useState(false);
  const [showImmediateResolve, setShowImmediateResolve] = useState(false);
  const [immediateTarget, setImmediateTarget] = useState<GunnerObject | null>(null);

  const target = objects.find((o) => o.id === targetId) ?? null;
  const rangeBand = target ? getRangeBand(ranges, ship.id, target.id) : null;
  // Normalise to uppercase so mixed-case DB values ('Distant', 'distant') resolve correctly.
  const rangeBandUpper = rangeBand?.toUpperCase() ?? null;
  const roundsToContact = rangeBandUpper ? (ROUNDS_TO_CONTACT[rangeBandUpper] ?? 0) : 0;
  const isImmediate = roundsToContact === 0;
  const isSensorLocked = target?.sensor_lock_status === 'SENSOR LOCKED';

  const ammoCount = missileWeapon?.ammo_count ?? 12;
  const shipTL = ship.tl ?? 10;
  const targetTL = target?.tl ?? 10;
  const tlSalvoEffect = Math.max(1, Math.min(6, shipTL - targetTL));
  const isCloseRange = rangeBandUpper === 'ADJACENT' || rangeBandUpper === 'CLOSE';
  const effectiveTLBonus = isCloseRange ? 0 : tlSalvoEffect; // Smart trait lost at close range
  // Missile range DM: only DISTANT incurs a penalty (−6); all other bands are +0.
  const rangeDM = missileRangeDM(rangeBand);

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const salvoEffect = validRoll ? Math.max(0, rollNum + effectiveTLBonus + ammoCount + rangeDM - 8) : null;
  const finalMissileQty = salvoEffect != null ? Math.min(salvoEffect, ammoCount) : null;

  const markFired = async () => {
    await apiFetch(`/api/combat/mount/${mount.id}/ammo-status`, {
      method: 'PATCH', body: JSON.stringify({ ammo_status: 'Empty' }),
    });
  };

  const handleLaunch = async () => {
    if (!target || finalMissileQty == null) return;
    setLaunching(true);

    if (isImmediate) {
      // Resolve immediately
      await markFired();
      setImmediateTarget(target);
      setShowImmediateResolve(true);
    } else {
      // Create MISSILE_SALVO object
      const salvoName = `${ship.name} salvo → ${target.name}`;
      await apiFetch(`/api/combat/session/${sessionId}/object`, {
        method: 'POST',
        body: JSON.stringify({
          object_type: 'MISSILE_SALVO',
          name: salvoName,
          origin_object_id: ship.id,
          target_object_id: target.id,
          missile_quantity: finalMissileQty,
          rounds_to_contact: roundsToContact,
          ranges: [],
        }),
      });
      await markFired();
      onRefresh();
      onClose();
    }
    setLaunching(false);
  };

  if (showImmediateResolve && immediateTarget && missileWeapon) {
    const fakeSalvo: GunnerObject = {
      ...ship, id: -1, name: `${ship.name} salvo → ${immediateTarget.name}`,
      object_type: 'MISSILE_SALVO', missile_quantity: finalMissileQty ?? 1,
      move_target_id: immediateTarget.id,
    };
    return (
      <ResolveSalvoModal
        salvo={fakeSalvo}
        target={immediateTarget}
        sessionId={sessionId}
        weaponDamage={missileWeapon.damage}
        onClose={() => { setShowImmediateResolve(false); onClose(); }}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6 my-4">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Launch Missile Salvo</p>
          <h2 className="text-base font-bold text-gray-100">{mount.mount_type}</h2>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Select target:</label>
          <select value={targetId} onChange={(e) => setTargetId(parseInt(e.target.value, 10))}
            className="input text-sm">
            {targets.map((t) => {
              const band = getRangeBand(ranges, ship.id, t.id);
              return <option key={t.id} value={t.id}>{t.name}{band ? ` — ${band}` : ''}</option>;
            })}
          </select>
          {rangeBand && (
            <p className="text-xs text-gray-600">
              Range: {rangeBand} → {isImmediate ? 'Immediate' : `${roundsToContact} round${roundsToContact !== 1 ? 's' : ''} to contact`}
            </p>
          )}
          {isCloseRange && (
            <p className="text-xs text-amber-600">Smart trait lost at this range — TL bonus removed.</p>
          )}
        </div>

        <div className="space-y-0">
          <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
            <span className="text-gray-400 text-sm">
              {isSensorLocked ? 'Roll 2D6 (Boon — roll 3D6 highest 2):' : 'Roll 2D6:'}
            </span>
            <input type="number" min={2} max={12} value={roll} onChange={(e) => setRoll(e.target.value)}
              placeholder="2–12" className="input text-sm w-24 text-right" />
          </div>
          <FormulaRow label="+ TL Salvo Effect"
            value={`+${effectiveTLBonus}`}
            sub={isCloseRange ? 'Smart trait lost at this range' : `Ship TL ${shipTL} − Target TL ${targetTL} = ${tlSalvoEffect} (clamped 1–6)`} />
          <FormulaRow label="+ Salvo Quantity" value={`+${ammoCount}`}
            sub={`${ammoCount} missiles available`} />
          <FormulaRow
            label="+ Range DM"
            value={fmtSign(rangeDM)}
            sub={rangeBand
              ? `${rangeBand} — Distant −6, all other ranges +0`
              : undefined}
          />
          <FormulaRow label="− 8" value="−8" />
        </div>

        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800">
          <span className="text-gray-400 text-sm font-medium">Salvo Effect</span>
          <span className={`font-mono text-xl font-bold ${salvoEffect != null && salvoEffect > 0 ? 'text-amber-400' : 'text-gray-700'}`}>
            {salvoEffect != null ? salvoEffect : '—'}
          </span>
        </div>

        {salvoEffect != null && salvoEffect <= 0 && (
          <p className="text-red-400 text-sm">Salvo ineffective — no missiles reach the target.</p>
        )}
        {finalMissileQty != null && finalMissileQty > 0 && (
          <p className="text-gray-500 text-xs">{finalMissileQty} missile{finalMissileQty !== 1 ? 's' : ''} in salvo (capped at {ammoCount}).</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => { void handleLaunch(); }}
            disabled={!validRoll || !target || launching || (salvoEffect != null && salvoEffect <= 0)}
            className="btn-primary flex-1">
            {launching ? 'Launching…' : isImmediate ? 'Launch & Resolve' : 'Launch Salvo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Point Defence Modal ────────────────────────────────────────────────────────

interface PointDefenceModalProps {
  mount: GunnerMount;
  ship: GunnerObject;
  objects: GunnerObject[];
  ranges: GunnerRange[];
  gunnerDMs: GunnerDMs;
  onClose: () => void;
  onRefresh: () => void;
}

function PointDefenceModal({ mount, ship, objects, ranges, gunnerDMs, onClose, onRefresh }: PointDefenceModalProps) {
  const MEDIUM_BANDS = new Set(['ADJACENT', 'CLOSE', 'SHORT', 'MEDIUM']);
  const nearbySalvos = objects.filter((o) => {
    if (o.object_type !== 'MISSILE_SALVO') return false;
    const band = getRangeBand(ranges, ship.id, o.id) ?? getRangeBand(ranges, o.id, ship.id);
    // Normalise to uppercase so mixed-case DB values work correctly.
    return band ? MEDIUM_BANDS.has(band.toUpperCase()) : false;
  });

  const [salvoId, setSalvoId] = useState<number>(nearbySalvos[0]?.id ?? 0);
  const [roll, setRoll] = useState('');

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll
    ? rollNum + gunnerDMs.skillDM + gunnerDMs.dexDM + mount.point_defense_dm - 8
    : null;

  const handleClose = async () => {
    await apiFetch(`/api/combat/mount/${mount.id}/ammo-status`, {
      method: 'PATCH', body: JSON.stringify({ ammo_status: 'Fired' }),
    });
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Point Defence</p>
          <h2 className="text-base font-bold text-gray-100">{mount.mount_type}</h2>
        </div>

        {nearbySalvos.length === 0 ? (
          <p className="text-gray-500 text-sm">No missile salvos within range to intercept.</p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs text-gray-600 uppercase tracking-wider">Select salvo to intercept:</label>
              <select value={salvoId} onChange={(e) => setSalvoId(parseInt(e.target.value, 10))} className="input text-sm">
                {nearbySalvos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.rounds_to_contact != null ? `${s.rounds_to_contact} rounds to contact` : 'Contact now'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-0">
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
                <span className="text-gray-400 text-sm">Roll 2D6:</span>
                <input type="number" min={2} max={12} value={roll} onChange={(e) => setRoll(e.target.value)}
                  placeholder="2–12" className="input text-sm w-24 text-right" />
              </div>
              <FormulaRow label="+ Gunner Skill DM" value={fmtSign(gunnerDMs.skillDM)} />
              <FormulaRow label="+ DEX DM" value={fmtSign(gunnerDMs.dexDM)} />
              <FormulaRow label="+ Point Defence Turret DM" value={fmtSign(mount.point_defense_dm)}
                sub={`Turret DM: +${mount.point_defense_dm}`} />
              <FormulaRow label="− 8" value="−8" />
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400 text-sm font-medium">Point Defence Effect</span>
              <EffectBadge value={effect} />
            </div>

            {effect != null && (
              effect >= 0 ? (
                <div className="px-3 py-2 rounded-xl bg-emerald-900/30 border border-emerald-800/50 space-y-1">
                  <p className="text-emerald-400 text-sm font-semibold">Point Defence successful!</p>
                  <p className="text-emerald-600 text-xs">Apply the following as Point Defence DM: −{effect}</p>
                  <p className="text-gray-600 text-xs">Note this for when the salvo resolves.</p>
                </div>
              ) : (
                <p className="text-red-400 text-sm">Point Defence failed.</p>
              )
            )}
          </>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => { void handleClose(); }} className="btn-primary flex-1">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Disperse Sand Modal ────────────────────────────────────────────────────────

interface DisperseSandModalProps {
  mount: GunnerMount;
  gunnerDMs: GunnerDMs;
  onClose: () => void;
  onRefresh: () => void;
}

function DisperseSandModal({ mount, gunnerDMs, onClose, onRefresh }: DisperseSandModalProps) {
  const sandcasterCount = mount.weapons.filter((w) => w.weapon_type === 'Sandcaster').length;
  const [use, setUse] = useState<'LASER' | 'BOARDING'>('LASER');
  const [roll, setRoll] = useState('');
  const [armorRoll, setArmorRoll] = useState('');

  const rollNum = parseInt(roll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;
  const effect = validRoll ? rollNum + gunnerDMs.skillDM + gunnerDMs.dexDM + sandcasterCount - 8 : null;

  const armorRollNum = parseInt(armorRoll, 10);
  const validArmorRoll = !isNaN(armorRollNum) && armorRollNum >= 1 && armorRollNum <= 6;
  const totalSandEffect = effect != null && effect >= 0 && validArmorRoll ? armorRollNum + effect : null;

  const handleClose = async () => {
    await apiFetch(`/api/combat/mount/${mount.id}/ammo-status`, {
      method: 'PATCH', body: JSON.stringify({ ammo_status: 'Fired' }),
    });
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Disperse Sand</p>
          <h2 className="text-base font-bold text-gray-100">{mount.mount_type}</h2>
        </div>

        <div className="flex gap-2">
          {(['LASER', 'BOARDING'] as const).map((u) => (
            <button key={u} onClick={() => setUse(u)}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${use === u ? 'bg-nexus-900/40 border-nexus-600 text-nexus-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}>
              {u === 'LASER' ? 'Disperse Laser Fire' : 'Against Boarding Party'}
            </button>
          ))}
        </div>

        <div className="space-y-0">
          <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
            <span className="text-gray-400 text-sm">Roll 2D6:</span>
            <input type="number" min={2} max={12} value={roll} onChange={(e) => setRoll(e.target.value)}
              placeholder="2–12" className="input text-sm w-24 text-right" />
          </div>
          <FormulaRow label="+ Gunner Skill DM" value={fmtSign(gunnerDMs.skillDM)} />
          <FormulaRow label="+ DEX DM" value={fmtSign(gunnerDMs.dexDM)} />
          <FormulaRow label="+ Sandcasters in Turret" value={`+${sandcasterCount}`}
            sub={`${sandcasterCount} sandcaster${sandcasterCount !== 1 ? 's' : ''} in this mount`} />
          <FormulaRow label="− 8" value="−8" />
        </div>

        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800">
          <span className="text-gray-400 text-sm font-medium">Sandcaster Effect</span>
          <EffectBadge value={effect} />
        </div>

        {effect != null && effect >= 0 && use === 'LASER' && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800/60">
              <span className="text-gray-400 text-sm">Roll 1D for armor bonus:</span>
              <input type="number" min={1} max={6} value={armorRoll} onChange={(e) => setArmorRoll(e.target.value)}
                placeholder="1–6" className="input text-sm w-24 text-right" />
            </div>
            {totalSandEffect != null && (
              <div className="px-3 py-2 rounded-xl bg-nexus-900/30 border border-nexus-800/50">
                <p className="text-nexus-300 text-sm font-semibold">
                  Sandcaster Effect: DM+{totalSandEffect} against laser attacks this round.
                </p>
                <p className="text-gray-600 text-xs mt-0.5">Inform the GM — they track this for incoming lasers.</p>
              </div>
            )}
          </div>
        )}

        {effect != null && effect >= 0 && use === 'BOARDING' && (
          <div className="px-3 py-2 rounded-xl bg-amber-900/30 border border-amber-800/50">
            <p className="text-amber-300 text-sm font-semibold">Apply 8D damage to each boarding party member.</p>
          </div>
        )}

        {effect != null && effect < 0 && (
          <p className="text-red-400 text-sm">Sandcaster ineffective.</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => { void handleClose(); }} className="btn-primary flex-1">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

type ActiveModal =
  | 'SALVO'
  | 'FIRE'
  | 'MISSILE'
  | 'POINT_DEFENCE'
  | 'DISPERSE_SAND'
  | null;

export function GunnerWeaponPanel({
  mount, ship, sessionId, objects, ranges, gunnerDMs, onRefresh,
}: GunnerWeaponPanelProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const weaponTypes = mount.weapons.map((w) => w.weapon_type);
  const hasMissile = weaponTypes.some((t) => isMissileWeapon(t));
  const hasSandcaster = weaponTypes.some((t) => isSandcasterWeapon(t));
  const hasLaser = weaponTypes.includes('Beam Laser') || weaponTypes.includes('Pulse Laser');
  const hasNonMissile = mount.weapons.some(
    (w) => !isMissileWeapon(w.weapon_type) && !isSandcasterWeapon(w.weapon_type),
  );

  const fired = mount.ammo_status === 'Fired';
  const disabled = mount.mount_status === 'Disabled' || mount.mount_status === 'Destroyed';

  // Incoming salvos targeting THIS ship with rounds_to_contact = 0
  const incomingSalvos = objects.filter(
    (o) => o.object_type === 'MISSILE_SALVO' &&
           o.move_target_id === ship.id &&
           o.rounds_to_contact === 0,
  );

  // Pre-select pending salvo from localStorage
  const pendingSalvoKey = `combat_pending_salvo_${sessionId}`;
  const pendingSalvoId = (() => {
    try {
      const raw = localStorage.getItem(pendingSalvoKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { salvoId: number };
      return parsed.salvoId;
    } catch { return null; }
  })();
  const activeSalvo = pendingSalvoId
    ? (incomingSalvos.find((s) => s.id === pendingSalvoId) ?? incomingSalvos[0] ?? null)
    : (incomingSalvos[0] ?? null);
  const salvoTarget = activeSalvo?.move_target_id
    ? objects.find((o) => o.id === activeSalvo.move_target_id) ?? null
    : null;
  const missileWeapon = mount.weapons.find((w) => isMissileWeapon(w.weapon_type));

  // Mount status badge
  const mountStatusColor =
    mount.mount_status === 'Operational' ? 'text-emerald-400' :
    mount.mount_status === 'Bane' ? 'text-amber-400' :
    'text-red-400';

  const ammoStatusBadge =
    mount.ammo_status === 'Full' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' :
    mount.ammo_status === 'Empty' ? 'bg-red-900/30 text-red-400 border-red-800/40' :
    mount.ammo_status === 'Reloading' ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' :
    'bg-gray-800 text-gray-500 border-gray-700'; // Fired

  return (
    <>
      {/* Modals */}
      {activeModal === 'SALVO' && activeSalvo && (
        <ResolveSalvoModal
          salvo={activeSalvo}
          target={salvoTarget}
          sessionId={sessionId}
          weaponDamage={missileWeapon?.damage ?? '4D'}
          onClose={() => setActiveModal(null)}
          onRefresh={onRefresh}
        />
      )}
      {activeModal === 'FIRE' && (
        <AttackModal
          mount={mount}
          ship={ship}
          objects={objects}
          ranges={ranges}
          gunnerDMs={gunnerDMs}
          sessionId={sessionId}
          onClose={() => setActiveModal(null)}
          onRefresh={onRefresh}
        />
      )}
      {activeModal === 'MISSILE' && (
        <MissileLaunchModal
          mount={mount}
          ship={ship}
          objects={objects}
          ranges={ranges}
          gunnerDMs={gunnerDMs}
          sessionId={sessionId}
          onClose={() => setActiveModal(null)}
          onRefresh={onRefresh}
        />
      )}
      {activeModal === 'POINT_DEFENCE' && (
        <PointDefenceModal
          mount={mount}
          ship={ship}
          objects={objects}
          ranges={ranges}
          gunnerDMs={gunnerDMs}
          onClose={() => setActiveModal(null)}
          onRefresh={onRefresh}
        />
      )}
      {activeModal === 'DISPERSE_SAND' && (
        <DisperseSandModal
          mount={mount}
          gunnerDMs={gunnerDMs}
          onClose={() => setActiveModal(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* Mount summary card */}
      <div className="card space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-gray-100 font-semibold text-sm">{mount.mount_type}</p>
            <p className="text-gray-500 text-xs">
              {mount.weapons.map((w) => w.weapon_type).join(', ') || 'No weapons'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium ${mountStatusColor}`}>{mount.mount_status}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${ammoStatusBadge}`}>
              {mount.ammo_status}
            </span>
          </div>
        </div>

        {mount.mount_status === 'Bane' && (
          <p className="text-amber-500 text-xs">⚠ Bane active — roll 3D6 take lowest 2 for all attacks.</p>
        )}
        {mount.mount_status === 'Disabled' && (
          <p className="text-red-500 text-xs">✕ Weapon Disabled</p>
        )}
        {mount.mount_status === 'Destroyed' && (
          <p className="text-red-500 text-xs">✕ Weapon Destroyed</p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">

          {/* BUTTON 1: Resolve incoming salvo */}
          {incomingSalvos.length > 0 && activeSalvo && (
            <button
              onClick={() => setActiveModal('SALVO')}
              className="btn-secondary text-xs px-3 py-1.5 border-amber-700/50 text-amber-400 hover:bg-amber-900/20"
            >
              Resolve {activeSalvo.name.length > 20 ? 'Salvo' : activeSalvo.name}
            </button>
          )}

          {/* BUTTON 2: Fire weapon (non-missile) */}
          {hasNonMissile && !fired && !disabled && (
            <button onClick={() => setActiveModal('FIRE')} className="btn-secondary text-xs px-3 py-1.5">
              Fire {mount.mount_type}
            </button>
          )}

          {/* BUTTON 3: Launch missiles */}
          {hasMissile && mount.ammo_status === 'Full' && mount.mount_status === 'Operational' && (
            <button onClick={() => setActiveModal('MISSILE')} className="btn-secondary text-xs px-3 py-1.5">
              Launch Missiles
            </button>
          )}

          {/* BUTTON 4: Point defence */}
          {hasLaser && !fired && (
            <button onClick={() => setActiveModal('POINT_DEFENCE')} className="btn-secondary text-xs px-3 py-1.5">
              Point Defence
            </button>
          )}

          {/* BUTTON 5: Disperse sand */}
          {hasSandcaster && !fired && (
            <button onClick={() => setActiveModal('DISPERSE_SAND')} className="btn-secondary text-xs px-3 py-1.5">
              Disperse Sand
            </button>
          )}

          {fired && !hasMissile && !hasSandcaster && (
            <span className="text-xs text-gray-600 py-1.5">Weapon fired this round.</span>
          )}
        </div>
      </div>
    </>
  );
}

// Export helpers used by pages
export { parseDiceNotation };
