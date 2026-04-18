import { useEffect, useState, useMemo, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreRecord {
  id: number;
  item_id: number;
  item_name: string;
  item_type: string;
  item_sub_type: string;
  base_price: number;
  mass_kg: number | null;
  law_level: number;
  tech_level: number;
  black_market_category: number;
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
  base_roll: number;
  final_roll: number;
  quantity: number;
  price_multiplier: number;
  effective_price: number;
}

interface GameInfo {
  id: number;
  current_world: { name: string } | null;
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
  show_unavailable: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  type: '', sub_type: '',
  tl_min: '', tl_max: '',
  law_min: '', law_max: '',
  cost_min: '', cost_max: '',
  show_unavailable: true,
};

function fmtCr(n: number): string {
  if (n >= 1_000_000) return `MCr ${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1_000) return `KCr ${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `Cr ${Math.round(n).toLocaleString()}`;
}

function fmtMass(kg: number | null): string {
  if (kg === null || kg === undefined) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toLocaleString()} T`;
  return `${kg.toLocaleString()} kg`;
}

// ── Item Detail Modal (GM — read-only, shows roll info) ───────────────────────

function GMItemModal({
  record,
  onClose,
}: {
  record: StoreRecord;
  onClose: () => void;
}) {
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
            <p className="text-nexus-500 text-xs uppercase tracking-widest">
              Store · {record.item_type} / {record.item_sub_type}
            </p>
            <h2 className="text-lg font-bold text-gray-100 mt-0.5">{record.item_name}</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-gray-400 text-sm font-mono">{fmtCr(record.effective_price)}</span>
              {record.price_multiplier > 1 && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900/40 text-amber-400">
                  {record.price_multiplier}× price
                </span>
              )}
              <span className="text-gray-600 text-xs font-mono">
                roll {record.base_roll} → {record.final_roll}
              </span>
              {record.quantity > 0 ? (
                <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-900/40 text-emerald-400">
                  {record.quantity} in stock
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-600">
                  Unavailable
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {field('Tech Level', record.tech_level)}
            {field('Law Level', record.law_level)}
            {field('Base Price', fmtCr(record.base_price))}
            {field('Mass', fmtMass(record.mass_kg))}
            {field('Damage', record.damage)}
            {field('Protection', record.protection)}
            {field('Magazine Qty', record.magazine_qty)}
            {field('Slots', record.slots)}
            {field('Radiation Protection', record.radiation_protection)}
            {field('Range', record.range)}
            {field('Required Skill', record.required_skill)}

            <div className="col-span-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Traits</p>
              <p className="text-gray-200 text-sm">{record.traits ?? '—'}</p>
            </div>

            <div className="col-span-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Reference</p>
              <p className="text-gray-200 text-sm">{record.reference ?? '—'}</p>
            </div>

            {record.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Description</p>
                <p className="text-gray-300 text-sm leading-relaxed">{record.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline editable quantity cell ─────────────────────────────────────────────

function QtyCell({
  record,
  onSave,
}: {
  record: StoreRecord;
  onSave: (id: number, qty: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(record.quantity));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(record.quantity));
  }, [record.quantity]);

  const commit = async (raw: string) => {
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 0) { setValue(String(record.quantity)); return; }
    if (qty === record.quantity) return;
    setSaving(true);
    try { await onSave(record.id, qty); } finally { setSaving(false); }
  };

  return (
    <input
      type="number"
      min={0}
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setValue(String(record.quantity));
      }}
      className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 text-center focus:outline-none focus:border-nexus-500 disabled:opacity-50"
    />
  );
}

// ── Price multiplier dropdown ─────────────────────────────────────────────────

function MultiplierCell({
  record,
  onSave,
}: {
  record: StoreRecord;
  onSave: (id: number, mult: number) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mult = parseFloat(e.target.value);
    if (mult === record.price_multiplier) return;
    setSaving(true);
    try { await onSave(record.id, mult); } finally { setSaving(false); }
  };

  return (
    <select
      value={record.price_multiplier}
      disabled={saving}
      onChange={handleChange}
      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-nexus-500 disabled:opacity-50"
    >
      <option value={1}>1×</option>
      <option value={2}>2×</option>
      <option value={3}>3×</option>
    </select>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GMStorePage() {
  const [game, setGame] = useState<GameInfo | null>(null);
  const [records, setRecords] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<StoreRecord | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const confirmRef = useRef<HTMLDivElement>(null);

  const fetchStore = async () => {
    const [gameRes, storeRes] = await Promise.all([
      fetch('/api/game').then((r) => r.json()),
      fetch('/api/store/gm').then((r) => r.json()),
    ]);
    setGame(gameRes.data ?? null);
    setRecords(storeRes.data ?? []);
  };

  useEffect(() => {
    fetchStore().finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setConfirmOpen(false);
    setGenerating(true);
    try {
      await fetch('/api/store/generate', { method: 'POST' });
      await fetchStore();
    } finally {
      setGenerating(false);
    }
  };

  const patchRecord = async (
    id: number,
    patch: { quantity?: number; price_multiplier?: number }
  ) => {
    const res = await fetch(`/api/store/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (json.success) {
      setRecords((prev) => prev.map((r) => (r.id === id ? json.data : r)));
      setSelected((prev) => (prev?.id === id ? json.data : prev));
    }
  };

  // Derived meta for filter dropdowns
  const meta = useMemo(() => {
    const types = Array.from(new Set(records.map((r) => r.item_type))).sort();
    const subTypes = Array.from(
      new Map(
        records.map((r) => [
          `${r.item_type}::${r.item_sub_type}`,
          { type: r.item_type, sub_type: r.item_sub_type },
        ])
      ).values()
    );
    return { types, subTypes };
  }, [records]);

  const availableSubTypes = useMemo(() => {
    if (!filters.type) return [];
    return meta.subTypes
      .filter((st) => st.type === filters.type)
      .map((st) => st.sub_type);
  }, [meta.subTypes, filters.type]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (!filters.show_unavailable && r.quantity === 0) return false;
      if (filters.type && r.item_type !== filters.type) return false;
      if (filters.sub_type && r.item_sub_type !== filters.sub_type) return false;
      if (filters.tl_min !== '' && r.tech_level < parseInt(filters.tl_min)) return false;
      if (filters.tl_max !== '' && r.tech_level > parseInt(filters.tl_max)) return false;
      if (filters.law_min !== '' && r.law_level < parseInt(filters.law_min)) return false;
      if (filters.law_max !== '' && r.law_level > parseInt(filters.law_max)) return false;
      if (filters.cost_min !== '' && r.base_price < parseFloat(filters.cost_min)) return false;
      if (filters.cost_max !== '' && r.base_price > parseFloat(filters.cost_max)) return false;
      return true;
    });
  }, [records, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, StoreRecord[]>>();
    for (const r of filtered) {
      if (!map.has(r.item_type)) map.set(r.item_type, new Map());
      const subKey = r.item_sub_type || 'General';
      const subMap = map.get(r.item_type)!;
      if (!subMap.has(subKey)) subMap.set(subKey, []);
      subMap.get(subKey)!.push(r);
    }
    return map;
  }, [filtered]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const worldName = game?.current_world?.name ?? null;

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
            Store — {worldName ?? 'No World Selected'}
          </h1>
          {!worldName ? (
            <p className="text-gray-500 text-sm mt-1">
              Set a current world in Game Information to generate a store.
            </p>
          ) : (
            <p className="text-gray-500 text-sm mt-1">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== records.length && ` of ${records.length}`} ·{' '}
              {records.filter((r) => r.quantity > 0).length} available
            </p>
          )}
        </div>

        {worldName && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={generating}
            className="shrink-0 px-4 py-2 bg-nexus-700 hover:bg-nexus-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {generating ? 'Generating…' : '↺ Regenerate Store'}
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            ref={confirmRef}
            className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4"
          >
            <h2 className="text-gray-100 font-semibold">Regenerate Store?</h2>
            <p className="text-gray-400 text-sm">
              This will replace all current inventory and re-roll all items.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-nexus-700 hover:bg-nexus-600 text-white text-sm rounded-lg transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {records.length > 0 && (
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
              <input type="number" min={0} max={19} placeholder="Min"
                value={filters.tl_min} onChange={(e) => setFilter('tl_min', e.target.value)}
                className="input w-16" />
              <span className="text-gray-600 text-xs">–</span>
              <input type="number" min={0} max={19} placeholder="Max"
                value={filters.tl_max} onChange={(e) => setFilter('tl_max', e.target.value)}
                className="input w-16" />
            </div>
          </div>

          {/* Law range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Law</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} max={10} placeholder="Min"
                value={filters.law_min} onChange={(e) => setFilter('law_min', e.target.value)}
                className="input w-16" />
              <span className="text-gray-600 text-xs">–</span>
              <input type="number" min={0} max={10} placeholder="Max"
                value={filters.law_max} onChange={(e) => setFilter('law_max', e.target.value)}
                className="input w-16" />
            </div>
          </div>

          {/* Cost range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Base Price (Cr)</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} placeholder="Min"
                value={filters.cost_min} onChange={(e) => setFilter('cost_min', e.target.value)}
                className="input w-24" />
              <span className="text-gray-600 text-xs">–</span>
              <input type="number" min={0} placeholder="Max"
                value={filters.cost_max} onChange={(e) => setFilter('cost_max', e.target.value)}
                className="input w-24" />
            </div>
          </div>

          {/* Show unavailable toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 uppercase tracking-wider">Show</label>
            <label className="flex items-center gap-2 cursor-pointer h-[34px]">
              <input
                type="checkbox"
                checked={filters.show_unavailable}
                onChange={(e) => setFilter('show_unavailable', e.target.checked)}
                className="w-3.5 h-3.5 accent-nexus-500"
              />
              <span className="text-xs text-gray-400">Unavailable</span>
            </label>
          </div>

          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Grouped list */}
      {records.length === 0 && worldName ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          No store items. Click Regenerate Store to generate inventory.
        </div>
      ) : grouped.size === 0 && records.length > 0 ? (
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
                          <span className="text-gray-700 text-xs ml-auto">
                            {subItems.filter((r) => r.quantity > 0).length} available
                          </span>
                        </button>

                        {/* Item rows */}
                        {!subCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[700px]">
                              <thead>
                                <tr className="border-b border-gray-800 bg-gray-950">
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-10">TL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-10">LL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-28">Base Price</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-28">Roll</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-24">Status</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-20">Qty</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-20">Mult</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-28">Eff. Price</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/60">
                                {subItems.map((r) => (
                                  <tr
                                    key={r.id}
                                    className={`transition-colors ${
                                      r.quantity > 0
                                        ? 'hover:bg-gray-800/40'
                                        : 'opacity-50 hover:bg-gray-800/20'
                                    }`}
                                  >
                                    <td className="px-4 py-2.5">
                                      <button
                                        onClick={() => setSelected(r)}
                                        className="text-gray-200 hover:text-nexus-300 font-medium transition-colors text-left"
                                      >
                                        {r.item_name}
                                      </button>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs">{r.tech_level}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs">{r.law_level}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-400 text-xs">{fmtCr(r.base_price)}</span>
                                    </td>
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                      <span className="font-mono text-gray-500 text-xs">
                                        {r.base_roll} → {r.final_roll}
                                      </span>
                                      {r.price_multiplier > 1 && (
                                        <span className="ml-1.5 px-1 py-0.5 rounded text-xs bg-amber-900/40 text-amber-400">
                                          {r.price_multiplier}×
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {r.quantity > 0 ? (
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
                                      <QtyCell
                                        record={r}
                                        onSave={(id, qty) => patchRecord(id, { quantity: qty })}
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <MultiplierCell
                                        record={r}
                                        onSave={(id, mult) => patchRecord(id, { price_multiplier: mult })}
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-gray-200 text-xs">{fmtCr(r.effective_price)}</span>
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

      {/* Item detail modal */}
      {selected && (
        <GMItemModal record={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
