import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

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

interface ActiveCharacter {
  id: number;
  credits: number;
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

// ── Store Item Detail + Buy Modal ─────────────────────────────────────────────

function StoreItemModal({
  record,
  characterCredits,
  onClose,
  onSuccess,
}: {
  record: StoreRecord;
  characterCredits: number | null;
  onClose: () => void;
  onSuccess: (newBalance: number, newStoreQty: number) => void;
}) {
  const { player } = useAuth();
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  const totalCost = qty * record.effective_price;
  const canAfford = characterCredits !== null && characterCredits >= totalCost;

  const field = (label: string, value: string | number | null | undefined) => (
    <div>
      <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-gray-200 text-sm">{value ?? '—'}</p>
    </div>
  );

  const handleBuy = async () => {
    if (!player) return;
    setBuying(true);
    setError(null);
    try {
      const charsRes = await fetch(`/api/characters/player/${player.id}`).then((r) => r.json());
      const activeChar = (charsRes.data ?? []).find((c: { isActive: boolean }) => c.isActive);
      if (!activeChar) {
        setError('No active character found');
        return;
      }
      const characterId = activeChar.id;
      const res = await fetch('/api/store/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_inventory_id: record.id,
          character_id: characterId,
          quantity: qty,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Purchase failed');
        return;
      }
      setPurchased(true);
      onSuccess(json.new_balance, json.remaining_store_quantity);
    } catch {
      setError('Purchase failed. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between shrink-0">
          <div>
            <p className="text-nexus-500 text-xs uppercase tracking-widest">Store · {record.item_type} / {record.item_sub_type}</p>
            <h2 className="text-lg font-bold text-gray-100 mt-0.5">{record.item_name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-400 text-sm font-mono">{fmtCr(record.effective_price)}</span>
              {record.price_multiplier > 1 && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900/40 text-amber-400">
                  {record.price_multiplier}× price
                </span>
              )}
              <span className="text-gray-600 text-xs">{record.quantity} in stock</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1">✕</button>
        </div>

        {/* Body — item details */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {field('Tech Level', record.tech_level)}
            {field('Law Level', record.law_level)}
            {field('Cost (base)', fmtCr(record.base_price))}
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

        {/* Buy section */}
        <div className="px-6 py-4 border-t border-gray-800 space-y-3 shrink-0">
          {purchased ? (
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 text-sm font-medium">Purchase successful!</span>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-4">
                <div className="space-y-1">
                  <label className="block text-xs text-gray-500 uppercase tracking-wider">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={record.quantity}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.max(1, Math.min(record.quantity, parseInt(e.target.value, 10) || 1)))
                    }
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200 text-sm text-center focus:outline-none focus:border-nexus-500"
                  />
                </div>

                <div className="flex-1 bg-gray-800/60 rounded-lg px-4 py-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className={characterCredits === null ? 'text-gray-400' : canAfford ? 'text-gray-200 font-medium' : 'text-red-400 font-medium'}>
                      {fmtCr(totalCost)}
                    </span>
                  </div>
                  {characterCredits !== null && (
                    <>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Your balance</span>
                        <span>{fmtCr(characterCredits)}</span>
                      </div>
                      {canAfford && (
                        <div className="flex justify-between text-xs border-t border-gray-700 pt-1">
                          <span className="text-gray-600">Balance after</span>
                          <span className="text-emerald-500">{fmtCr(characterCredits - totalCost)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={handleBuy}
                  disabled={buying || !canAfford || qty < 1 || characterCredits === null}
                  className="px-5 py-2 bg-nexus-700 hover:bg-nexus-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  {buying ? 'Purchasing…' : 'Buy'}
                </button>
              </div>

              {characterCredits === null && (
                <p className="text-gray-600 text-xs">No active character — select a character to purchase items.</p>
              )}
              {characterCredits !== null && !canAfford && (
                <p className="text-red-400 text-xs">Insufficient funds</p>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PlayerStorePage() {
  const { player } = useAuth();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [records, setRecords] = useState<StoreRecord[]>([]);
  const [character, setCharacter] = useState<ActiveCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoreRecord | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    const [gameRes, storeRes] = await Promise.all([
      fetch('/api/game').then((r) => r.json()),
      fetch('/api/store/player').then((r) => r.json()),
    ]);
    setGame(gameRes.data ?? null);
    setRecords(storeRes.data ?? []);

    if (player) {
      const charsRes = await fetch(`/api/characters/player/${player.id}`).then((r) => r.json());
      const activeChar = (charsRes.data ?? []).find((c: { isActive: boolean }) => c.isActive);
      if (activeChar) {
        setCharacter({ id: activeChar.id, credits: activeChar.credits });
      }
    }
  };

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived type/subtype lists for filter dropdowns
  const meta = useMemo(() => {
    const types = Array.from(new Set(records.map((r) => r.item_type))).sort();
    const subTypes = Array.from(
      new Map(records.map((r) => [`${r.item_type}::${r.item_sub_type}`, { type: r.item_type, sub_type: r.item_sub_type }])).values()
    );
    return { types, subTypes };
  }, [records]);

  const availableSubTypes = useMemo(() => {
    if (!filters.type) return [];
    return meta.subTypes.filter((st) => st.type === filters.type).map((st) => st.sub_type);
  }, [meta.subTypes, filters.type]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filters.type && r.item_type !== filters.type) return false;
      if (filters.sub_type && r.item_sub_type !== filters.sub_type) return false;
      if (filters.tl_min !== '' && r.tech_level < parseInt(filters.tl_min)) return false;
      if (filters.tl_max !== '' && r.tech_level > parseInt(filters.tl_max)) return false;
      if (filters.law_min !== '' && r.law_level < parseInt(filters.law_min)) return false;
      if (filters.law_max !== '' && r.law_level > parseInt(filters.law_max)) return false;
      if (filters.cost_min !== '' && r.effective_price < parseFloat(filters.cost_min)) return false;
      if (filters.cost_max !== '' && r.effective_price > parseFloat(filters.cost_max)) return false;
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
    for (const subMap of map.values()) {
      for (const items of subMap.values()) {
        items.sort((a, b) => a.item_name.localeCompare(b.item_name));
      }
    }
    // Sort types and sub-types alphabetically
    return new Map(
      Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, subMap]) => [
          type,
          new Map(Array.from(subMap.entries()).sort(([a], [b]) => a.localeCompare(b))),
        ])
    );
  }, [filtered]);

  const allGroupKeys = useMemo(() => {
    const keys: string[] = [];
    for (const [type, subMap] of grouped.entries()) {
      keys.push(`type:${type}`);
      for (const subType of subMap.keys()) {
        keys.push(`sub:${type}::${subType}`);
      }
    }
    return keys;
  }, [grouped]);

  const allCollapsed = allGroupKeys.length > 0 && allGroupKeys.every((k) => collapsed.has(k));

  const toggleCollapseAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(allGroupKeys));

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handlePurchaseSuccess = (newBalance: number, newStoreQty: number) => {
    if (selected) {
      const updatedRecord = { ...selected, quantity: newStoreQty };
      setRecords((prev) =>
        newStoreQty > 0
          ? prev.map((r) => (r.id === selected.id ? updatedRecord : r))
          : prev.filter((r) => r.id !== selected.id)
      );
      setSelected(newStoreQty > 0 ? updatedRecord : null);
    }
    setCharacter((prev) => (prev ? { ...prev, credits: newBalance } : prev));
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
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">World</p>
          <h1 className="text-2xl font-bold text-gray-100">
            Store — {worldName ?? 'No World Selected'}
          </h1>
          {!worldName ? (
            <p className="text-gray-500 text-sm mt-1">The GM has not set a current world.</p>
          ) : (
            <p className="text-gray-500 text-sm mt-1">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== records.length && ` of ${records.length}`} available
            </p>
          )}
        </div>

        {character && (
          <div className="text-right shrink-0">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Balance</p>
            <p className="text-xl font-bold text-emerald-400">{fmtCr(character.credits)}</p>
          </div>
        )}
      </div>

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

          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Clear Filters
          </button>

          <button
            onClick={toggleCollapseAll}
            disabled={allGroupKeys.length === 0}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {allCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
        </div>
      )}

      {/* Grouped list */}
      {grouped.size === 0 && records.length > 0 ? (
        <p className="text-gray-600 text-sm">No items match your filters.</p>
      ) : grouped.size === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          {worldName ? 'No items available for purchase at this world.' : 'Nothing to show.'}
        </div>
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
                            <table className="w-full text-sm min-w-[520px]">
                              <thead>
                                <tr className="border-b border-gray-800 bg-gray-950">
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">TL</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">Law</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-32">Price</th>
                                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-16">Qty</th>
                                  <th className="px-4 py-2 w-16" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/60">
                                {subItems.map((r) => (
                                  <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
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
                                      <span className="font-mono text-gray-300 text-xs">
                                        {fmtCr(r.effective_price)}
                                      </span>
                                      {r.price_multiplier > 1 && (
                                        <span className="ml-1.5 text-amber-500 text-xs">({r.price_multiplier}×)</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-gray-500 text-xs">{r.quantity}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <button
                                        onClick={() => setSelected(r)}
                                        disabled={!character}
                                        className="px-2.5 py-1 bg-nexus-700 hover:bg-nexus-600 disabled:opacity-40 text-white text-xs rounded transition-colors"
                                      >
                                        Buy
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

      {/* Item detail + buy modal */}
      {selected && (
        <StoreItemModal
          record={selected}
          characterCredits={character?.credits ?? null}
          onClose={() => setSelected(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
}
