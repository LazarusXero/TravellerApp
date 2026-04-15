import { useEffect, useState, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Item {
  id: number;
  name: string;
  type: string;
  sub_type: string;
  tech_level: number;
  law_level: number;
  black_market_category: number;
  cost_cr: number;
  mass_kg: number | null;
  damage: string | null;
  protection: string | null;
  magazine_qty: number | null;
  slots: number | null;
  radiation_protection: number | null;
  traits: string | null;
  range: string | null;
  required_skill: string | null;
  reference: string | null;
  description: string | null;
  active_in_game: boolean;
  created_at: string;
}

interface ItemMeta {
  types: string[];
  subTypes: { type: string; sub_type: string }[];
}

interface Filters {
  type: string;
  sub_type: string;
  tl_min: string;
  tl_max: string;
  law_min: string;
  law_max: string;
  cost_min: string;
  cost_max: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  type: '', sub_type: '',
  tl_min: '', tl_max: '',
  law_min: '', law_max: '',
  cost_min: '', cost_max: '',
};

const formatCost = (cr: number): string => {
  if (cr >= 1_000_000) return `MCr ${(cr / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (cr >= 1_000) return `KCr ${(cr / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `Cr ${cr.toLocaleString()}`;
};

const formatMass = (kg: number | null): string => {
  if (kg === null || kg === undefined) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toLocaleString()} T`;
  return `${kg.toLocaleString()} kg`;
};

// ── Read-Only Modal ───────────────────────────────────────────────────────────

function ItemViewModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const field = (label: string, value: string | number | null | undefined) => (
    <div>
      <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-gray-200 text-sm">{value ?? '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between shrink-0">
          <div>
            <p className="text-nexus-500 text-xs uppercase tracking-widest">Item Details</p>
            <h2 className="text-lg font-bold text-gray-100 mt-0.5">{item.name}</h2>
            <p className="text-gray-600 text-xs mt-0.5">{item.type} / {item.sub_type}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {field('Tech Level', item.tech_level)}
            {field('Law Level', item.law_level)}
            {field('BM Category', item.black_market_category || '—')}
            {field('Cost', formatCost(item.cost_cr))}
            {field('Mass', formatMass(item.mass_kg))}
            {field('Damage', item.damage)}
            {field('Protection', item.protection)}
            {field('Magazine Qty', item.magazine_qty)}
            {field('Slots', item.slots)}
            {field('Radiation Protection', item.radiation_protection)}
            {field('Range', item.range)}
            {field('Required Skill', item.required_skill)}

            <div className="col-span-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Traits</p>
              <p className="text-gray-200 text-sm">{item.traits ?? '—'}</p>
            </div>

            <div className="col-span-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Reference</p>
              <p className="text-gray-200 text-sm">{item.reference ?? '—'}</p>
            </div>

            {item.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Description</p>
                <p className="text-gray-300 text-sm leading-relaxed">{item.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end shrink-0">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Player Item Browser ───────────────────────────────────────────────────────

export function PlayerItemBrowser() {
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<ItemMeta>({ types: [], subTypes: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/items?active=true').then((r) => r.json()),
      fetch('/api/items/meta').then((r) => r.json()),
    ]).then(([itemsData, metaData]) => {
      setItems(itemsData);
      setMeta(metaData);
      setLoading(false);
    });
  }, []);

  // Client-side filtering (no active filter — player always sees only active items)
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.sub_type && item.sub_type !== filters.sub_type) return false;
      if (filters.tl_min !== '' && item.tech_level < parseInt(filters.tl_min)) return false;
      if (filters.tl_max !== '' && item.tech_level > parseInt(filters.tl_max)) return false;
      if (filters.law_min !== '' && item.law_level < parseInt(filters.law_min)) return false;
      if (filters.law_max !== '' && item.law_level > parseInt(filters.law_max)) return false;
      if (filters.cost_min !== '' && item.cost_cr < parseFloat(filters.cost_min)) return false;
      if (filters.cost_max !== '' && item.cost_cr > parseFloat(filters.cost_max)) return false;
      return true;
    });
  }, [items, filters]);

  // Group by type → sub_type
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Item[]>>();
    for (const item of filtered) {
      if (!map.has(item.type)) map.set(item.type, new Map());
      const subMap = map.get(item.type)!;
      if (!subMap.has(item.sub_type)) subMap.set(item.sub_type, []);
      subMap.get(item.sub_type)!.push(item);
    }
    return map;
  }, [filtered]);

  // Sub-types available for the selected type filter
  const availableSubTypes = useMemo(() => {
    if (!filters.type) return [];
    return meta.subTypes
      .filter((st) => st.type === filters.type)
      .map((st) => st.sub_type);
  }, [meta.subTypes, filters.type]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-600">Loading items…</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Player View</p>
        <h1 className="text-2xl font-bold text-gray-100">Item Browser</h1>
        <p className="text-gray-600 text-sm mt-1">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== items.length && ` of ${items.length}`}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl">

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Type</label>
          <select
            value={filters.type}
            onChange={(e) => { setFilter('type', e.target.value); setFilter('sub_type', ''); }}
            className="input w-36"
          >
            <option value="">All</option>
            {meta.types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Sub-Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Sub-Type</label>
          <select
            value={filters.sub_type}
            onChange={(e) => setFilter('sub_type', e.target.value)}
            disabled={!filters.type}
            className="input w-40"
          >
            <option value="">All</option>
            {availableSubTypes.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* TL range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">TL</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={0} max={19} placeholder="Min"
              value={filters.tl_min}
              onChange={(e) => setFilter('tl_min', e.target.value)}
              className="input w-16"
            />
            <span className="text-gray-600 text-xs">–</span>
            <input
              type="number" min={0} max={19} placeholder="Max"
              value={filters.tl_max}
              onChange={(e) => setFilter('tl_max', e.target.value)}
              className="input w-16"
            />
          </div>
        </div>

        {/* Law range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Law</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={0} max={10} placeholder="Min"
              value={filters.law_min}
              onChange={(e) => setFilter('law_min', e.target.value)}
              className="input w-16"
            />
            <span className="text-gray-600 text-xs">–</span>
            <input
              type="number" min={0} max={10} placeholder="Max"
              value={filters.law_max}
              onChange={(e) => setFilter('law_max', e.target.value)}
              className="input w-16"
            />
          </div>
        </div>

        {/* Cost range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Cost (Cr)</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={0} placeholder="Min"
              value={filters.cost_min}
              onChange={(e) => setFilter('cost_min', e.target.value)}
              className="input w-24"
            />
            <span className="text-gray-600 text-xs">–</span>
            <input
              type="number" min={0} placeholder="Max"
              value={filters.cost_max}
              onChange={(e) => setFilter('cost_max', e.target.value)}
              className="input w-24"
            />
          </div>
        </div>

        {/* Clear */}
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {/* Hierarchical list */}
      {grouped.size === 0 ? (
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
                  {Array.from(subMap.entries()).map(([subType, subItems]) => {
                    const subKey = `sub:${type}::${subType}`;
                    const subCollapsed = collapsed.has(subKey);

                    return (
                      <div key={subType} className="border border-gray-800 rounded-xl overflow-hidden">
                        {/* Sub-type header */}
                        <button
                          onClick={() => toggleCollapse(subKey)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-900 hover:bg-gray-800/80 transition-colors text-left"
                        >
                          <span className="text-gray-600 text-xs select-none">
                            {subCollapsed ? '▸' : '▾'}
                          </span>
                          <span className="text-gray-300 text-sm font-medium">{subType}</span>
                          <span className="text-gray-600 text-xs ml-1">
                            {subItems.length} item{subItems.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Item rows */}
                        {!subCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px]">
                              <thead>
                                <tr className="border-b border-gray-800 bg-gray-950">
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">TL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">Law</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-24">Mass</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">BM</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-32">Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/60">
                                {subItems.map((item) => (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-gray-800/40 transition-colors"
                                  >
                                    <td className="px-4 py-2.5">
                                      <button
                                        onClick={() => setSelected(item)}
                                        className="text-gray-200 hover:text-nexus-300 font-medium transition-colors text-left"
                                      >
                                        {item.name}
                                      </button>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs">{item.tech_level}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs">{item.law_level}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-gray-500 text-xs">{formatMass(item.mass_kg)}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-500 text-xs">
                                        {item.black_market_category || '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-300 text-xs">{formatCost(item.cost_cr)}</span>
                                    </td>
                                  </tr>
                                ))}
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

      {/* Read-only modal */}
      {selected && (
        <ItemViewModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export default PlayerItemBrowser;
