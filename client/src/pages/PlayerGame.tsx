import { useEffect, useState } from 'react';
import { apiFetch } from '../hooks/useApi';

interface CurrentWorld {
  id: number;
  name: string;
  hex_code: string;
  sector: string | null;
  subsector: string | null;
  port_type: string;
  port_attitude: string | null;
  allegiance: string | null;
}

interface Game {
  id: number;
  name: string;
  day: number;
  milieu: string | null;
  is_drinax: boolean;
  in_jump_space: boolean;
  current_world_id: number | null;
  current_world: CurrentWorld | null;
  imperium_standing: number;
  hierate_standing: number;
  imperium_bounty: number | null;
  hierate_bounty: number | null;
}

const ATTITUDE_COLORS: Record<string, string> = {
  Haven: 'bg-amber-900/60 text-amber-300 border-amber-700',
  Friendly: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  Tolerant: 'bg-teal-900/60 text-teal-300 border-teal-700',
  Neutral: 'bg-gray-800 text-gray-400 border-gray-700',
  Suspicious: 'bg-amber-900/40 text-amber-400 border-amber-800',
  Unfriendly: 'bg-orange-900/60 text-orange-300 border-orange-700',
  Hostile: 'bg-red-900/60 text-red-400 border-red-800',
};

function standingLabel(value: number): string {
  if (value >= 20) return 'Ally';
  if (value >= 6) return 'Tolerated';
  if (value >= -5) return 'Ignored';
  if (value >= -20) return 'Irritant';
  if (value >= -40) return 'Infamy';
  return 'Enemy of State';
}

function standingColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function PlayerGame() {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await apiFetch<Game | null>('/api/game');
    if (res.success) setGame(res.data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Player View</p>
        <h1 className="text-2xl font-bold text-gray-100">Game</h1>
      </div>

      {loading ? (
        <p className="text-gray-700">Loading…</p>
      ) : !game ? (
        <div className="card max-w-md">
          <p className="text-gray-500 text-sm">No active campaign. Ask your GM to start one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Location banner */}
          <div
            className={[
              'rounded-xl p-6 border',
              game.in_jump_space
                ? 'bg-nexus-950/60 border-nexus-700'
                : 'bg-gray-900 border-gray-800',
            ].join(' ')}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-2xl leading-none ${game.in_jump_space ? 'animate-pulse' : ''}`}>
                {game.in_jump_space ? '⟡' : '◉'}
              </span>
              <p className="text-xs uppercase tracking-widest text-gray-500">
                {game.in_jump_space ? 'Current Position' : 'Current World'}
              </p>
            </div>

            <p
              className={[
                'text-3xl font-bold',
                game.in_jump_space ? 'text-nexus-300' : 'text-gray-100',
              ].join(' ')}
            >
              {game.in_jump_space ? 'Jump Space' : game.current_world?.name ?? 'Unknown'}
            </p>

            {!game.in_jump_space && game.current_world && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="font-mono text-gray-500 text-sm">{game.current_world.hex_code}</span>
                {game.current_world.subsector && (
                  <span className="text-gray-600 text-sm">{game.current_world.subsector}</span>
                )}
                {game.current_world.port_attitude && (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono border ${ATTITUDE_COLORS[game.current_world.port_attitude] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                    {game.current_world.port_attitude}
                  </span>
                )}
                {game.current_world.allegiance && (
                  <span className="text-gray-600 text-xs">{game.current_world.allegiance}</span>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Campaign</p>
              <p className="text-gray-100 font-semibold text-sm truncate">{game.name}</p>
            </div>

            <div className="card">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Day</p>
              <p className="text-gray-100 font-bold text-2xl leading-none">{game.day}</p>
            </div>

            <div className="card">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Milieu</p>
              <p className="text-gray-100 font-semibold text-sm">{game.milieu ?? '—'}</p>
            </div>

            <div className="card">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Campaign Type</p>
              <span className={`badge ${game.is_drinax ? 'badge-active' : 'badge-inactive'}`}>
                {game.is_drinax ? 'Drinax' : 'Standard'}
              </span>
            </div>
          </div>

          {/* Political Standings (Drinax only) */}
          {game.is_drinax && (
            <div className="card">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                Political Standings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    { label: 'Imperium Standing', value: game.imperium_standing, bounty: game.imperium_bounty },
                    { label: 'Hierate Standing', value: game.hierate_standing, bounty: game.hierate_bounty },
                  ] as const
                ).map(({ label, value, bounty }) => {
                  const status = standingLabel(value);
                  const isIrritantOrWorse = value <= -6;
                  return (
                    <div key={label} className="p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
                      <p className={`text-2xl font-bold ${standingColor(value)}`}>
                        {value > 0 ? '+' : ''}{value}
                      </p>
                      <p className="text-gray-400 text-xs">{status}</p>
                      {isIrritantOrWorse && bounty != null && bounty > 0 && (
                        <p className="text-red-400 text-xs">Bounty: Cr {bounty.toLocaleString()}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
