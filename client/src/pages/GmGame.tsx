import { useEffect, useState, useRef, FormEvent } from 'react';
import { apiFetch } from '../hooks/useApi';
import { useApp } from '../context/AppContext';

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
  created_at: string;
}

interface WorldOption {
  id: number;
  name: string;
  hex_code: string;
  port_type: string;
  subsector: string | null;
  sector: string | null;
}

const PORT_COLORS: Record<string, string> = {
  A: 'bg-amber-900/60 text-amber-300 border-amber-700',
  B: 'bg-blue-900/60 text-blue-300 border-blue-700',
  C: 'bg-teal-900/60 text-teal-300 border-teal-700',
  D: 'bg-gray-800 text-gray-400 border-gray-700',
  E: 'bg-orange-900/60 text-orange-300 border-orange-700',
  X: 'bg-red-900/60 text-red-400 border-red-800',
};

const ATTITUDE_COLORS: Record<string, string> = {
  Haven: 'bg-amber-900/60 text-amber-300 border-amber-700',
  Friendly: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  Tolerant: 'bg-teal-900/60 text-teal-300 border-teal-700',
  Neutral: 'bg-gray-800 text-gray-400 border-gray-700',
  Suspicious: 'bg-amber-900/40 text-amber-400 border-amber-800',
  Unfriendly: 'bg-orange-900/60 text-orange-300 border-orange-700',
  Hostile: 'bg-red-900/60 text-red-400 border-red-800',
};

// ── World Picker Modal ────────────────────────────────────────────────────────

interface WorldPickerProps {
  game: Game;
  onSelect: (game: Game) => void;
  onClose: () => void;
}

