import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../hooks/useApi';
import { CombatDiagram } from '../../components/combat/CombatDiagram';
import type { DiagramObject, DiagramRange } from '../../components/combat/CombatDiagram';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameInfo { id: number }

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
  leadership_effect: number;
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

interface CharacterSkill {
  skillName: string;
  level: number | null;
}

interface Character {
  id: number;
  name: string;
  int: number;
  soc: number;
  character_skills: CharacterSkill[];
}

interface CharacterCombatRoleRecord {
  role: string;
  mount_id: number | null;
  confirmed: boolean;
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}


function getBestPilotLevel(character: Character): number | null {
  const pilotSkills = character.character_skills.filter((s) =>
    s.skillName.startsWith('Pilot'),
  );
  if (pilotSkills.length === 0) return null;
  return pilotSkills.reduce(
    (best, s) => Math.max(best, s.level ?? -3),
    -3,
  );
}

function initiativeKey(sessionId: number, characterId: number) {
  return `combat_initiative_${sessionId}_${characterId}`;
}

function objectTag(obj: CombatObject): string {
  if (obj.is_player_ship) return 'Player Ship';
  if (obj.object_type === 'MISSILE_SALVO') return 'Missile';
  return 'NPC';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormulaRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b border-gray-800/60 last:border-0">
      <div>
        <span className="text-gray-400 text-sm">{label}</span>
        {sub && <p className="text-gray-700 text-xs mt-0.5">{sub}</p>}
      </div>
      <span className="font-mono text-gray-200 text-sm shrink-0">{value}</span>
    </div>
  );
}

function ProceedBanner({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-amber-900/30 border border-amber-700/50">
      <div>
        <p className="text-amber-300 font-semibold text-sm">Manoeuvre Phase has begun.</p>
        <p className="text-amber-600 text-xs mt-0.5">Proceed when ready.</p>
      </div>
      <button onClick={onClick} className="btn-primary shrink-0">
        Go to Manoeuvre →
      </button>
    </div>
  );
}

// ── PILOT section ──────────────────────────────────────────────────────────────

