import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi';
import { useApp } from '../../context/AppContext';
import { CombatDiagram } from '../../components/combat/CombatDiagram';
import type { DiagramObject, DiagramRange } from '../../components/combat/CombatDiagram';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameInfo {
  id: number;
}

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
  origin_object_id: number | null;
  target_object_id: number | null;
  radius_km: number | null;
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

interface ShipFormState {
  name: string;
  type_desc: string;
  is_player_ship: boolean;
  tl: number;
  size_tons: number;
  max_thrust: number;
  base_armor: number;
  hull_max: number;
  fuel_capacity: number;
  fuel_current: number;
  power_max: number;
  computer_rating: number;
  marines: number;
  passengers: number;
  cargo_weight: number;
  cargo_value: number;
  pilot_skill_dm: number;
  leadership_skill_dm: number;
  naval_tactics_dm: number;
  captain_soc_dm: number;
  gunner_skill_dm: number;
  gunner_dex_dm: number;
  engineer_skill_dm: number;
  engineer_int_dm: number;
  sensor_op_skill_dm: number;
  sensor_op_int_dm: number;
}

interface WeaponMountForm {
  mount_type: string;
  weapons: string[];
}

interface CrewEntry {
  id: string;
  name: string;
  role: string;
  hp_max: number;
}

interface ApiMount {
  mount_type: string;
  weapons: Array<{ weapon_type: string }>;
}

