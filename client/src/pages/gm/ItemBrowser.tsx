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
  active: 'all' | 'true' | 'false';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  type: '', sub_type: '',
  tl_min: '', tl_max: '',
  law_min: '', law_max: '',
  cost_min: '', cost_max: '',
  active: 'all',
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

function itemToForm(item: Item): Record<string, string> {
  return {
    name: item.name,
    sub_type: item.sub_type,
    tech_level: String(item.tech_level),
    law_level: String(item.law_level),
    black_market_category: String(item.black_market_category),
    cost_cr: String(item.cost_cr),
    mass_kg: item.mass_kg != null ? String(item.mass_kg) : '',
    damage: item.damage ?? '',
    protection: item.protection ?? '',
    magazine_qty: item.magazine_qty != null ? String(item.magazine_qty) : '',
    slots: item.slots != null ? String(item.slots) : '',
    radiation_protection: item.radiation_protection != null ? String(item.radiation_protection) : '',
    traits: item.traits ?? '',
    range: item.range ?? '',
    required_skill: item.required_skill ?? '',
    reference: item.reference ?? '',
    description: item.description ?? '',
  };
}

function formToPayload(form: Record<string, string>): Record<string, unknown> {
  return {
    name: form.name,
    sub_type: form.sub_type,
    tech_level: form.tech_level !== '' ? parseInt(form.tech_level) : 0,
    law_level: form.law_level !== '' ? parseInt(form.law_level) : 0,
    black_market_category: form.black_market_category !== '' ? parseInt(form.black_market_category) : 0,
    cost_cr: form.cost_cr !== '' ? parseFloat(form.cost_cr) : 0,
    mass_kg: form.mass_kg !== '' ? parseFloat(form.mass_kg) : null,
    damage: form.damage || null,
    protection: form.protection || null,
    magazine_qty: form.magazine_qty !== '' ? parseInt(form.magazine_qty) : null,
    slots: form.slots !== '' ? parseInt(form.slots) : null,
    radiation_protection: form.radiation_protection !== '' ? parseInt(form.radiation_protection) : null,
    traits: form.traits || null,
    range: form.range || null,
    required_skill: form.required_skill || null,
    reference: form.reference || null,
    description: form.description || null,
  };
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function ItemEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: Item;
  onClose: () => void;
  onSaved: (updated: Item) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(itemToForm(item));
  const [saving, setSaving] = useState(false);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      });
      const updated: Item = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between shrink-0">
          <div>
            <p className="text-nexus-500 text-xs uppercase tracking-widest">Edit Item</p>
            <h2 className="text-lg font-bold text-gray-100 mt-0.5">{item.name}</h2>
            <p className="text-gray-600 text-xs mt-0.5">{item.type} / {item.sub_type}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Name</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Sub-Type</label>
              <input className="input" value={form.sub_type} onChange={(e) => set('sub_type', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Tech Level</label>
              <input type="number" min={0} max={19} className="input" value={form.tech_level} onChange={(e) => set('tech_level', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Law Level</label>
              <input type="number" min={0} max={10} className="input" value={form.law_level} onChange={(e) => set('law_level', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">BM Category</label>
              <input type="number" min={0} className="input" value={form.black_market_category} onChange={(e) => set('black_market_category', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Cost (Cr)</label>
              <input type="number" min={0} step="0.01" className="input" value={form.cost_cr} onChange={(e) => set('cost_cr', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Mass (kg)</label>
              <input type="number" min={0} step="0.01" className="input" placeholder="null" value={form.mass_kg} onChange={(e) => set('mass_kg', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Damage</label>
              <input className="input" placeholder="—" value={form.damage} onChange={(e) => set('damage', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Protection</label>
              <input className="input" placeholder="—" value={form.protection} onChange={(e) => set('protection', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Magazine Qty</label>
              <input type="number" min={0} className="input" placeholder="—" value={form.magazine_qty} onChange={(e) => set('magazine_qty', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Slots</label>
              <input type="number" min={0} className="input" placeholder="—" value={form.slots} onChange={(e) => set('slots', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Radiation Protection</label>
              <input type="number" min={0} className="input" placeholder="—" value={form.radiation_protection} onChange={(e) => set('radiation_protection', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Range</label>
              <input className="input" placeholder="—" value={form.range} onChange={(e) => set('range', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Traits</label>
              <input className="input" placeholder="—" value={form.traits} onChange={(e) => set('traits', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Required Skill</label>
              <input className="input" placeholder="—" value={form.required_skill} onChange={(e) => set('required_skill', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Reference</label>
              <input className="input" placeholder="—" value={form.reference} onChange={(e) => set('reference', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Description</label>
              <textarea
                rows={3}
                className="input resize-none"
                placeholder="—"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GM Item Browser ───────────────────────────────────────────────────────────

export function GMItemBrowser() {
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<ItemMeta>({ types: [], subTypes: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Item | null>(null);

  const load = async () => {
    const [itemsData, metaData] = await Promise.all([
      fetch('/api/items').then((r) => r.json()),
      fetch('/api/items/meta').then((r) => r.json()),
    ]);
    setItems(itemsData);
    setMeta(metaData);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Client-side filtering
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
      if (filters.active === 'true' && !item.active_in_game) return false;
      if (filters.active === 'false' && item.active_in_game) return false;
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

  const toggleItem = async (item: Item) => {
    const res = await fetch(`/api/items/${item.id}/toggle`, { method: 'PATCH' });
    const updated: Item = await res.json();
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  };

  const bulkToggle = async (type: string, sub_type: string | null, active_in_game: boolean) => {
    const body: Record<string, unknown> = { type, active_in_game };
    if (sub_type) body.sub_type = sub_type;
    await fetch('/api/items/bulk-toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Update local state directly — no full refetch needed
    setItems((prev) =>
      prev.map((item) => {
        if (item.type !== type) return item;
        if (sub_type && item.sub_type !== sub_type) return item;
        return { ...item, active_in_game };
      })
    );
  };

  const handleSaved = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
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
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">GM Console</p>
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

        {/* Active three-way toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 uppercase tracking-wider">Active</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {(['all', 'true', 'false'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter('active', v)}
                className={[
                  'px-3 py-1.5 text-xs transition-colors',
                  filters.active === v
                    ? 'bg-nexus-900 text-nexus-300'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {v === 'all' ? 'All' : v === 'true' ? 'Active' : 'Inactive'}
              </button>
            ))}
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
          const typeItems = Array.from(subMap.values()).flat();
          const typeTotal = typeItems.length;
          const allTypeActive = typeItems.every((i) => i.active_in_game);

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
                <button
                  onClick={() => bulkToggle(type, null, !allTypeActive)}
                  className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  {allTypeActive ? 'Deactivate All' : 'Activate All'}
                </button>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {!typeCollapsed && (
                <div className="space-y-2 ml-4">
                  {Array.from(subMap.entries()).map(([subType, subItems]) => {
                    const subKey = `sub:${type}::${subType}`;
                    const subCollapsed = collapsed.has(subKey);
                    const allSubActive = subItems.every((i) => i.active_in_game);

                    return (
                      <div key={subType} className="border border-gray-800 rounded-xl overflow-hidden">
                        {/* Sub-type header */}
                        <div className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-900 hover:bg-gray-800/80 transition-colors">
                          <button
                            onClick={() => toggleCollapse(subKey)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <span className="text-gray-600 text-xs select-none">
                              {subCollapsed ? '▸' : '▾'}
                            </span>
                            <span className="text-gray-300 text-sm font-medium">{subType}</span>
                            <span className="text-gray-600 text-xs ml-1">
                              {subItems.length} item{subItems.length !== 1 ? 's' : ''}
                            </span>
                          </button>
                          <button
                            onClick={() => bulkToggle(type, subType, !allSubActive)}
                            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors shrink-0"
                          >
                            {allSubActive ? 'Deactivate All' : 'Activate All'}
                          </button>
                        </div>

                        {/* Item rows */}
                        {!subCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[700px]">
                              <thead>
                                <tr className="border-b border-gray-800 bg-gray-950">
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">TL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">Law</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-24">Mass</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">BM</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-32">Cost</th>
                                  <th className="px-4 py-2 text-center text-xs text-gray-600 uppercase tracking-wider font-medium w-20">Active</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/60">
                                {subItems.map((item) => (
                                  <tr
                                    key={item.id}
                                    className={[
                                      'hover:bg-gray-800/40 transition-colors',
                                      !item.active_in_game ? 'opacity-60' : '',
                                    ].join(' ')}
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
                                    <td className="px-4 py-2.5 text-center">
                                      <button
                                        onClick={() => toggleItem(item)}
                                        title={item.active_in_game ? 'Deactivate item' : 'Activate item'}
                                        className={[
                                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                                          item.active_in_game
                                            ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700 hover:bg-emerald-900/80'
                                            : 'bg-gray-800 text-gray-600 border-gray-700 hover:bg-gray-700 hover:text-gray-400',
                                        ].join(' ')}
                                      >
                                        {item.active_in_game ? 'Active' : 'Inactive'}
                                      </button>
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

      {/* Edit modal */}
      {selected && (
        <ItemEditModal
          item={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default GMItemBrowser;
