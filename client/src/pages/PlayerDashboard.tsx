import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

interface Character {
  id: number;
  name: string;
  portrait_url: string | null;
  description: string | null;
  str: number;
  dex: number;
  end: number;
  int: number;
  edu: number;
  soc: number;
  skills: string;
  credits: number;
  skill_points: number;
}

interface PlayerDetail {
  id: number;
  name: string;
  role: string;
  active_character: Character | null;
}

const STATS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'end', label: 'END' },
  { key: 'int', label: 'INT' },
  { key: 'edu', label: 'EDU' },
  { key: 'soc', label: 'SOC' },
] as const;

function statDM(value: number): string {
  const dm = Math.floor(value / 3) - 2;
  return dm >= 0 ? `+${dm}` : `${dm}`;
}

export function PlayerDashboard() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!player) return;

    // Redirect away from /player if the player already has characters
    apiFetch<{ id: number; isActive: boolean }[]>(`/api/characters/player/${player.id}`).then(
      (res) => {
        if (res.success && res.data && res.data.length > 0) {
          navigate('/player/characters', { replace: true });
          return;
        }
        // No characters — stay on this page and load player detail
        apiFetch<PlayerDetail>(`/api/players/${player.id}`).then((inner) => {
          if (inner.success && inner.data) setDetail(inner.data);
          setLoading(false);
        });
      },
    );
  }, [player, navigate]);

  const char = detail?.active_character ?? null;

  let skills: Record<string, number> = {};
  if (char?.skills) {
    try { skills = JSON.parse(char.skills) as Record<string, number>; } catch { /* empty */ }
  }
  const skillEntries = Object.entries(skills).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Operator Console</p>
          <h1 className="text-2xl font-bold text-gray-100">
            {player?.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Personal Dashboard</p>
        </div>
        <button
          onClick={() => navigate('/player/create-character')}
          className="btn-primary shrink-0"
        >
          + Create Character
        </button>
      </div>

      {loading ? (
        <p className="text-gray-700">Loading…</p>
      ) : !char ? (
        <div className="card text-center py-12 space-y-4">
          <p className="text-gray-400 text-lg">No character yet.</p>
          <button
            onClick={() => navigate('/player/create-character')}
            className="text-nexus-400 hover:text-nexus-300 text-sm transition-colors"
          >
            Create your first character →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Character identity */}
          <div className="card space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-nexus-900 border border-nexus-700 flex items-center justify-center text-2xl font-bold text-nexus-300">
                {char.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-100">{char.name}</h2>
                {char.description && (
                  <p className="text-gray-500 text-xs mt-0.5">{char.description}</p>
                )}
              </div>
            </div>

            {/* Credits */}
            <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Credits</p>
              <p className="text-xl font-bold text-emerald-400">
                Cr {char.credits.toLocaleString()}
              </p>
            </div>

            {/* Skill points */}
            <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Skill Points</p>
              <p className="text-xl font-bold text-nexus-400">{char.skill_points}</p>
            </div>
          </div>

          {/* Characteristics */}
          <div className="card">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Characteristics
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {STATS.map(({ key, label }) => {
                const val = char[key];
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center p-3 rounded-lg bg-gray-800 border border-gray-700"
                  >
                    <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                      {label}
                    </span>
                    <span className="text-2xl font-bold text-gray-100">{val}</span>
                    <span className="text-xs text-gray-600 mt-0.5">{statDM(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skills */}
          <div className="card">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Skills
            </h3>
            {skillEntries.length === 0 ? (
              <p className="text-gray-700 text-sm">No skills trained yet.</p>
            ) : (
              <ul className="space-y-2">
                {skillEntries.map(([skill, level]) => (
                  <li
                    key={skill}
                    className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0"
                  >
                    <span className="text-gray-300 text-sm">{skill}</span>
                    <span className="text-nexus-400 font-bold text-sm">{level}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
