import { useEffect, useState, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BMItem {
  id: number;
  name: string;
  type: string;
  sub_type: string;
  tech_level: number;
  law_level: number;
  black_market_category: number;
  cost_cr: number;
}

interface BMRow {
  item: BMItem;
  bm_base_roll: number;
  bm_final_roll: number | null;
  bm_quantity: number | null;
  is_unlocked: boolean;
  streetwise_dm: number;
  unlocked_by: string | null;
  unlocked_day: number | null;
  gm_override: boolean;
}

interface GameInfo {
  id: number;
  current_world: { id: number; name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCr(n: number): string {
  if (n >= 1_000_000) return `MCr ${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1_000) return `KCr ${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `Cr ${Math.round(n).toLocaleString()}`;
}

function defaultMult(cat: number): number {
  if (cat === 0) return 1;
  if (cat === 1) return 2;
  if (cat === 2) return 3;
  if (cat === 3) return 5;
  if (cat === 4) return 10;
  if (cat === 5) return 20;
  return 100;
}

const MULT_OPTIONS = [1, 2, 3, 5, 10, 20, 100];
const DM_OPTIONS = [-3, -2, -1, 0, 1, 2, 3, 4];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function GMBlackMarketPage() {
  const [game, setGame] = useState<GameInfo | null>(null);
  const [rows, setRows] = useState<BMRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [subTypeFilter, setSubTypeFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  // Sub-type Streetwise DM (keyed by "type|subtype"), managed locally
  const [subTypeDMs, setSubTypeDMs] = useState<Record<string, number>>({});

  // Pending API calls (keyed by "type|subtype")
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Local per-item qty overrides (not persisted; GM scratchpad)
  const [localQty, setLocalQty] = useState<Record<number, number>>({});

  // Local per-item mult overrides
  const [localMult, setLocalMult] = useState<Record<number, number>>({});

  const worldId = game?.current_world?.id ?? null;

  const fetchData = async () => {
    const gameRes = await fetch('/api/game').then((r) => r.json());
    const g: GameInfo | null = gameRes.data ?? null;
    setGame(g);

    if (g?.current_world?.id) {
      const bmRes = await fetch(`/api/black-market/${g.current_world.id}/inventory`).then((r) => r.json());
      const newRows: BMRow[] = bmRes.data ?? [];
      setRows(newRows);

      // Seed DM state for sub-types we haven't locally overridden yet
      setSubTypeDMs((prev) => {
        const next = { ...prev };
        for (const row of newRows) {
          const key = `${row.item.type}|${row.item.sub_type}`;
          if (!(key in next)) next[key] = row.streetwise_dm;
        }
        return next;
      });
    } else {
      setRows([]);
    }
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  // ── Lock / Unlock / DM change ────────────────────────────────────────────

  const callUnlock = async (itemType: string, itemSubType: string, dm: number) => {
    if (!worldId) return;
    const key = `${itemType}|${itemSubType}`;
    setPending((p) => new Set([...p, key]));
    try {
      await fetch(`/api/black-market/${worldId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_sub_type: itemSubType,
          streetwise_dm: dm,
          gm_override: true,
        }),
      });
      await fetchData();
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(key);
        return n;
      });
    }
  };

  const handleUnlock = (itemType: string, itemSubType: string) => {
    const dm = subTypeDMs[`${itemType}|${itemSubType}`] ?? 0;
    callUnlock(itemType, itemSubType, dm);
  };

  const handleLock = async (itemType: string, itemSubType: string) => {
    if (!worldId) return;
    const key = `${itemType}|${itemSubType}`;
    setPending((p) => new Set([...p, key]));
    try {
      await fetch(`/api/black-market/${worldId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: itemType, item_sub_type: itemSubType }),
      });
      await fetchData();
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(key);
        return n;
      });
    }
  };

  const handleDmChange = (itemType: string, itemSubType: string, newDm: number) => {
    const key = `${itemType}|${itemSubType}`;
    setSubTypeDMs((prev) => ({ ...prev, [key]: newDm }));

    // If already unlocked, re-roll immediately
    const subRows = rows.filter((r) => r.item.type === itemType && r.item.sub_type === itemSubType);
    if (subRows[0]?.is_unlocked) {
      callUnlock(itemType, itemSubType, newDm);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const allTypes = useMemo(() => [...new Set(rows.map((r) => r.item.type))].sort(), [rows]);

  const availableSubTypes = useMemo(() => {
    if (!typeFilter) return [];
    return [...new Set(rows.filter((r) => r.item.type === typeFilter).map((r) => r.item.sub_type))].sort();
  }, [rows, typeFilter]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter && r.item.type !== typeFilter) return false;
      if (subTypeFilter && r.item.sub_type !== subTypeFilter) return false;
      if (nameFilter && !r.item.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (availableOnly && !(r.bm_final_roll !== null && r.bm_final_roll >= 8)) return false;
      return true;
    });
  }, [rows, typeFilter, subTypeFilter, nameFilter, availableOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, BMRow[]>>();
    for (const r of filtered) {
      if (!map.has(r.item.type)) map.set(r.item.type, new Map());
      const subMap = map.get(r.item.type)!;
      if (!subMap.has(r.item.sub_type)) subMap.set(r.item.sub_type, []);
      subMap.get(r.item.sub_type)!.push(r);
    }
    for (const subMap of map.values()) {
      for (const items of subMap.values()) {
        items.sort((a, b) => a.item.name.localeCompare(b.item.name));
      }
    }
    return new Map(
      [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, subMap]) => [
          type,
          new Map([...subMap.entries()].sort(([a], [b]) => a.localeCompare(b))),
        ])
    );
  }, [filtered]);

  const allGroupKeys = useMemo(() => {
    const keys: string[] = [];
    for (const [type, subMap] of grouped.entries()) {
      keys.push(`type:${type}`);
      for (const subType of subMap.keys()) keys.push(`sub:${type}::${subType}`);
    }
    return keys;
  }, [grouped]);

  const allCollapsed = allGroupKeys.length > 0 && allGroupKeys.every((k) => collapsed.has(k));

  const toggleCollapseAll = () => setCollapsed(allCollapsed ? new Set() : new Set(allGroupKeys));

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const clearFilters = () => {
    setTypeFilter('');
    setSubTypeFilter('');
    setNameFilter('');
    setAvailableOnly(false);
  };

  const worldName = game?.current_world?.name ?? null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">GM Console · World</p>
          <h1 className="text-2xl font-bold text-gray-100">
            Black Market — {worldName ?? 'No World Selected'}
          </h1>
          {!worldName ? (
            <p className="text-gray-500 text-sm mt-1">No current world selected.</p>
          ) : (
            <p className="text-gray-500 text-sm mt-1">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== rows.length && ` of ${rows.length}`}
              {' · '}
              {rows.filter((r) => r.bm_final_roll !== null && r.bm_final_roll >= 8).length} available
            </p>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl">
          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setSubTypeFilter('');
              }}
              className="input w-36"
            >
              <option value="">All</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Sub-Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Sub-Type</label>
            <select
              value={subTypeFilter}
              onChange={(e) => setSubTypeFilter(e.target.value)}
              disabled={!typeFilter}
              className="input w-40"
            >
              <option value="">All</option>
              {availableSubTypes.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Name</label>
            <input
              type="text"
              placeholder="Search…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="input w-48"
            />
          </div>

          {/* Available Only */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Show</label>
            <button
              onClick={() => setAvailableOnly((p) => !p)}
              className={`px-3 h-[34px] text-xs font-medium rounded-lg border transition-colors ${
                availableOnly
                  ? 'bg-nexus-700 border-nexus-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              Available Only
            </button>
          </div>

          <button
            onClick={toggleCollapseAll}
            disabled={allGroupKeys.length === 0}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {allCollapsed ? 'Expand All' : 'Collapse All'}
          </button>

          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Body */}
      {!worldName ? null : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          No black market items for this world.
        </div>
      ) : grouped.size === 0 ? (
        <p className="text-gray-600 text-sm">No items match your filters.</p>
      ) : (
        Array.from(grouped.entries()).map(([type, subMap]) => {
          const typeKey = `type:${type}`;
          const typeCollapsed = collapsed.has(typeKey);
          const typeTotal = Array.from(subMap.values()).reduce((a, arr) => a + arr.length, 0);

          return (
            <div key={type}>
              {/* Type header */}
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => toggleCollapse(typeKey)}
                  className="flex items-center gap-2 text-left"
                >
                  <span className="text-gray-600 text-xs select-none">
                    {typeCollapsed ? '▸' : '▾'}
                  </span>
                  <span className="text-nexus-300 text-xs font-semibold uppercase tracking-widest">
                    {type}
                  </span>
                  <span className="text-gray-700 text-xs">
                    {typeTotal} item{typeTotal !== 1 ? 's' : ''}
                  </span>
                </button>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {!typeCollapsed && (
                <div className="space-y-2 ml-4">
                  {Array.from(subMap.entries()).map(([subType, subRows]) => {
                    const subKey = `sub:${type}::${subType}`;
                    const subCollapsed = collapsed.has(subKey);
                    const dmKey = `${type}|${subType}`;
                    const isPending = pending.has(dmKey);
                    const isUnlocked = subRows[0]?.is_unlocked ?? false;
                    const availableCount = subRows.filter(
                      (r) => r.bm_final_roll !== null && r.bm_final_roll >= 8
                    ).length;
                    const currentDm = subTypeDMs[dmKey] ?? 0;

                    return (
                      <div key={subType} className="border border-gray-800 rounded-xl overflow-hidden">
                        {/* Sub-type header */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900">
                          {/* Collapse toggle + label */}
                          <button
                            onClick={() => toggleCollapse(subKey)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-gray-800/50 transition-colors -mx-1 px-1 rounded"
                          >
                            <span className="text-gray-600 text-xs select-none">
                              {subCollapsed ? '▸' : '▾'}
                            </span>
                            <span className="text-gray-300 text-sm font-medium">{subType}</span>
                            <span className="text-gray-600 text-xs ml-1">
                              {subRows.length} item{subRows.length !== 1 ? 's' : ''}
                            </span>
                            {isUnlocked && availableCount > 0 && (
                              <span className="text-gray-600 text-xs">
                                · {availableCount} available
                              </span>
                            )}
                          </button>

                          {/* Right-side controls — stop propagation so clicks don't toggle collapse */}
                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-xs text-gray-600 hidden sm:inline">SW DM</span>
                            <select
                              value={currentDm}
                              disabled={!isUnlocked || isPending}
                              onChange={(e) =>
                                handleDmChange(type, subType, parseInt(e.target.value, 10))
                              }
                              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-nexus-500 disabled:opacity-40"
                            >
                              {DM_OPTIONS.map((dm) => (
                                <option key={dm} value={dm}>
                                  {dm >= 0 ? `+${dm}` : dm}
                                </option>
                              ))}
                            </select>

                            {isUnlocked ? (
                              <button
                                disabled={isPending}
                                onClick={() => handleLock(type, subType)}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
                              >
                                <span>🔓</span>
                                <span>Unlocked</span>
                              </button>
                            ) : (
                              <button
                                disabled={isPending}
                                onClick={() => handleUnlock(type, subType)}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors disabled:opacity-40"
                              >
                                <span>🔒</span>
                                <span>Locked</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Item rows */}
                        {!subCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[860px]">
                              <thead>
                                <tr className="border-b border-gray-800 bg-gray-950">
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-10">TL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-10">LL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-16">BM Cat</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-28">Base Price</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-36">Roll</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-24">Status</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-20">Qty</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-20">Mult</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-28">Eff. Price</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/60">
                                {subRows.map((r) => {
                                  const isAvailable =
                                    r.bm_final_roll !== null && r.bm_final_roll >= 8;
                                  const mult =
                                    localMult[r.item.id] ?? defaultMult(r.item.black_market_category);
                                  const qty =
                                    localQty[r.item.id] !== undefined
                                      ? localQty[r.item.id]
                                      : (r.bm_quantity ?? 0);
                                  const effPrice = r.item.cost_cr * mult;

                                  return (
                                    <tr
                                      key={r.item.id}
                                      className={`transition-colors ${
                                        isAvailable
                                          ? 'hover:bg-gray-800/40'
                                          : 'opacity-60 hover:bg-gray-800/20'
                                      }`}
                                    >
                                      <td className="px-4 py-2.5">
                                        <span className="text-gray-200 font-medium">{r.item.name}</span>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className="font-mono text-gray-400 text-xs">{r.item.tech_level}</span>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className="font-mono text-gray-400 text-xs">{r.item.law_level}</span>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className="font-mono text-gray-400 text-xs">{r.item.black_market_category}</span>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className="font-mono text-gray-400 text-xs">{fmtCr(r.item.cost_cr)}</span>
                                      </td>
                                      <td className="px-4 py-2.5 whitespace-nowrap">
                                        {r.bm_final_roll !== null ? (
                                          <span className="font-mono text-gray-400 text-xs">
                                            {r.bm_base_roll} → {r.bm_final_roll}
                                            {isAvailable && (
                                              <span className="ml-1.5 px-1 py-0.5 rounded text-xs bg-amber-900/40 text-amber-400">
                                                {mult}×
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="font-mono text-gray-500 text-xs">
                                            {r.bm_base_roll}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        {!isUnlocked ? (
                                          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-600">
                                            Locked
                                          </span>
                                        ) : isAvailable ? (
                                          <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-900/40 text-emerald-400">
                                            Available
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-600">
                                            Unavailable
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        {isUnlocked ? (
                                          <input
                                            type="number"
                                            min={0}
                                            value={qty}
                                            onChange={(e) =>
                                              setLocalQty((prev) => ({
                                                ...prev,
                                                [r.item.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                              }))
                                            }
                                            className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 text-center focus:outline-none focus:border-nexus-500"
                                          />
                                        ) : (
                                          <span className="font-mono text-gray-600 text-xs">0</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <select
                                          value={mult}
                                          onChange={(e) =>
                                            setLocalMult((prev) => ({
                                              ...prev,
                                              [r.item.id]: parseInt(e.target.value, 10),
                                            }))
                                          }
                                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-nexus-500"
                                        >
                                          {MULT_OPTIONS.map((m) => (
                                            <option key={m} value={m}>{m}×</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className="font-mono text-gray-200 text-xs">{fmtCr(effPrice)}</span>
                                      </td>
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
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
