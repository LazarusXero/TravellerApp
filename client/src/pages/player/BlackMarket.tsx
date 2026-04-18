import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

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
}

interface BMRow {
  item: BMItem;
  bm_final_roll: number | null;
  bm_quantity: number | null;
  is_unlocked: boolean;
  streetwise_dm: number;
  unlocked_by: string | null;
}

interface GameInfo {
  id: number;
  current_world: { id: number; name: string } | null;
}

interface ActiveCharacter {
  id: number;
  credits: number;
  activity_points: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCr(n: number): string {
  if (n >= 1_000_000) return `MCr ${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1_000) return `KCr ${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `Cr ${Math.round(n).toLocaleString()}`;
}

function fmtMass(kg: number | null): string {
  if (kg == null) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toLocaleString()} T`;
  return `${kg.toLocaleString()} kg`;
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

// ── Item Detail + Buy Modal ───────────────────────────────────────────────────

function BMItemModal({
  row,
  worldId,
  characterCredits,
  onClose,
  onSuccess,
}: {
  row: BMRow;
  worldId: number;
  characterCredits: number | null;
  onClose: () => void;
  onSuccess: (newBalance: number, remainingQty: number) => void;
}) {
  const { player } = useAuth();
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  const mult = defaultMult(row.item.black_market_category);
  const unitPrice = row.item.cost_cr * mult;
  const maxQty = row.bm_quantity ?? 0;
  const totalCost = qty * unitPrice;
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
      if (!activeChar) { setError('No active character found'); return; }

      const res = await fetch(`/api/black-market/${worldId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: row.item.id,
          character_id: activeChar.id,
          quantity: qty,
          unit_price: unitPrice,
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Purchase failed'); return; }
      setPurchased(true);
      onSuccess(json.new_balance, json.remaining_bm_quantity ?? 0);
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
            <p className="text-nexus-500 text-xs uppercase tracking-widest">
              Black Market · {row.item.type} / {row.item.sub_type}
            </p>
            <h2 className="text-lg font-bold text-gray-100 mt-0.5">{row.item.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-400 text-sm font-mono">{fmtCr(unitPrice)}</span>
              {mult > 1 && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900/40 text-amber-400">
                  {mult}× price
                </span>
              )}
              <span className="text-gray-600 text-xs">{maxQty} available</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {field('Tech Level', row.item.tech_level)}
            {field('Law Level', row.item.law_level)}
            {field('BM Category', row.item.black_market_category)}
            {field('Base Price', fmtCr(row.item.cost_cr))}
            {field('Mass', fmtMass(row.item.mass_kg))}
            {field('Damage', row.item.damage)}
            {field('Protection', row.item.protection)}
            {field('Magazine Qty', row.item.magazine_qty)}
            {field('Slots', row.item.slots)}
            {field('Radiation Protection', row.item.radiation_protection)}
            {field('Range', row.item.range)}
            {field('Required Skill', row.item.required_skill)}

            <div className="col-span-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Traits</p>
              <p className="text-gray-200 text-sm">{row.item.traits ?? '—'}</p>
            </div>

            <div className="col-span-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Reference</p>
              <p className="text-gray-200 text-sm">{row.item.reference ?? '—'}</p>
            </div>

            {row.item.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Description</p>
                <p className="text-gray-300 text-sm leading-relaxed">{row.item.description}</p>
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
                  <label className="block text-xs text-gray-500 uppercase tracking-wider">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={maxQty}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.max(1, Math.min(maxQty, parseInt(e.target.value, 10) || 1)))
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
                  disabled={buying || !canAfford || qty < 1 || maxQty === 0 || characterCredits === null}
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

// ── Search Black Market Modal ─────────────────────────────────────────────────

function SearchModal({
  allRows,
  worldId,
  character,
  onClose,
  onSuccess,
}: {
  allRows: BMRow[];
  worldId: number;
  character: ActiveCharacter | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { player } = useAuth();
  const [searchType, setSearchType] = useState('');
  const [searchSubType, setSearchSubType] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEnoughAP = (character?.activity_points ?? 0) >= 2;

  // Already-unlocked type+subtype keys
  const unlockedKeys = useMemo(
    () => new Set(allRows.filter((r) => r.is_unlocked).map((r) => `${r.item.type}|${r.item.sub_type}`)),
    [allRows]
  );

  // All distinct types (with at least one unlockable sub-type)
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const r of allRows) {
      if (!unlockedKeys.has(`${r.item.type}|${r.item.sub_type}`)) {
        types.add(r.item.type);
      }
    }
    return [...types].sort();
  }, [allRows, unlockedKeys]);

  // Sub-types for selected type that aren't already unlocked
  const availableSubTypes = useMemo(() => {
    if (!searchType) return [];
    const subs = new Set<string>();
    for (const r of allRows) {
      if (r.item.type === searchType && !unlockedKeys.has(`${r.item.type}|${r.item.sub_type}`)) {
        subs.add(r.item.sub_type);
      }
    }
    return [...subs].sort();
  }, [allRows, searchType, unlockedKeys]);

  const canSearch = hasEnoughAP && searchType && searchSubType;

  const handleSearch = async () => {
    if (!player || !canSearch) return;
    setSearching(true);
    setError(null);
    try {
      const charsRes = await fetch(`/api/characters/player/${player.id}`).then((r) => r.json());
      const activeChar = (charsRes.data ?? []).find((c: { isActive: boolean }) => c.isActive);
      if (!activeChar) { setError('No active character found'); return; }

      const unlockRes = await fetch(`/api/black-market/${worldId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: searchType,
          item_sub_type: searchSubType,
          character_id: activeChar.id,
        }),
      });
      const unlockJson = await unlockRes.json();
      if (!unlockJson.success) { setError(unlockJson.error ?? 'Search failed'); return; }

      await fetch(`/api/characters/${activeChar.id}/deduct-ap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: 2, actionLabel: 'Black Market Search' }),
      });

