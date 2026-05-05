import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../hooks/useApi';
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

interface CombatWeapon {
  id: number;
  weapon_type: string;
}

interface CombatWeaponMount {
  id: number;
  mount_type: string;
  weapons: CombatWeapon[];
}

interface CombatCrewMember {
  id: number;
  name: string;
  role: string;
  hp_current: number;
  hp_max: number;
  status: string;
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
  weapon_mounts: CombatWeaponMount[];
  crew_members: CombatCrewMember[];
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

// All roles in the session (from GET /roles)
interface AllRolesRecord {
  character_id: number;
  role: string;
  mount_id: number | null;
  confirmed: boolean;
  character: { id: number; name: string };
}

// Roles that allow multiple concurrent players at the role level.
// GUNNER is included because up to N players can be gunners where N = number of mounts;
// availability is tracked per-mount via takenMounts, not at the role level.
const MULTI_PLAYER_ROLES = new Set(['MARINE', 'PASSENGER', 'GUNNER']);

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_ROLES = [
  'CAPTAIN', 'PILOT', 'GUNNER', 'ENGINEER', 'SENSOR OPERATOR', 'MARINE', 'PASSENGER',
] as const;

type CombatRole = (typeof ALL_ROLES)[number];

const ROLE_DESCRIPTIONS: Record<CombatRole, string> = {
  CAPTAIN:
    'Command the ship. Support initiative, manage crew reassignment, and coordinate boarding actions.',
  PILOT:
    'Fly the ship. Control movement, aid gunners, and take evasive action.',
  GUNNER:
    'Operate a weapon system. Fire weapons, launch missiles, run point defence, and disperse sand.',
  ENGINEER:
    'Manage ship systems. Jump the ship, manage power, overload drives, and conduct repairs.',
  'SENSOR OPERATOR':
    'Run electronics. Acquire sensor locks, jam enemy communications, and counter missiles.',
  MARINE:
    'Lead boarding actions against enemy vessels.',
  PASSENGER:
    'You are not assigned a combat duty. Stay in your stateroom and hope for the best.',
};

const ROLE_LABELS: Record<CombatRole, string> = {
  CAPTAIN: 'Captain',
  PILOT: 'Pilot',
  GUNNER: 'Gunner',
  ENGINEER: 'Engineer',
  'SENSOR OPERATOR': 'Sensor Operator',
  MARINE: 'Marine / Boarding Party',
  PASSENGER: 'Passenger',
};

const SETUP_PHASES = new Set(['SETUP']);

function mountLabel(mount: CombatWeaponMount): string {
  const weapons = mount.weapons.map((w) => w.weapon_type).join(', ');
  return weapons ? `${mount.mount_type} — ${weapons}` : mount.mount_type;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayerCombatSetup() {
  const { player } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameInfo | null>(null);
  const [session, setSession] = useState<CombatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterId, setCharacterId] = useState<number>(0);

  // Role selection state
  const [selectedRole, setSelectedRole] = useState<CombatRole | null>(null);
  const [selectedMountId, setSelectedMountId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<CombatRole | null>(null);
  const [confirmedMountId, setConfirmedMountId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  // NPC crew assignments (CAPTAIN only, local state)
  const [crewAssignments, setCrewAssignments] = useState<Record<number, string>>({});
  const [crewConfirmed, setCrewConfirmed] = useState(false);

  // Taken roles/mounts — polled every 5s; excludes own character
  // takenRoles: role → { characterId, name } (only for confirmed non-exempt roles)
  // takenMounts: mountId → { characterId, name }
  const [takenRoles, setTakenRoles] = useState<Record<string, { characterId: number; name: string }>>({});
  const [takenMounts, setTakenMounts] = useState<Record<number, { characterId: number; name: string }>>({});

  // ── Live character ID fetch (bypasses stale AuthContext session) ──────────────

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

  // ── Game fetch (once) ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const res = await apiFetch<GameInfo>('/api/game');
      if (res.success && res.data) {
        setGame(res.data);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  // ── Polling for active session & phase changes ───────────────────────────────

  useEffect(() => {
    if (!game) return;
    let cancelled = false;

    const poll = async () => {
      const res = await apiFetch<CombatSession | null>(
        `/api/combat/session/active?game_id=${game.id}`,
      );
      if (!cancelled && res.success) {
        setSession(res.data ?? null);
        setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll all session roles to detect taken slots ──────────────────────────────

  const refreshTakenRoles = useCallback(async (sessionId: number, myCharId: number) => {
    const res = await apiFetch<AllRolesRecord[]>(`/api/combat/session/${sessionId}/roles`);
    if (!res.success || !res.data) return;
    const newTakenRoles: Record<string, { characterId: number; name: string }> = {};
    const newTakenMounts: Record<number, { characterId: number; name: string }> = {};
    for (const r of res.data) {
      if (r.character_id === myCharId) continue; // skip own record
      if (!r.confirmed) continue;                 // only confirmed slots block others
      if (!MULTI_PLAYER_ROLES.has(r.role)) {
        newTakenRoles[r.role] = { characterId: r.character_id, name: r.character.name };
      }
      if (r.role === 'GUNNER' && r.mount_id != null) {
        newTakenMounts[r.mount_id] = { characterId: r.character_id, name: r.character.name };
      }
    }
    setTakenRoles(newTakenRoles);
    setTakenMounts(newTakenMounts);
  }, []);

  useEffect(() => {
    if (!session || !characterId) return;
    refreshTakenRoles(session.id, characterId);
    const interval = setInterval(() => refreshTakenRoles(session.id, characterId), 5000);
    return () => clearInterval(interval);
  }, [session?.id, characterId, refreshTakenRoles]);

  // ── Restore role from API when session and character are both known ────────────

  useEffect(() => {
    if (!session || !characterId) return;
    (async () => {
      const res = await apiFetch<CharacterCombatRoleRecord | null>(
        `/api/combat/session/${session.id}/role/${characterId}`,
      );
      if (!res.success || !res.data) return;
      const role = res.data.role as CombatRole;
      if (!ALL_ROLES.includes(role)) return;
      setSelectedRole(role);
      setSelectedMountId(res.data.mount_id ?? null);
      if (res.data.confirmed) {
        setConfirmedRole(role);
        setConfirmedMountId(res.data.mount_id ?? null);
        setConfirmed(true);
      }
    })();
  }, [session?.id, characterId]);

  // ── Initialise NPC crew table when CAPTAIN is confirmed ──────────────────────

  useEffect(() => {
    if (confirmedRole !== 'CAPTAIN') return;
    const ship = session?.objects.find((o) => o.is_player_ship);
    if (!ship || ship.crew_members.length === 0) return;
    setCrewAssignments((prev) => {
      if (Object.keys(prev).length > 0) return prev; // already initialised
      const init: Record<number, string> = {};
      for (const c of ship.crew_members) init[c.id] = c.role;
      return init;
    });
  }, [confirmedRole, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────────

  const playerShip = session?.objects.find((o) => o.is_player_ship) ?? null;
  const inSetup = session != null && SETUP_PHASES.has(session.current_phase);
  const inInitiative = session?.current_phase === 'INITIATIVE';
  const postSetup = session != null && !SETUP_PHASES.has(session.current_phase);

  const canConfirm =
    selectedRole !== null &&
    (selectedRole !== 'GUNNER' || selectedMountId !== null);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectRole = (role: CombatRole) => {
    if (confirmed || !session || !characterId) return;
    setSelectedRole(role);
    if (role !== 'GUNNER') setSelectedMountId(null);
    // Persist selection immediately so it survives a refresh
    void apiFetch(`/api/combat/session/${session.id}/role`, {
      method: 'POST',
      body: JSON.stringify({ character_id: characterId, role, mount_id: null }),
    });
  };

  const handleConfirmRole = async () => {
    if (!session || !selectedRole || !canConfirm || !characterId || confirming) return;
    setConfirming(true);
    try {
      // Upsert with final data (includes mount_id for GUNNER)
      const upsertRes = await apiFetch(`/api/combat/session/${session.id}/role`, {
        method: 'POST',
        body: JSON.stringify({
          character_id: characterId,
          role: selectedRole,
          mount_id: selectedRole === 'GUNNER' ? selectedMountId : null,
        }),
      });
      if (!upsertRes.success) {
        notify('error', upsertRes.error ?? 'Failed to save role.');
        return;
      }
      const confirmRes = await apiFetch(`/api/combat/session/${session.id}/role/confirm`, {
        method: 'POST',
        body: JSON.stringify({ character_id: characterId }),
      });
      if (!confirmRes.success) {
        notify('error', confirmRes.error ?? 'Failed to confirm role.');
        return;
      }
      setConfirmedRole(selectedRole);
      setConfirmedMountId(selectedMountId);
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  };

  const handleChangeRole = async () => {
    if (!session || postSetup || !characterId) return;
    const res = await apiFetch(`/api/combat/session/${session.id}/role/${characterId}`, {
      method: 'DELETE',
    });
    if (res.success) {
      setConfirmed(false);
      setConfirmedRole(null);
      setConfirmedMountId(null);
      setSelectedRole(null);
      setSelectedMountId(null);
      setCrewConfirmed(false);
      setCrewAssignments({});
    } else {
      notify('error', res.error ?? 'Failed to clear role.');
    }
  };

  const handleConfirmCrew = () => setCrewConfirmed(true);

  // ── Render: loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading…</p>
      </div>
    );
  }

  // ── STATE 1: No active session ─────────────────────────────────────────────

  if (!session) {
    return (
      <div className="p-8 max-w-md">
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Combat</h1>
        <div className="card text-center space-y-3 py-10">
          <p className="text-gray-400 text-sm font-medium">No combat session is active.</p>
          <p className="text-gray-600 text-sm">
            Stand by for the GM to initiate combat.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse" />
            <span className="text-xs text-gray-700">Polling every 5 seconds…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE 2: Active session ────────────────────────────────────────────────

  const confirmedMount = playerShip?.weapon_mounts.find((m) => m.id === confirmedMountId);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">{session.name}</h1>
        <p className="text-gray-500 text-sm mt-1">
          Round {session.current_round} · {session.current_phase}
          {player && <span className="ml-2 text-gray-700">· {player.name}</span>}
        </p>
      </div>

      {/* ── SECTION A: Combat Diagram ── */}
      {playerShip ? (
        <div className="card space-y-3">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Battlefield
          </h2>
          <CombatDiagram
            referenceObjectId={playerShip.id}
            objects={session.objects as DiagramObject[]}
            ranges={session.ranges as DiagramRange[]}
          />
        </div>
      ) : (
        <div className="card text-center py-6 text-gray-700 text-sm">
          No player ship in this session yet.
        </div>
      )}

      {/* ── SECTION E: Phase gate (INITIATIVE has started) ── */}
      {inInitiative && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-amber-900/30 border border-amber-700/50">
          <div>
            <p className="text-amber-300 font-semibold text-sm">
              Initiative Phase has begun.
            </p>
            <p className="text-amber-600 text-xs mt-0.5">Proceed when ready.</p>
          </div>
          <button
            onClick={() => navigate('/combat/initiative')}
            className="btn-primary shrink-0"
          >
            Go to Initiative →
          </button>
        </div>
      )}

      {/* ── SECTION B: Role Selection ── */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {confirmed ? 'Your Combat Role' : 'Select Your Combat Role'}
            </h2>
            {!confirmed && (
              <p className="text-gray-600 text-xs mt-1">
                Choose carefully — you can only reassign during the Action/Reaction phase.
              </p>
            )}
          </div>
          {confirmed && inSetup && (
            <button
              onClick={handleChangeRole}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-800 transition-colors shrink-0"
            >
              Change Role
            </button>
          )}
        </div>

        {/* Confirmation banner */}
        {confirmed && confirmedRole && (
          <div className="px-4 py-3 rounded-xl bg-nexus-900/40 border border-nexus-700/50">
            <p className="text-nexus-300 font-semibold text-sm">
              You are the {ROLE_LABELS[confirmedRole]}.
            </p>
            {confirmedRole === 'GUNNER' && confirmedMount && (
              <p className="text-nexus-600 text-xs mt-0.5">
                Assigned to: {mountLabel(confirmedMount)}
              </p>
            )}
            <p className="text-nexus-600 text-xs mt-0.5">
              Stand by for the Initiative Phase.
            </p>
          </div>
        )}

        {/* Role cards */}
        <div className="space-y-2">
          {ALL_ROLES.map((role) => {
            const isSelected = selectedRole === role;
            const isLocked = confirmed || postSetup;
            const takenBy = takenRoles[role]; // set for non-exempt, non-GUNNER roles
            // GUNNER is "taken" only when every mount on the ship is already claimed
            const allMountsTaken =
              role === 'GUNNER' &&
              playerShip != null &&
              playerShip.weapon_mounts.length > 0 &&
              playerShip.weapon_mounts.every((m) => takenMounts[m.id] != null);
            const isTaken = !isLocked && (
              role === 'GUNNER'
                ? allMountsTaken
                : !MULTI_PLAYER_ROLES.has(role) && takenBy != null
            );
            const isDisabled = isLocked || isTaken;

            return (
              <div key={role}>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectRole(role)}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border transition-colors duration-150',
                    isDisabled
                      ? isSelected
                        ? 'bg-nexus-900/30 border-nexus-700/60 cursor-default'
                        : 'bg-gray-900 border-gray-800 cursor-default opacity-40'
                      : isSelected
                        ? 'bg-nexus-900/30 border-nexus-600/70 hover:bg-nexus-900/40'
                        : 'bg-gray-900 border-gray-800 hover:bg-gray-800/60 hover:border-gray-700',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
                        isSelected
                          ? 'border-nexus-500 bg-nexus-500'
                          : 'border-gray-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-sm font-semibold leading-tight ${
                            isSelected ? 'text-nexus-300' : 'text-gray-300'
                          }`}
                        >
                          {ROLE_LABELS[role]}
                        </p>
                        {isTaken && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/40 border border-red-800/60 text-red-400">
                            {role === 'GUNNER' ? 'All mounts taken' : `Taken by ${takenBy!.name}`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Weapon mount dropdown — only when GUNNER is selected and not locked */}
                {role === 'GUNNER' && isSelected && !isLocked && (
                  <div className="mt-1 ml-4 px-4 py-3 bg-gray-950 rounded-xl border border-gray-800 space-y-2">
                    <label className="text-xs text-gray-600 uppercase tracking-wider">
                      Select your weapon mount
                    </label>
                    {!playerShip || playerShip.weapon_mounts.length === 0 ? (
                      <p className="text-gray-700 text-xs">
                        No weapon mounts on the player ship.
                      </p>
                    ) : (
                      <>
                        <select
                          value={selectedMountId ?? ''}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setSelectedMountId(isNaN(v) ? null : v);
                          }}
                          className="input text-sm"
                        >
                          <option value="">— Select a mount —</option>
                          {playerShip.weapon_mounts.map((m) => {
                            const mountTakenBy = takenMounts[m.id];
                            return (
                              <option
                                key={m.id}
                                value={m.id}
                                disabled={mountTakenBy != null}
                              >
                                {mountLabel(m)}
                                {mountTakenBy ? ` — Taken by ${mountTakenBy.name}` : ''}
                              </option>
                            );
                          })}
                        </select>
                        {/* Visual "taken" cues below the dropdown */}
                        {Object.entries(takenMounts).length > 0 && (
                          <div className="space-y-0.5">
                            {playerShip.weapon_mounts
                              .filter((m) => takenMounts[m.id] != null)
                              .map((m) => (
                                <p key={m.id} className="text-xs text-red-500">
                                  {mountLabel(m)} — taken by {takenMounts[m.id]!.name}
                                </p>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Read-only mount display after GUNNER confirmed */}
                {role === 'GUNNER' && isSelected && isLocked && confirmedMount && (
                  <div className="mt-1 ml-4 px-4 py-2 bg-gray-950 rounded-xl border border-gray-800">
                    <p className="text-xs text-gray-500">{mountLabel(confirmedMount)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm Role button */}
        {!confirmed && (
          <button
            onClick={() => { void handleConfirmRole(); }}
            disabled={!canConfirm || confirming}
            className="btn-primary"
          >
            {confirming ? 'Confirming…' : 'Confirm Role'}
          </button>
        )}
      </div>

      {/* ── SECTION C: NPC Crew Assignment (CAPTAIN only, after confirmation) ── */}
      {confirmed && confirmedRole === 'CAPTAIN' && inSetup && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Assign Duties to Non-Player Crew
            </h2>
            <p className="text-gray-600 text-xs mt-1">
              Assign a combat role to each crew member not controlled by a player.
            </p>
          </div>

          {!playerShip || playerShip.crew_members.length === 0 ? (
            <div className="card text-center py-6 text-gray-700 text-sm">
              No crew members on the player ship.
            </div>
          ) : (
            <div className="card p-0 overflow-hidden space-y-0">
              {crewConfirmed && (
                <div className="px-4 py-2 bg-emerald-900/30 border-b border-emerald-800/50">
                  <p className="text-emerald-400 text-xs">Crew assignments confirmed.</p>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950">
                    {['Name', 'Current Role', 'Assign Role'].map((h) => (
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
                  {playerShip.crew_members.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-gray-200">{c.name}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{c.role}</td>
                      <td className="px-4 py-2.5">
                        {crewConfirmed ? (
                          <span className="text-gray-400 text-xs">
                            {crewAssignments[c.id] ?? c.role}
                          </span>
                        ) : (
                          <select
                            value={crewAssignments[c.id] ?? c.role}
                            onChange={(e) =>
                              setCrewAssignments((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            className="input text-xs py-1"
                          >
                            {ALL_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!crewConfirmed && (
                <div className="px-4 py-3 border-t border-gray-800">
                  <button onClick={handleConfirmCrew} className="btn-primary text-sm">
                    Confirm Crew Assignments
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