function PilotSection({
  character,
  playerShip,
  session,
  characterId,
}: {
  character: Character | null;
  playerShip: CombatObject;
  session: CombatSession;
  characterId: number;
}) {
  const navigate = useNavigate();
  const { notify } = useApp();

  const pilotLevel = character ? getBestPilotLevel(character) : null;
  const pilotDM = pilotLevel ?? -3;
  const thrust = playerShip.current_thrust ?? 0;
  const leadershipEffect = playerShip.leadership_effect ?? 0;

  // Captain's initiative contribution comes from leadership_effect set in the
  // previous round's Action Phase — no separate Initiative Phase captain roll needed.

  // Check if already submitted
  const [submitted, setSubmitted] = useState(false);
  const [submittedTotal, setSubmittedTotal] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(initiativeKey(session.id, characterId));
      if (raw) {
        const parsed = JSON.parse(raw) as { initiative: number };
        setSubmitted(true);
        setSubmittedTotal(parsed.initiative);
      }
    } catch { /* ignore */ }
  }, [session.id, characterId]);

  const [pilotRoll, setPilotRoll] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rollNum = parseInt(pilotRoll, 10);
  const validRoll = !isNaN(rollNum) && rollNum >= 2 && rollNum <= 12;

  const total = validRoll
    ? rollNum + pilotDM + thrust + leadershipEffect
    : null;

  // Initiative order (sorted)
  const initiativeOrder = [...session.objects]
    .filter((o) => o.initiative != null)
    .sort((a, b) => {
      const iDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
      if (iDiff !== 0) return iDiff;
      return (b.current_thrust ?? 0) - (a.current_thrust ?? 0);
    });

  const handleSubmit = async () => {
    if (total == null) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/combat/object/${playerShip.id}/initiative`, {
        method: 'POST',
        body: JSON.stringify({ initiative: total }),
      });
      if (res.success) {
        localStorage.setItem(initiativeKey(session.id, characterId), JSON.stringify({ initiative: total }));
        setSubmitted(true);
        setSubmittedTotal(total);
        notify('success', `Initiative submitted: ${total}`);
      } else {
        notify('error', res.error ?? 'Failed to submit initiative.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (session.current_phase === 'MANOEUVRE') {
    return <ProceedBanner onClick={() => navigate('/combat/manoeuvre')} />;
  }

  if (submitted && submittedTotal != null) {
    return (
      <div className="space-y-4">
        <div className="px-4 py-3 rounded-xl bg-nexus-900/40 border border-nexus-700/50">
          <p className="text-nexus-300 font-semibold text-sm">
            Initiative submitted: {submittedTotal}
          </p>
          <p className="text-nexus-600 text-xs mt-0.5">Waiting for all ships to roll…</p>
        </div>

        {initiativeOrder.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-2 bg-gray-950 border-b border-gray-800">
              <p className="text-xs text-gray-600 uppercase tracking-wider">Current Initiative Order</p>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-800/60">
                {initiativeOrder.map((obj, i) => (
                  <tr key={obj.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 w-8">#{i + 1}</td>
                    <td className="px-4 py-2">
                      <span className={`font-medium text-sm ${obj.is_player_ship ? 'text-nexus-300' : 'text-gray-300'}`}>
                        {obj.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-sm font-bold text-gray-100 text-right">
                      {obj.initiative}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        obj.is_player_ship
                          ? 'bg-nexus-900/40 text-nexus-400'
                          : obj.object_type === 'MISSILE_SALVO'
                            ? 'bg-amber-900/40 text-amber-400'
                            : 'bg-gray-800 text-gray-500'
                      }`}>
                        {objectTag(obj)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Roll Initiative</h2>
        <p className="text-gray-500 text-sm mt-1">Calculate and submit the ship's initiative value.</p>
      </div>

      {/* Formula */}
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
            value={pilotRoll}
            onChange={(e) => setPilotRoll(e.target.value)}
            placeholder="2–12"
            className="input text-sm w-24 text-right"
          />
        </div>

        <FormulaRow
          label="+ Pilot Skill DM"
          value={fmtSign(pilotDM)}
          sub={
            pilotLevel != null
              ? `Best Pilot skill ${pilotLevel} → DM${fmtSign(pilotDM)}`
              : 'Untrained → DM−3'
          }
        />
        <FormulaRow
          label="+ Current Thrust"
          value={fmtSign(thrust)}
          sub={`Ship current thrust: ${thrust}`}
        />
        <FormulaRow
          label="+ Leadership Effect"
          value={fmtSign(leadershipEffect)}
          sub={
            leadershipEffect !== 0
              ? `Captain's Improve Initiative from previous round: ${fmtSign(leadershipEffect)}`
              : 'No leadership bonus this round'
          }
        />
      </div>

      {/* Total */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800">
        <span className="text-gray-400 text-sm font-medium">Initiative Total</span>
        <span className={`font-mono text-lg font-bold ${
          total != null ? 'text-nexus-300' : 'text-gray-700'
        }`}>
          {total != null ? total : '—'}
        </span>
      </div>

      <button
        onClick={handleSubmit}
        disabled={total == null || submitting}
        className="btn-primary"
      >
        {submitting ? 'Submitting…' : 'Submit Initiative'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayerCombatInitiative() {
  const { player } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameInfo | null>(null);
  const [session, setSession] = useState<CombatSession | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterId, setCharacterId] = useState<number>(0);

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

  // ── Data loading & polling ─────────────────────────────────────────────────

  const loadSession = useCallback(async (gameId: number) => {
    const res = await apiFetch<CombatSession | null>(
      `/api/combat/session/active?game_id=${gameId}`,
    );
    if (res.success) setSession(res.data ?? null);
  }, []);

  useEffect(() => {
    if (!characterId) return;
    (async () => {
      const gameRes = await apiFetch<GameInfo>('/api/game');
      if (!gameRes.success || !gameRes.data) { setLoading(false); return; }
      setGame(gameRes.data);
      await loadSession(gameRes.data.id);

      const charRes = await apiFetch<Character>(`/api/characters/${characterId}`);
      if (charRes.success && charRes.data) setCharacter(charRes.data);

      setLoading(false);
    })();
  }, [loadSession, characterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling for phase changes
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    const poll = async () => {
      const res = await apiFetch<CombatSession | null>(
        `/api/combat/session/active?game_id=${game.id}`,
      );
      if (!cancelled && res.success) setSession(res.data ?? null);
    };
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch confirmed role from API ──────────────────────────────────────────

  useEffect(() => {
    if (!session || !characterId) return;
    setRole(null); // reset on session/character change while fetching
    (async () => {
      const res = await apiFetch<CharacterCombatRoleRecord | null>(
        `/api/combat/session/${session.id}/role/${characterId}`,
      );
      if (res.success && res.data?.confirmed) {
        setRole(res.data.role);
      }
    })();
  }, [session?.id, characterId]);

  // ── Derived ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-8"><p className="text-gray-700 text-sm">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-nexus-500 text-xs uppercase tracking-widest">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Initiative</h1>
        <p className="text-gray-500 text-sm">No active combat session.</p>
      </div>
    );
  }

  const playerShip = session.objects.find((o) => o.is_player_ship) ?? null;
  const inManoeuvre = session.current_phase === 'MANOEUVRE';

  const ROLE_LABELS: Record<string, string> = {
    CAPTAIN: 'Captain',
    PILOT: 'Pilot',
    GUNNER: 'Gunner',
    ENGINEER: 'Engineer',
    'SENSOR OPERATOR': 'Sensor Operator',
    MARINE: 'Marine / Boarding Party',
    PASSENGER: 'Passenger',
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Combat</p>
        <h1 className="text-2xl font-bold text-gray-100">Initiative</h1>
        <p className="text-gray-500 text-sm mt-1">
          {session.name} · Round {session.current_round}
          {role && (
            <span className="ml-2 text-nexus-500">
              · Your Role: {ROLE_LABELS[role] ?? role}
            </span>
          )}
        </p>
      </div>

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

      {/* Phase gate: MANOEUVRE started */}
      {inManoeuvre && (
        <ProceedBanner onClick={() => navigate('/combat/manoeuvre')} />
      )}

      {/* Role-specific section */}
      {!inManoeuvre && (
        <>
          {role === 'PILOT' && playerShip && (
            <PilotSection
              character={character}
              playerShip={playerShip}
              session={session}
              characterId={characterId}
            />
          )}

          {role === 'PILOT' && !playerShip && (
            <div className="card text-center py-8 text-gray-700 text-sm">
              No player ship found in this session.
            </div>
          )}

          {role !== 'PILOT' && (
            <div className="card space-y-3">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stand By</h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-nexus-600 animate-pulse shrink-0" />
                The Pilot is rolling for initiative.
              </div>
              <p className="text-gray-700 text-xs">
                You will be notified when the Manoeuvre Phase begins.
              </p>
            </div>
          )}

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