      onSuccess();
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-gray-100 font-semibold">Search Black Market</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Item Type */}
          <div className="space-y-1">
            <label className="block text-xs text-gray-600 uppercase tracking-wider">Item Type</label>
            <select
              value={searchType}
              onChange={(e) => { setSearchType(e.target.value); setSearchSubType(''); }}
              className="input w-full"
            >
              <option value="">Select type…</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Sub-Type */}
          <div className="space-y-1">
            <label className="block text-xs text-gray-600 uppercase tracking-wider">Sub-Type</label>
            <select
              value={searchSubType}
              onChange={(e) => setSearchSubType(e.target.value)}
              disabled={!searchType}
              className="input w-full disabled:opacity-50"
            >
              <option value="">Select sub-type…</option>
              {availableSubTypes.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* AP notice */}
          <div className="text-xs text-gray-600 bg-gray-800/60 rounded-lg px-3 py-2 space-y-0.5">
            <p>This action costs 2 Activity Points.</p>
            {character && (
              <p className={hasEnoughAP ? 'text-gray-500' : 'text-red-400'}>
                You have {character.activity_points} AP remaining.
              </p>
            )}
          </div>

          {!hasEnoughAP && (
            <p className="text-red-400 text-xs">Insufficient activity points.</p>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSearch}
            disabled={!canSearch || searching}
            title={!hasEnoughAP ? 'Insufficient activity points.' : undefined}
            className="px-4 py-2 bg-nexus-700 hover:bg-nexus-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PlayerBlackMarketPage() {
  const { player } = useAuth();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [allRows, setAllRows] = useState<BMRow[]>([]);
  const [character, setCharacter] = useState<ActiveCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BMRow | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const worldId = game?.current_world?.id ?? null;

  const fetchAll = async () => {
    const gameRes = await fetch('/api/game').then((r) => r.json());
    const g: GameInfo | null = gameRes.data ?? null;
    setGame(g);

    if (g?.current_world?.id) {
      const bmRes = await fetch(`/api/black-market/${g.current_world.id}/inventory`).then((r) => r.json());
      setAllRows(bmRes.data ?? []);
    } else {
      setAllRows([]);
    }

    if (player) {
      const charsRes = await fetch(`/api/characters/player/${player.id}`).then((r) => r.json());
      const activeChar = (charsRes.data ?? []).find((c: { isActive: boolean }) => c.isActive);
      if (activeChar) {
        setCharacter({
          id: activeChar.id,
          credits: activeChar.credits,
          activity_points: activeChar.activity_points,
        });
      }
    }
  };

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only show unlocked rows to players
  const unlockedRows = useMemo(
    () => allRows.filter((r) => r.is_unlocked && (r.bm_quantity ?? 0) > 0),
    [allRows]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, BMRow[]>>();
    for (const r of unlockedRows) {
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
  }, [unlockedRows]);

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

  const handlePurchaseSuccess = (newBalance: number, remainingQty: number) => {
    if (selected) {
      const updated: BMRow = { ...selected, bm_quantity: remainingQty };
      setAllRows((prev) => prev.map((r) => r.item.id === selected.item.id ? updated : r));
      setSelected(remainingQty > 0 ? updated : null);
    }
    setCharacter((prev) => (prev ? { ...prev, credits: newBalance } : prev));
  };

  const handleSearchSuccess = async () => {
    setSearchOpen(false);
    await fetchAll();
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
            Black Market — {worldName ?? 'No World Selected'}
          </h1>
          {!worldName ? (
            <p className="text-gray-500 text-sm mt-1">The GM has not set a current world.</p>
          ) : (
            <p className="text-gray-500 text-sm mt-1">
              {unlockedRows.length} item{unlockedRows.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>

        <div className="flex items-start gap-4 shrink-0">
          {character && (
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Balance</p>
              <p className="text-xl font-bold text-emerald-400">{fmtCr(character.credits)}</p>
            </div>
          )}

          {worldName && (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-nexus-700 hover:bg-nexus-600 text-white text-sm rounded-lg transition-colors"
            >
              <span>🔍</span>
              <span>Search Black Market</span>
            </button>
          )}
        </div>
      </div>

      {/* Grouped list */}
      {!worldName ? null : grouped.size === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm space-y-2">
          <p>No black market items available.</p>
          <p className="text-gray-700 text-xs">Use "Search Black Market" to unlock item categories.</p>
        </div>
      ) : (
        <>
          {/* Collapse all control */}
          {allGroupKeys.length > 1 && (
            <div className="flex justify-end">
              <button
                onClick={toggleCollapseAll}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                {allCollapsed ? 'Expand All' : 'Collapse All'}
              </button>
            </div>
          )}

          {Array.from(grouped.entries()).map(([type, subMap]) => {
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
                              {subRows.length} item{subRows.length !== 1 ? 's' : ''}
                            </span>
                          </button>

                          {/* Item rows */}
                          {!subCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm min-w-[540px]">
                                <thead>
                                  <tr className="border-b border-gray-800 bg-gray-950">
                                    <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                                    <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">TL</th>
                                    <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">LL</th>
                                    <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">BM Cat</th>
                                    <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-36">Price</th>
                                    <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-16">Qty</th>
                                    <th className="px-4 py-2 w-16" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/60">
                                  {subRows.map((r) => {
                                    const mult = defaultMult(r.item.black_market_category);
                                    const price = r.item.cost_cr * mult;
                                    const qty = r.bm_quantity ?? 0;

                                    return (
                                      <tr
                                        key={r.item.id}
                                        className={`transition-colors ${qty > 0 ? 'hover:bg-gray-800/40' : 'opacity-50 hover:bg-gray-800/20'}`}
                                      >
                                        <td className="px-4 py-2.5">
                                          <button
                                            onClick={() => setSelected(r)}
                                            className="text-gray-200 hover:text-nexus-300 font-medium transition-colors text-left"
                                          >
                                            {r.item.name}
                                          </button>
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
                                          <span className="font-mono text-gray-300 text-xs">{fmtCr(price)}</span>
                                          {mult > 1 && (
                                            <span className="ml-1.5 text-amber-500 text-xs">({mult}×)</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className="text-gray-500 text-xs">{qty}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                          <button
                                            onClick={() => setSelected(r)}
                                            disabled={!character || qty === 0}
                                            className="px-2.5 py-1 bg-nexus-700 hover:bg-nexus-600 disabled:opacity-40 text-white text-xs rounded transition-colors"
                                          >
                                            Buy
                                          </button>
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
          })}
        </>
      )}

      {/* Item detail + buy modal */}
      {selected && worldId && (
        <BMItemModal
          row={selected}
          worldId={worldId}
          characterCredits={character?.credits ?? null}
          onClose={() => setSelected(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* Search modal */}
      {searchOpen && worldId && (
        <SearchModal
          allRows={allRows}
          worldId={worldId}
          character={character}
          onClose={() => setSearchOpen(false)}
          onSuccess={handleSearchSuccess}
        />
      )}
    </div>
  );
}