interface PendingSubmission {
  objectData: Record<string, unknown>;
  mounts: ApiMount[];
  crew: Array<{ name: string; role: string; hp_max: number }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BANDS = ['ADJACENT', 'CLOSE', 'SHORT', 'MEDIUM', 'LONG', 'VERY LONG', 'DISTANT'] as const;

const WEAPON_TYPES = ['Beam Laser', 'Pulse Laser', 'Missile Rack', 'Sandcaster', 'Ion Cannon'];

const MOUNT_TYPES = ['Single Turret', 'Double Turret', 'Triple Turret', 'Fixed'];

const MOUNT_SLOTS: Record<string, number> = {
  'Single Turret': 1,
  'Double Turret': 2,
  'Triple Turret': 3,
  'Fixed': 1,
};

const WEAPON_POWER: Record<string, number> = {
  'Beam Laser': 4,
  'Pulse Laser': 4,
  'Missile Rack': 0,
  'Sandcaster': 0,
  'Ion Cannon': 10,
};

const WEAPON_AMMO: Record<string, number> = {
  'Beam Laser': 0,
  'Pulse Laser': 0,
  'Missile Rack': 12,
  'Sandcaster': 20,
  'Ion Cannon': 0,
};

const CREW_ROLES = [
  'CAPTAIN', 'PILOT', 'GUNNER', 'ENGINEER',
  'SENSOR OPERATOR', 'MARINE', 'PASSENGER',
];

const ROUNDS_TO_CONTACT: Record<string, number> = {
  ADJACENT: 0, CLOSE: 0, SHORT: 0, MEDIUM: 0, LONG: 1, 'VERY LONG': 4, DISTANT: 10,
};

const DEFAULT_SHIP: ShipFormState = {
  name: '', type_desc: '', is_player_ship: false,
  tl: 8, size_tons: 200, max_thrust: 2, base_armor: 0,
  hull_max: 100, fuel_capacity: 40, fuel_current: 40,
  power_max: 30, computer_rating: 5,
  marines: 0, passengers: 0, cargo_weight: 0, cargo_value: 0,
  pilot_skill_dm: 0, leadership_skill_dm: 0, naval_tactics_dm: 0, captain_soc_dm: 0,
  gunner_skill_dm: 0, gunner_dex_dm: 0, engineer_skill_dm: 0, engineer_int_dm: 0,
  sensor_op_skill_dm: 0, sensor_op_int_dm: 0,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function NumberInput({
  value,
  onChange,
  min,
  max,
  className = 'input text-sm',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        onChange(isNaN(v) ? 0 : v);
      }}
      className={className}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRange(ranges: CombatRange[], fromId: number, toId: number): CombatRange | null {
  const a = Math.min(fromId, toId);
  const b = Math.max(fromId, toId);
  return ranges.find((r) => r.from_object_id === a && r.to_object_id === b) ?? null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function GMCombatSetup() {
  const navigate = useNavigate();
  const { notify } = useApp();

  const [game, setGame] = useState<GameInfo | null>(null);
  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Session creation
  const [sessionName, setSessionName] = useState('');
  const [creating, setCreating] = useState(false);

  // Add-object tab
  const [activeTab, setActiveTab] = useState<'SHIP' | 'PLANET' | 'STATION' | 'MISSILE_SALVO'>('SHIP');

  // Ship form
  const [shipForm, setShipForm] = useState<ShipFormState>(DEFAULT_SHIP);
  const [mounts, setMounts] = useState<WeaponMountForm[]>([]);
  const [crew, setCrew] = useState<CrewEntry[]>([]);

  // Other forms
  const [planetForm, setPlanetForm] = useState({ name: '', radius_km: 10000 });
  const [stationForm, setStationForm] = useState({ name: '' });
  const [missileForm, setMissileForm] = useState({ origin_object_id: 0, target_object_id: 0, quantity: 12 });

  // Range assignment modal
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [pendingRanges, setPendingRanges] = useState<Record<number, string>>({});

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadSession = useCallback(async (gameId: number) => {
    const res = await apiFetch<CombatSession | null>(
      `/api/combat/session/active?game_id=${gameId}`,
    );
    if (res.success) setSession(res.data ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const gameRes = await apiFetch<GameInfo>('/api/game');
        if (!gameRes.success || !gameRes.data) return;
        setGame(gameRes.data);
        await loadSession(gameRes.data.id);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSession]);

  // ── Session create / end ───────────────────────────────────────────────────

  const handleCreateSession = async () => {
    if (!game || !sessionName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch<CombatSession>('/api/combat/session', {
        method: 'POST',
        body: JSON.stringify({ game_id: game.id, name: sessionName.trim() }),
      });
      if (res.success && res.data) {
        const name = res.data.name;
        await loadSession(game.id);
        setSessionName('');
        notify('success', `Session "${name}" started.`);
      } else {
        notify('error', res.error ?? 'Failed to create session.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    if (!window.confirm('End this combat session? This cannot be undone.')) return;
    const res = await apiFetch(`/api/combat/session/${session.id}/end`, { method: 'DELETE' });
    if (res.success) {
      setSession(null);
      notify('success', 'Combat session ended.');
    } else {
      notify('error', 'Failed to end session.');
    }
  };

  // ── Object submission core ─────────────────────────────────────────────────

  const doSubmitObject = useCallback(
    async (submission: PendingSubmission, ranges: Record<number, string>): Promise<boolean> => {
      if (!session) return false;
      setSubmitting(true);
      try {
        const rangesArray = Object.entries(ranges).map(([otherId, band]) => ({
          other_object_id: Number(otherId),
          band,
        }));

        const objRes = await apiFetch<CombatObject>(
          `/api/combat/session/${session.id}/object`,
          {
            method: 'POST',
            body: JSON.stringify({ ...submission.objectData, ranges: rangesArray }),
          },
        );
        if (!objRes.success || !objRes.data) {
          notify('error', objRes.error ?? 'Failed to add object.');
          return false;
        }

        const newId = objRes.data.id;

        if (submission.mounts.length > 0) {
          await apiFetch(`/api/combat/session/${session.id}/object/${newId}/weapons`, {
            method: 'POST',
            body: JSON.stringify({ mounts: submission.mounts }),
          });
        }
        if (submission.crew.length > 0) {
          await apiFetch(`/api/combat/session/${session.id}/object/${newId}/crew`, {
            method: 'POST',
            body: JSON.stringify({ crew: submission.crew }),
          });
        }

        await loadSession(session.game_id);
        notify('success', `${String(submission.objectData.name)} added.`);
        return true;
      } catch {
        notify('error', 'Unexpected error adding object.');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [session, loadSession, notify],
  );

  const openRangeModal = (submission: PendingSubmission) => {
    if (!session) return;
    const initial: Record<number, string> = {};
    for (const obj of (session.objects ?? [])) initial[obj.id] = 'VERY LONG';
    setPendingSubmission(submission);
    setPendingRanges(initial);
    setRangeModalOpen(true);
  };

  const handleConfirmRanges = async () => {
    if (!pendingSubmission) return;
    const ok = await doSubmitObject(pendingSubmission, pendingRanges);
    if (ok) {
      setRangeModalOpen(false);
      setPendingSubmission(null);
      setShipForm(DEFAULT_SHIP);
      setMounts([]);
      setCrew([]);
      setPlanetForm({ name: '', radius_km: 10000 });
      setStationForm({ name: '' });
    }
  };

  // ── Weapon mount builder ───────────────────────────────────────────────────

  const addMount = () =>
    setMounts((prev) => [...prev, { mount_type: 'Single Turret', weapons: ['Beam Laser'] }]);

  const removeMount = (i: number) =>
    setMounts((prev) => prev.filter((_, idx) => idx !== i));

  const updateMountType = (i: number, mountType: string) => {
    const slots = MOUNT_SLOTS[mountType] ?? 1;
    setMounts((prev) =>
      prev.map((m, idx) => {
        if (idx !== i) return m;
        const weapons = Array.from({ length: slots }, (_, wi) => m.weapons[wi] ?? 'Beam Laser');
        return { mount_type: mountType, weapons };
      }),
    );
  };

  const updateWeaponType = (mi: number, wi: number, weaponType: string) =>
    setMounts((prev) =>
      prev.map((m, idx) =>
        idx !== mi ? m : { ...m, weapons: m.weapons.map((w, j) => (j === wi ? weaponType : w)) },
      ),
    );

  const totalPower = mounts.reduce(
    (s, m) => s + m.weapons.reduce((ws, w) => ws + (WEAPON_POWER[w] ?? 0), 0),
    0,
  );
  const totalAmmo = mounts.reduce(
    (s, m) => s + m.weapons.reduce((ws, w) => ws + (WEAPON_AMMO[w] ?? 0), 0),
    0,
  );

  // ── NPC crew ───────────────────────────────────────────────────────────────

  const addCrewMember = () =>
    setCrew((prev) => [...prev, { id: crypto.randomUUID(), name: '', role: 'PILOT', hp_max: 10 }]);

  const removeCrewMember = (id: string) =>
    setCrew((prev) => prev.filter((c) => c.id !== id));

  const updateCrew = (id: string, field: keyof Omit<CrewEntry, 'id'>, value: string | number) =>
    setCrew((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  // ── Ship submit ────────────────────────────────────────────────────────────

  const handleAddShip = async () => {
    if (!session || !shipForm.name.trim()) {
      notify('error', 'Ship name is required.');
      return;
    }

    const hasPlayerShip = session.objects.some((o) => o.is_player_ship);
    const isPlayerShip = hasPlayerShip ? false : shipForm.is_player_ship;
    const finalName = shipForm.type_desc.trim()
      ? `${shipForm.name.trim()} (${shipForm.type_desc.trim()})`
      : shipForm.name.trim();

    const objectData: Record<string, unknown> = {
      object_type: 'SHIP',
      name: finalName,
      is_player_ship: isPlayerShip,
      tl: shipForm.tl,
      size_tons: shipForm.size_tons,
      max_thrust: shipForm.max_thrust,
      base_armor: shipForm.base_armor,
      current_armor: shipForm.base_armor,
      hull_max: shipForm.hull_max,
      hull_current: shipForm.hull_max,
      fuel_capacity: shipForm.fuel_capacity,
      fuel_current: shipForm.fuel_current,
      power_max: shipForm.power_max,
      computer_rating: shipForm.computer_rating,
      marines: shipForm.marines,
      passengers: shipForm.passengers,
      cargo_weight: shipForm.cargo_weight,
      cargo_value: shipForm.cargo_value,
    };

    if (!isPlayerShip) {
      Object.assign(objectData, {
        pilot_skill_dm: shipForm.pilot_skill_dm,
        leadership_skill_dm: shipForm.leadership_skill_dm,
        naval_tactics_dm: shipForm.naval_tactics_dm,
        captain_soc_dm: shipForm.captain_soc_dm,
        gunner_skill_dm: shipForm.gunner_skill_dm,
        gunner_dex_dm: shipForm.gunner_dex_dm,
        engineer_skill_dm: shipForm.engineer_skill_dm,
        engineer_int_dm: shipForm.engineer_int_dm,
        sensor_op_skill_dm: shipForm.sensor_op_skill_dm,
        sensor_op_int_dm: shipForm.sensor_op_int_dm,
      });
    }

    const submission: PendingSubmission = {
      objectData,
      mounts: mounts.map((m) => ({
        mount_type: m.mount_type,
        weapons: m.weapons.map((w) => ({ weapon_type: w })),
      })),
      crew: crew.map(({ name, role, hp_max }) => ({ name, role, hp_max })),
    };

    if (session.objects.length > 0) {
      openRangeModal(submission);
    } else {
      const ok = await doSubmitObject(submission, {});
      if (ok) {
        setShipForm(DEFAULT_SHIP);
        setMounts([]);
        setCrew([]);
      }
    }
  };

  // ── Planet submit ──────────────────────────────────────────────────────────

  const handleAddPlanet = async () => {
    if (!session || !planetForm.name.trim()) {
      notify('error', 'Planet name is required.');
      return;
    }
    const submission: PendingSubmission = {
      objectData: { object_type: 'PLANET', name: planetForm.name.trim(), radius_km: planetForm.radius_km },
      mounts: [],
      crew: [],
    };
    if (session.objects.length > 0) {
      openRangeModal(submission);
    } else {
      const ok = await doSubmitObject(submission, {});
      if (ok) setPlanetForm({ name: '', radius_km: 10000 });
    }
  };

  // ── Station submit ─────────────────────────────────────────────────────────

  const handleAddStation = async () => {
    if (!session || !stationForm.name.trim()) {
      notify('error', 'Station name is required.');
      return;
    }
    const submission: PendingSubmission = {
      objectData: { object_type: 'STATION', name: stationForm.name.trim() },
      mounts: [],
      crew: [],
    };
    if (session.objects.length > 0) {
      openRangeModal(submission);
    } else {
      const ok = await doSubmitObject(submission, {});
      if (ok) setStationForm({ name: '' });
    }
  };

  // ── Missile salvo submit ───────────────────────────────────────────────────

  const handleAddMissile = async () => {
    if (!session || !missileForm.origin_object_id || !missileForm.target_object_id) {
      notify('error', 'Origin and target ships are required.');
      return;
    }
    const originObj = session.objects.find((o) => o.id === missileForm.origin_object_id);
    const targetObj = session.objects.find((o) => o.id === missileForm.target_object_id);
    if (!originObj || !targetObj) return;

    const rangeRecord = getRange(session.ranges, missileForm.origin_object_id, missileForm.target_object_id);
    const band = rangeRecord?.band ?? 'VERY LONG';
    const rounds = ROUNDS_TO_CONTACT[band] ?? 0;

    setSubmitting(true);
    try {
      const res = await apiFetch<CombatObject>(`/api/combat/session/${session.id}/object`, {
        method: 'POST',
        body: JSON.stringify({
          object_type: 'MISSILE_SALVO',
          name: `${originObj.name} salvo → ${targetObj.name}`,
          origin_object_id: missileForm.origin_object_id,
          target_object_id: missileForm.target_object_id,
          missile_quantity: missileForm.quantity,
          rounds_to_contact: rounds,
        }),
      });
      if (res.success) {
        await loadSession(session.game_id);
        setMissileForm({ origin_object_id: 0, target_object_id: 0, quantity: 12 });
        notify('success', 'Missile salvo added.');
      } else {
        notify('error', res.error ?? 'Failed to add missile salvo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Proceed to initiative ──────────────────────────────────────────────────

  const handleProceed = async () => {
    if (!session) return;
    const res = await apiFetch(`/api/combat/session/${session.id}/phase`, {
      method: 'PATCH',
      body: JSON.stringify({ phase: 'INITIATIVE' }),
    });
    if (res.success) {
      navigate('/combat/initiative');
    } else {
      notify('error', 'Failed to advance phase.');
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const objects = session?.objects ?? [];
  const ranges = session?.ranges ?? [];

  const hasPlayerShip = objects.some((o) => o.is_player_ship);
  const playerShip = objects.find((o) => o.is_player_ship) ?? null;
  const shipObjects = objects.filter((o) => o.object_type === 'SHIP');

  const missileRangeBand =
    missileForm.origin_object_id && missileForm.target_object_id && session
      ? (getRange(ranges, missileForm.origin_object_id, missileForm.target_object_id)?.band ?? null)
      : null;
  const missileRounds = missileRangeBand != null ? (ROUNDS_TO_CONTACT[missileRangeBand] ?? 0) : null;

  const canProceed =
    session != null && session.objects.length >= 2 && session.objects.some((o) => o.is_player_ship);

  // ── Render: loading / no game ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading…</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100">Combat Setup</h1>
        <p className="text-gray-500 text-sm">No active game found.</p>
      </div>
    );
  }

  // ── STATE 1: No active session ─────────────────────────────────────────────

  if (!session) {
    return (
      <div className="p-8 max-w-md">
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Combat Session</h1>
        <div className="card space-y-4">
          <p className="text-gray-500 text-sm">No active combat session.</p>
          <div className="space-y-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Session Name</label>
            <input
              type="text"
              placeholder="e.g. Ambush at Acis"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              className="input"
            />
          </div>
          <button
            onClick={handleCreateSession}
            disabled={creating || !sessionName.trim()}
            className="btn-primary w-full"
          >
            {creating ? 'Starting…' : 'Start Session'}
          </button>
        </div>
      </div>
    );
  }

  // ── STATE 2: Active session ────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat · GM</p>
          <h1 className="text-2xl font-bold text-gray-100">{session.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Round {session.current_round} · {session.current_phase}
          </p>
        </div>
        <button onClick={handleEndSession} className="btn-danger shrink-0">
          End Session
        </button>
      </div>

      {/* ── SECTION A: Objects list ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
          Combat Objects
        </h2>

        {objects.length === 0 ? (
          <div className="card text-center py-10 text-gray-700 text-sm">
            No objects added yet. Use the form below to add ships, planets, and stations.
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950">
                  {['Name', 'Type', 'Hull', 'Thrust', 'Initiative'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {objects.map((obj) => (
                  <tr key={obj.id} className={`hover:bg-gray-800/40 transition-colors ${obj.is_destroyed ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-gray-200 font-medium">{obj.name}</span>
                      {obj.is_player_ship && (
                        <span className="ml-2 text-xs text-nexus-400">★ Player</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {obj.object_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                      {obj.hull_current != null ? `${obj.hull_current} / ${obj.hull_max}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                      {obj.current_thrust != null
                        ? `${obj.current_thrust} / ${obj.adjusted_max_thrust}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                      {obj.initiative ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Combat Diagram */}
        <div className="card space-y-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Combat Diagram
          </h3>
          {playerShip ? (
            <CombatDiagram
              referenceObjectId={playerShip.id}
              objects={objects as DiagramObject[]}
              ranges={ranges as DiagramRange[]}
            />
          ) : (
            <p className="text-gray-700 text-sm text-center py-4">
              No player ship in session — add a ship with "Is Player Ship" enabled to display the diagram.
            </p>
          )}
        </div>
      </div>

      {/* ── SECTION B: Add Object Panel ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
          Add Object
        </h2>

        <div className="card space-y-5">
          {/* Type tabs */}
          <div className="flex gap-1 p-1 bg-gray-950 rounded-lg w-fit">
            {(['SHIP', 'PLANET', 'STATION', 'MISSILE_SALVO'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-nexus-700 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {tab === 'MISSILE_SALVO' ? 'MISSILE' : tab}
              </button>
            ))}
          </div>

          {/* ── SHIP FORM ── */}
          {activeTab === 'SHIP' && (
            <div className="space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 uppercase tracking-wider">Name *</label>
                  <input
                    type="text"
                    value={shipForm.name}
                    onChange={(e) => setShipForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. ISS Harrier"
                    className="input text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 uppercase tracking-wider">
                    Type Description <span className="text-gray-700 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={shipForm.type_desc}
                    onChange={(e) => setShipForm((p) => ({ ...p, type_desc: e.target.value }))}
                    placeholder="e.g. Free Trader"
                    className="input text-sm"
                  />
                </div>
              </div>

              {/* Is Player Ship toggle — hidden if session already has one */}
              {!hasPlayerShip && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShipForm((p) => ({ ...p, is_player_ship: !p.is_player_ship }))}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                      shipForm.is_player_ship ? 'bg-nexus-600' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${
                        shipForm.is_player_ship ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-400">Is Player Ship</span>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    ['Tech Level', 'tl', 1, 20],
                    ['Size (tons)', 'size_tons', 1, 100000],
                    ['Max Thrust', 'max_thrust', 0, 20],
                    ['Base Armor', 'base_armor', 0, 100],
                    ['Hull Points', 'hull_max', 1, 10000],
                    ['Fuel Cap. (tons)', 'fuel_capacity', 0, 10000],
                    ['Current Fuel', 'fuel_current', 0, 10000],
                    ['Power (base)', 'power_max', 0, 1000],
                    ['Computer Rating', 'computer_rating', 0, 30],
                    ['Marines', 'marines', 0, 1000],
                    ['Passengers', 'passengers', 0, 5000],
                    ['Cargo Weight (tons)', 'cargo_weight', 0, 100000],
                    ['Cargo Value (MCr)', 'cargo_value', 0, 1000000],
                  ] as Array<[string, keyof ShipFormState, number, number]>
                ).map(([label, field, min, max]) => (
                  <div key={String(field)} className="space-y-1">
                    <label className="text-xs text-gray-600 uppercase tracking-wider">{label}</label>
                    <NumberInput
                      value={shipForm[field] as number}
                      onChange={(v) => setShipForm((p) => ({ ...p, [field]: v }))}
                      min={min}
                      max={max}
                    />
                  </div>
                ))}
              </div>

              {/* NPC Skill DMs — only for non-player ships */}
              {!shipForm.is_player_ship && (
                <div className="space-y-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-600 uppercase tracking-wider">NPC Crew Skill DMs</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {(
                      [
                        ['Pilot Skill', 'pilot_skill_dm', -2, 2],
                        ['Leadership', 'leadership_skill_dm', -2, 2],
                        ['Naval Tactics', 'naval_tactics_dm', -2, 2],
                        ['Captain SOC', 'captain_soc_dm', -1, 2],
                        ['Gunner Skill', 'gunner_skill_dm', -2, 2],
                        ['Gunner DEX', 'gunner_dex_dm', -1, 2],
                        ['Engineer Skill', 'engineer_skill_dm', -2, 2],
                        ['Engineer INT', 'engineer_int_dm', -1, 2],
                        ['Sensor Op Skill', 'sensor_op_skill_dm', -2, 2],
                        ['Sensor Op INT', 'sensor_op_int_dm', -1, 2],
                      ] as Array<[string, keyof ShipFormState, number, number]>
                    ).map(([label, field, min, max]) => (
                      <div key={String(field)} className="space-y-1">
                        <label className="text-xs text-gray-600 uppercase tracking-wider">{label}</label>
                        <NumberInput
                          value={shipForm[field] as number}
                          onChange={(v) => setShipForm((p) => ({ ...p, [field]: v }))}
                          min={min}
                          max={max}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weapon Systems */}
              <div className="space-y-3 pt-3 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 uppercase tracking-wider">Weapon Systems</p>
                  <button type="button" onClick={addMount} className="btn-secondary text-xs px-3 py-1.5">
                    + Add Weapon Mount
                  </button>
                </div>

                {mounts.length === 0 ? (
                  <p className="text-gray-700 text-xs">No weapon mounts configured.</p>
                ) : (
                  <div className="space-y-2">
                    {mounts.map((mount, mi) => (
                      <div key={mi} className="flex flex-wrap items-end gap-3 p-3 bg-gray-950 rounded-lg border border-gray-800">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-600 uppercase tracking-wider">Mount Type</label>
                          <select
                            value={mount.mount_type}
                            onChange={(e) => updateMountType(mi, e.target.value)}
                            className="input text-sm w-40"
                          >
                            {MOUNT_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        {mount.weapons.map((wt, wi) => (
                          <div key={wi} className="space-y-1">
                            <label className="text-xs text-gray-600 uppercase tracking-wider">
                              Weapon {wi + 1}
                            </label>
                            <select
                              value={wt}
                              onChange={(e) => updateWeaponType(mi, wi, e.target.value)}
                              className="input text-sm w-36"
                            >
                              {WEAPON_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => removeMount(mi)}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors pb-1.5"
                        >
                          Remove Mount
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-6 text-xs text-gray-500 pl-1 pt-1">
                      <span>
                        Total power required:{' '}
                        <span className="text-gray-300 font-mono">{totalPower}</span>
                      </span>
                      <span>
                        Total ammo items:{' '}
                        <span className="text-gray-300 font-mono">{totalAmmo}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* NPC Crew — only for non-player ships */}
              {!shipForm.is_player_ship && (
                <div className="space-y-3 pt-3 border-t border-gray-800">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600 uppercase tracking-wider">NPC Crew</p>
                    <button type="button" onClick={addCrewMember} className="btn-secondary text-xs px-3 py-1.5">
                      + Add Crew Member
                    </button>
                  </div>

                  {crew.length === 0 ? (
                    <p className="text-gray-700 text-xs">No crew members added.</p>
                  ) : (
                    <div className="space-y-2">
                      {crew.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-end gap-3 p-3 bg-gray-950 rounded-lg border border-gray-800">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 uppercase tracking-wider">Name</label>
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) => updateCrew(c.id, 'name', e.target.value)}
                              placeholder="e.g. Pilot"
                              className="input text-sm w-32"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 uppercase tracking-wider">Role</label>
                            <select
                              value={c.role}
                              onChange={(e) => updateCrew(c.id, 'role', e.target.value)}
                              className="input text-sm w-44"
                            >
                              {CREW_ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 uppercase tracking-wider">HP Max</label>
                            <NumberInput
                              value={c.hp_max}
                              onChange={(v) => updateCrew(c.id, 'hp_max', v)}
                              min={1}
                              className="input text-sm w-20"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCrewMember(c.id)}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors pb-1.5"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleAddShip}
                disabled={submitting || !shipForm.name.trim()}
                className="btn-primary"
              >
                {submitting ? 'Adding…' : 'Add Ship'}
              </button>
            </div>
          )}

          {/* ── PLANET FORM ── */}
          {activeTab === 'PLANET' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 uppercase tracking-wider">Name *</label>
                  <input
                    type="text"
                    value={planetForm.name}
                    onChange={(e) => setPlanetForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Acis"
                    className="input text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 uppercase tracking-wider">Radius (km)</label>
                  <NumberInput
                    value={planetForm.radius_km}
                    onChange={(v) => setPlanetForm((p) => ({ ...p, radius_km: v }))}
                    min={1}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Jump distance:{' '}
                <span className="text-gray-400 font-mono">
                  {(planetForm.radius_km * 100).toLocaleString()} km
                </span>
              </p>
              <button
                onClick={handleAddPlanet}
                disabled={submitting || !planetForm.name.trim()}
                className="btn-primary"
              >
                {submitting ? 'Adding…' : 'Add Planet'}
              </button>
            </div>
          )}

          {/* ── STATION FORM ── */}
          {activeTab === 'STATION' && (
            <div className="space-y-4">
              <div className="space-y-1 max-w-sm">
                <label className="text-xs text-gray-600 uppercase tracking-wider">Name *</label>
                <input
                  type="text"
                  value={stationForm.name}
                  onChange={(e) => setStationForm({ name: e.target.value })}
                  placeholder="e.g. Highport Alpha"
                  className="input text-sm"
                />
              </div>
              <button
                onClick={handleAddStation}
                disabled={submitting || !stationForm.name.trim()}
                className="btn-primary"
              >
                {submitting ? 'Adding…' : 'Add Station'}
              </button>
            </div>
          )}

          {/* ── MISSILE SALVO FORM ── */}
          {activeTab === 'MISSILE_SALVO' && (
            <div className="space-y-4">
              {shipObjects.length < 2 ? (
                <p className="text-gray-600 text-sm">
                  At least two ships must be in the session to launch a missile salvo.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600 uppercase tracking-wider">Origin Ship</label>
                      <select
                        value={missileForm.origin_object_id}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setMissileForm((p) => ({
                            ...p,
                            origin_object_id: v,
                            target_object_id: p.target_object_id === v ? 0 : p.target_object_id,
                          }));
                        }}
                        className="input text-sm"
                      >
                        <option value={0}>— Select origin —</option>
                        {shipObjects.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600 uppercase tracking-wider">Target Ship</label>
                      <select
                        value={missileForm.target_object_id}
                        onChange={(e) =>
                          setMissileForm((p) => ({ ...p, target_object_id: parseInt(e.target.value, 10) }))
                        }
                        className="input text-sm"
                      >
                        <option value={0}>— Select target —</option>
                        {shipObjects
                          .filter((o) => o.id !== missileForm.origin_object_id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600 uppercase tracking-wider">Quantity</label>
                      <NumberInput
                        value={missileForm.quantity}
                        onChange={(v) => setMissileForm((p) => ({ ...p, quantity: v }))}
                        min={1}
                      />
                    </div>
                  </div>

                  {missileRangeBand != null && (
                    <div className="flex gap-6 text-xs text-gray-500 pl-1">
                      <span>
                        Range to target:{' '}
                        <span className="text-amber-400 font-mono">{missileRangeBand}</span>
                      </span>
                      <span>
                        Rounds to contact:{' '}
                        <span className="text-amber-400 font-mono">{missileRounds}</span>
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleAddMissile}
                    disabled={submitting || !missileForm.origin_object_id || !missileForm.target_object_id}
                    className="btn-primary"
                  >
                    {submitting ? 'Launching…' : 'Launch Salvo'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION D: Proceed ── */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-300">Proceed to Initiative Phase</p>
          {!canProceed && (
            <p className="text-xs text-gray-600 mt-0.5">
              Requires at least 2 objects and 1 player ship in the session.
            </p>
          )}
        </div>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary shrink-0">
          Proceed →
        </button>
      </div>

      {/* ── Range Assignment Modal ── */}
      {rangeModalOpen && pendingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-100">
                Set Initial Ranges for{' '}
                <span className="text-nexus-400">{String(pendingSubmission.objectData.name)}</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Set the starting range band to each existing object.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {objects.map((obj) => (
                <div key={obj.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">{obj.name}</span>
                  <select
                    value={pendingRanges[obj.id] ?? 'VERY LONG'}
                    onChange={(e) =>
                      setPendingRanges((prev) => ({ ...prev, [obj.id]: e.target.value }))
                    }
                    className="input text-sm w-36 shrink-0"
                  >
                    {BANDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setRangeModalOpen(false);
                  setPendingSubmission(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleConfirmRanges} disabled={submitting} className="btn-primary">
                {submitting ? 'Adding…' : 'Confirm Ranges'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
