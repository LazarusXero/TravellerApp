import { useEffect, useState } from 'react';
import { apiFetch } from '../hooks/useApi';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';

interface PlayerEntry {
  id: number;
  name: string;
  role: string;
  active_character_id: number | null;
  created_at: string;
}

export function GmDashboard() {
  const { player } = useAuth();
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PlayerEntry[]>('/api/players').then((res) => {
      if (res.success && res.data) setPlayers(res.data);
      setLoading(false);
    });
  }, []);

  const humanPlayers = players.filter((p) => p.role === 'player');
  const withCharacter = players.filter((p) => p.active_character_id !== null);

  return (
    <div className="p-8 space-y-8">
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">GM Console</p>
        <h1 className="text-2xl font-bold text-gray-100">Mission Control</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back, <span className="text-nexus-400">{player?.name}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Players"
          value={loading ? '…' : humanPlayers.length}
          icon="◎"
          trend="Registered operators"
        />
        <StatCard
          label="Active Characters"
          value={loading ? '…' : withCharacter.length}
          icon="★"
          trend="With active character"
          accent
        />
        <StatCard label="Worlds" value="—" icon="◉" trend="Coming soon" />
        <StatCard label="Game Day" value="—" icon="▦" trend="Coming soon" />
      </div>

      {/* Player roster */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Operator Roster
        </h2>
        {loading ? (
          <p className="text-gray-700 text-sm">Loading…</p>
        ) : players.length === 0 ? (
          <p className="text-gray-600 text-sm">
            No operators yet. Go to Players to create them.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-800"
              >
                <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-200 text-sm font-medium truncate">{p.name}</p>
                  <p className="text-gray-600 text-xs">
                    {p.active_character_id
                      ? `Character #${p.active_character_id}`
                      : 'No character'}
                  </p>
                </div>
                <span
                  className={`ml-auto shrink-0 text-xs uppercase tracking-wider ${
                    p.role === 'gm' ? 'text-nexus-400' : 'text-gray-600'
                  }`}
                >
                  {p.role === 'gm' ? 'GM' : 'PLR'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
