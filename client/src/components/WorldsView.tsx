import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../hooks/useApi';
import { WorldModal, type World } from './WorldModal';

interface Props {
  gmMode: boolean;
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

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-mono border ${cls}`}>
      {value}
    </span>
  );
}

export function WorldsView({ gmMode }: Props) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openSubsectors, setOpenSubsectors] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<World | null>(null);

  const load = async () => {
    const res = await apiFetch<World[]>(`/api/worlds${gmMode ? '' : '?visible_only=true'}`);
    if (res.success && res.data) setWorlds(res.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [gmMode]);

  const updateWorld = (id: number, patch: Partial<World>) => {
    setWorlds((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, ...patch } : null);
  };

  const toggleHidden = async (world: World) => {
    const next = !world.is_hidden;
    const res = await apiFetch(`/api/worlds/${world.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_hidden: next }),
    });
    if (res.success) updateWorld(world.id, { is_hidden: next });
  };

  // Build hierarchical structure
  const sectors = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = q
      ? worlds.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            w.hex_code.toLowerCase().includes(q) ||
            (w.subsector?.toLowerCase().includes(q) ?? false) ||
            (w.trade_codes?.toLowerCase().includes(q) ?? false) ||
            (w.allegiance?.toLowerCase().includes(q) ?? false)
        )
      : worlds;

    const sectorMap = new Map<string, Map<string, World[]>>();
    for (const w of filtered) {
      const sector = w.sector ?? 'Unknown Sector';
      const subsector = w.subsector ?? 'Unknown Subsector';
      if (!sectorMap.has(sector)) sectorMap.set(sector, new Map());
      const subsMap = sectorMap.get(sector)!;
      if (!subsMap.has(subsector)) subsMap.set(subsector, []);
      subsMap.get(subsector)!.push(w);
    }
    return sectorMap;
  }, [worlds, search]);

  // Auto-expand subsectors that match search.
  // Depends only on `search`, NOT on `sectors` — otherwise every worlds state
  // update (e.g. toggling is_hidden) recomputes sectors, fires this effect,
  // and collapses all open subsectors when search is empty.
  useEffect(() => {
    if (!search.trim()) {
      setOpenSubsectors(new Set());
      return;
    }
    const keys = new Set<string>();
    sectors.forEach((subsMap, sector) => {
      subsMap.forEach((_, sub) => keys.add(`${sector}::${sub}`));
    });
    setOpenSubsectors(keys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleSubsector = (key: string) => {
    setOpenSubsectors((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const totalVisible = useMemo(() => {
    let n = 0;
    sectors.forEach((s) => s.forEach((ws) => (n += ws.length)));
    return n;
  }, [sectors]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-600">Loading worlds…</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">{gmMode ? 'GM Console' : 'Player View'}</p>
          <h1 className="text-2xl font-bold text-gray-100">World Browser</h1>
          <p className="text-gray-600 text-sm mt-1">{totalVisible} world{totalVisible !== 1 ? 's' : ''}{!gmMode && ' (visible)'}</p>
        </div>
        <input
          type="search"
          placeholder="Search worlds, hex, allegiance…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-72"
        />
      </div>

      {/* Sector blocks */}
      {sectors.size === 0 ? (
        <p className="text-gray-600 text-sm">No worlds match your search.</p>
      ) : (
        Array.from(sectors.entries()).map(([sector, subsMap]) => {
          const sectorTotal = Array.from(subsMap.values()).reduce((a, ws) => a + ws.length, 0);
          return (
            <div key={sector}>
              {/* Sector header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-nexus-400 text-xs">◈</span>
                <h2 className="text-sm font-semibold text-nexus-300 uppercase tracking-widest">{sector}</h2>
                <span className="text-gray-700 text-xs">{sectorTotal} worlds</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Subsectors */}
              <div className="space-y-2 ml-4">
                {Array.from(subsMap.entries()).map(([sub, subWorlds]) => {
                  const key = `${sector}::${sub}`;
                  const isOpen = openSubsectors.has(key);
                  return (
                    <div key={sub} className="border border-gray-800 rounded-xl overflow-hidden">
                      {/* Subsector toggle */}
                      <button
                        onClick={() => toggleSubsector(key)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-900 hover:bg-gray-800/80 transition-colors text-left"
                      >
                        <span className="text-gray-600 text-xs select-none">{isOpen ? '▾' : '▸'}</span>
                        <span className="text-gray-300 text-sm font-medium">{sub}</span>
                        <span className="text-gray-600 text-xs ml-1">{subWorlds.length} world{subWorlds.length !== 1 ? 's' : ''}</span>
                      </button>

                      {/* World rows */}
                      {isOpen && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[700px]">
                            <thead>
                              <tr className="border-b border-gray-800 bg-gray-950">
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-16">Hex</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">UWP</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-14">Port</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">Tech</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Allegiance</th>
                                <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Attitude</th>
                                {gmMode && (
                                  <th className="px-4 py-2 text-center text-xs text-gray-600 uppercase tracking-wider font-medium w-16">Hidden</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                              {subWorlds.map((w) => {
                                const uwp = `${w.port_type}${w.size}${w.atmosphere}${w.hydrographics}${w.population}${w.government}${w.law}-${w.technology}`;
                                return (
                                  <tr
                                    key={w.id}
                                    className={[
                                      'hover:bg-gray-800/40 transition-colors',
                                      w.is_hidden ? 'opacity-50' : '',
                                    ].join(' ')}
                                  >
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-600 text-xs">{w.hex_code}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <button
                                        onClick={() => setSelected(w)}
                                        className="text-gray-200 hover:text-nexus-300 font-medium transition-colors text-left"
                                      >
                                        {w.name}
                                      </button>
                                      {w.key_system && (
                                        <span className="ml-1.5 text-nexus-500 text-xs">★</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs tracking-widest">{uwp}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <Badge value={w.port_type} colorMap={PORT_COLORS} />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs">{w.technology}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-gray-500 text-xs truncate max-w-[120px] block">{w.allegiance ?? '—'}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {w.port_attitude ? (
                                        <Badge value={w.port_attitude} colorMap={ATTITUDE_COLORS} />
                                      ) : (
                                        <span className="text-gray-700 text-xs">—</span>
                                      )}
                                    </td>
                                    {gmMode && (
                                      <td className="px-4 py-2.5 text-center">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); void toggleHidden(w); }}
                                          title={w.is_hidden ? 'Unhide world' : 'Hide world'}
                                          className={[
                                            'text-base leading-none transition-colors',
                                            w.is_hidden ? 'text-gray-700 hover:text-gray-400' : 'text-nexus-500 hover:text-nexus-400',
                                          ].join(' ')}
                                        >
                                          {w.is_hidden ? '○' : '●'}
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Detail modal */}
      {selected && (
        <WorldModal
          world={selected}
          gmMode={gmMode}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => updateWorld(selected.id, patch)}
        />
      )}
    </div>
  );
}
