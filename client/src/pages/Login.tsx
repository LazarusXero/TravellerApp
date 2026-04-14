import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinPad } from '../components/PinPad';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../hooks/useApi';

interface PlayerEntry {
  id: number;
  name: string;
  role: string;
}

interface LoginResponse {
  id: number;
  name: string;
  role: string;
  active_character_id: number | null;
}

export function Login() {
  const { login, player } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlayerEntry | null>(null);

  // Already authenticated → redirect
  useEffect(() => {
    if (player) {
      navigate(player.role === 'gm' ? '/gm' : '/player', { replace: true });
    }
  }, [player, navigate]);

  useEffect(() => {
    apiFetch<PlayerEntry[]>('/api/players').then((res) => {
      if (res.success && res.data) setPlayers(res.data);
      setLoading(false);
    });
  }, []);

  const handlePinSubmit = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!selected) return false;
      const res = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ player_id: selected.id, pin }),
      });
      if (res.success && res.data) {
        login(res.data);
        navigate(res.data.role === 'gm' ? '/gm' : '/player', { replace: true });
        return true;
      }
      return false;
    },
    [selected, login, navigate]
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(68,101,248,1) 1px, transparent 1px), linear-gradient(90deg, rgba(68,101,248,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nexus-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-10">
        {/* Logo */}
        <div className="text-center">
          <div className="text-nexus-400 text-5xl mb-3 leading-none select-none">⬡</div>
          <h1 className="text-3xl font-bold tracking-[0.15em] text-gray-100 uppercase">
            Nexus Command
          </h1>
          <p className="text-gray-600 text-xs tracking-[0.3em] uppercase mt-2">
            Secure Access Terminal
          </p>
        </div>

        {/* Main panel */}
        <div className="w-full">
          {selected ? (
            <div className="flex flex-col items-center">
              <PinPad
                playerName={selected.name}
                onSubmit={handlePinSubmit}
                onBack={() => setSelected(null)}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-center text-gray-500 text-xs uppercase tracking-[0.25em]">
                Select Operator
              </p>

              {loading ? (
                <div className="text-center text-gray-700 py-8">Scanning…</div>
              ) : players.length === 0 ? (
                <div className="card text-center py-10 space-y-3">
                  <p className="text-gray-400 text-lg">No operators registered.</p>
                  <p className="text-gray-600 text-sm">
                    Contact your GM to create an account.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="group card p-4 flex flex-col items-center gap-3 hover:border-nexus-700 hover:bg-nexus-950/40 transition-all duration-150 cursor-pointer"
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 group-hover:border-nexus-600 flex items-center justify-center text-xl font-bold text-gray-300 group-hover:text-nexus-300 transition-colors">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-center">
                        <p className="text-gray-200 font-semibold text-sm leading-tight">
                          {p.name}
                        </p>
                        <span
                          className={`mt-1 inline-block text-xs uppercase tracking-wider ${
                            p.role === 'gm'
                              ? 'text-nexus-400'
                              : 'text-gray-500'
                          }`}
                        >
                          {p.role === 'gm' ? '★ GM' : 'Player'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-gray-800 text-xs tracking-widest uppercase">
          Traveller RPG — Nexus Command v1.0
        </p>
      </div>
    </div>
  );
}