function WorldPicker({ game, onSelect, onClose }: WorldPickerProps) {
  const { notify } = useApp();
  const [worlds, setWorlds] = useState<WorldOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<WorldOption[]>('/api/worlds').then((res) => {
      if (res.success && res.data) setWorlds(res.data);
      setLoading(false);
      searchRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = search.trim()
    ? worlds.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.hex_code.toLowerCase().includes(search.toLowerCase()) ||
          (w.subsector?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : worlds;

  const handleSetJump = async () => {
    if (acting) return;
    setActing(true);
    const res = await apiFetch<Game>(`/api/game/${game.id}/set-jump`, { method: 'PATCH' });
    setActing(false);
    if (res.success && res.data) {
      onSelect(res.data);
      notify('success', 'Entered jump space');
    } else {
      notify('error', 'Failed to enter jump space');
    }
  };

  const handleSetWorld = async (world: WorldOption) => {
    if (acting) return;
    setActing(true);
    const res = await apiFetch<Game>(`/api/game/${game.id}/set-world`, {
      method: 'PATCH',
      body: JSON.stringify({ world_id: world.id }),
    });
    setActing(false);
    if (res.success && res.data) {
      onSelect(res.data);
      notify('success', `Current world set to ${world.name}`);
    } else {
      notify('error', 'Failed to set world');
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-200">Set Current World</h2>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
          </div>
          {/* Enter Jump Space shortcut */}
          <button
            onClick={() => void handleSetJump()}
            disabled={acting}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-nexus-950/60 border border-nexus-800 hover:border-nexus-600 transition-colors text-left mb-3"
          >
            <span className="text-nexus-400 text-lg animate-pulse">⟡</span>
            <div>
              <p className="text-nexus-300 text-sm font-medium">Enter Jump Space</p>
              <p className="text-gray-600 text-xs">Clears current world</p>
            </div>
          </button>
          {/* Search */}
          <input
            ref={searchRef}
            type="search"
            placeholder="Search by name, hex, subsector…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full"
          />
        </div>

        {/* World list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="px-5 py-4 text-gray-600 text-sm">Loading worlds…</p>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-4 text-gray-600 text-sm">No worlds match.</p>
          ) : (
            <ul className="divide-y divide-gray-800/60">
              {filtered.map((w) => {
                const portCls = PORT_COLORS[w.port_type] ?? 'bg-gray-800 text-gray-400 border-gray-700';
                const isCurrent = w.id === game.current_world_id;
                return (
                  <li key={w.id}>
                    <button
                      onClick={() => void handleSetWorld(w)}
                      disabled={acting || isCurrent}
                      className={[
                        'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors',
                        isCurrent
                          ? 'bg-nexus-950/40 cursor-default'
                          : 'hover:bg-gray-800/50',
                      ].join(' ')}
                    >
                      <span className="font-mono text-gray-600 text-xs w-10 shrink-0">{w.hex_code}</span>
                      <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded text-xs font-mono border ${portCls}`}>
                        {w.port_type}
                      </span>
                      <span className="text-gray-200 text-sm font-medium flex-1 min-w-0 truncate">{w.name}</span>
                      <span className="text-gray-600 text-xs shrink-0">{w.subsector ?? ''}</span>
                      {isCurrent && <span className="text-nexus-500 text-xs shrink-0">current</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GmGame() {
  const { notify } = useApp();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [form, setForm] = useState({ name: '', milieu: '1105', is_drinax: true, day: '1' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const res = await apiFetch<Game | null>('/api/game');
    if (res.success) setGame(res.data ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const day = parseInt(form.day, 10);
    if (!form.name.trim()) { notify('error', 'Name is required'); return; }
    if (isNaN(day) || day < 1) { notify('error', 'Starting day must be ≥ 1'); return; }
    setCreating(true);

    if (game) {
      const del = await fetch(`/api/game/${game.id}`, { method: 'DELETE' });
      if (!del.ok) {
        notify('error', 'Failed to remove existing campaign');
        setCreating(false);
        return;
      }
      setGame(null);
    }

    const res = await apiFetch<Game>('/api/game', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        milieu: form.milieu || undefined,
        is_drinax: form.is_drinax,
        day,
      }),
    });
    setCreating(false);
    if (res.success && res.data) {
      setGame(res.data);
      setShowForm(false);
      notify('success', `Campaign "${res.data.name}" created`);
    } else {
      notify('error', res.error ?? 'Failed to create campaign');
    }
  };

  const handleAdvanceDay = async () => {
    if (!game || acting) return;
    setActing(true);
    const res = await apiFetch<Game>(`/api/game/${game.id}/advance-day`, { method: 'POST' });
    setActing(false);
    if (res.success && res.data) {
      setGame(res.data);
      notify('success', `Advanced to Day ${res.data.day}`);
    } else {
      notify('error', 'Failed to advance day');
    }
  };

  const handleToggleJump = async () => {
    if (!game || acting) return;
    setActing(true);
    const res = await apiFetch<Game>(`/api/game/${game.id}/toggle-jump`, { method: 'POST' });
    setActing(false);
    if (res.success && res.data) {
      setGame(res.data);
      notify('success', res.data.in_jump_space ? 'Entered jump space' : 'Exited jump space');
    } else {
      notify('error', 'Failed to toggle jump space');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">GM Console</p>
          <h1 className="text-2xl font-bold text-gray-100">Game</h1>
        </div>
        {!loading && game && !showForm && (
          <button
            onClick={() => {
              if (confirm(`This will replace "${game.name}". Are you sure?`)) {
                setForm({ name: '', milieu: '1105', is_drinax: true, day: '1' });
                setShowForm(true);
              }
            }}
            className="btn-secondary text-sm"
          >
            ↺ New Campaign
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-700">Loading…</p>
      ) : showForm || (!game) ? (
        /* ── Create form ── */
        <form onSubmit={handleCreate} className="card border-nexus-800 space-y-6 max-w-lg">
          <h2 className="text-sm font-semibold text-nexus-300 uppercase tracking-widest">
            {game ? 'Replace Campaign' : 'New Campaign'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Campaign Name *</label>
              <input
                className="input"
                placeholder="Pirates of Drinax"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Milieu</label>
              <input
                className="input"
                placeholder="1105 — Third Imperium"
                value={form.milieu}
                onChange={(e) => setForm({ ...form, milieu: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Starting Day</label>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="1"
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700">
              <div>
                <p className="text-gray-200 text-sm font-medium">Drinax Campaign</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Enable Drinax-specific rules and standings
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_drinax: !form.is_drinax })}
                className={[
                  'w-11 h-6 rounded-full relative transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-nexus-500 focus:ring-offset-2 focus:ring-offset-gray-900',
                  form.is_drinax ? 'bg-nexus-600' : 'bg-gray-700',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200',
                    form.is_drinax ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? 'Creating…' : 'Create Campaign'}
            </button>
            {showForm && game && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        /* ── Game dashboard ── */
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
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
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
                    'text-3xl font-bold truncate',
                    game.in_jump_space ? 'text-nexus-300' : 'text-gray-100',
                  ].join(' ')}
                >
                  {game.in_jump_space
                    ? 'Jump Space'
                    : game.current_world?.name ?? 'Not set'}
                </p>

                {/* World details */}
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

              {/* Change World button */}
              <button
                onClick={() => setShowPicker(true)}
                className="btn-secondary text-sm shrink-0"
              >
                ⊕ Change World
              </button>
            </div>
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

          {/* Standings (Drinax only) */}
          {game.is_drinax && (
            <div className="card">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                Political Standings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    { label: 'Imperium Standing', value: game.imperium_standing, bounty: game.imperium_bounty, positive: 'text-blue-400', negative: 'text-red-400' },
                    { label: 'Hierate Standing', value: game.hierate_standing, bounty: game.hierate_bounty, positive: 'text-amber-400', negative: 'text-red-400' },
                  ] as const
                ).map(({ label, value, bounty, positive, negative }) => (
                  <div key={label} className="p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-1">
                    <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
                    <p className={`text-2xl font-bold ${value >= 0 ? positive : negative}`}>
                      {value >= 0 ? '+' : ''}{value}
                    </p>
                    {bounty != null && bounty > 0 && (
                      <p className="text-red-400 text-xs">Bounty: Cr {bounty.toLocaleString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleAdvanceDay()}
                disabled={acting}
                className="btn-primary flex items-center gap-2"
              >
                <span>▶</span>
                Advance Day
                <span className="text-nexus-300 text-xs">→ Day {game.day + 1}</span>
              </button>

              <button
                onClick={() => void handleToggleJump()}
                disabled={acting}
                className="btn-secondary"
              >
                {game.in_jump_space ? '⟡ Exit Jump Space' : '⟡ Enter Jump Space'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* World picker modal */}
      {showPicker && game && (
        <WorldPicker
          game={game}
          onSelect={(updated) => { setGame(updated); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
