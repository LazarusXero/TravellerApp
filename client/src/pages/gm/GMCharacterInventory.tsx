import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemViewModal, Item } from '../player/ItemBrowser';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  item_id: number;
  owner_id: number;
  owner_type: string;
  quantity: number;
  equipped: boolean;
  is_hidden: boolean;
  notes: string | null;
  purchased_price: number | null;
  created_at: string;
  item: Item;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Quantity Cell ─────────────────────────────────────────────────────────────

function QtyCell({
  invItem,
  onChange,
}: {
  invItem: InventoryItem;
  onChange: (id: number, qty: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(invItem.quantity));
  const [saving, setSaving] = useState(false);

  const commit = async (raw: string) => {
    const qty = parseInt(raw);
    if (isNaN(qty) || qty < 0) { setValue(String(invItem.quantity)); return; }
    if (qty === invItem.quantity) return;
    setSaving(true);
    await onChange(invItem.id, qty);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        disabled={saving || parseInt(value) <= 0}
        onClick={() => { const n = Math.max(0, parseInt(value) - 1); setValue(String(n)); onChange(invItem.id, n); }}
        className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-30 text-xs"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        disabled={saving}
        className="w-12 text-center bg-transparent border border-gray-700 rounded px-1 py-0.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-nexus-600 disabled:opacity-40"
      />
      <button
        disabled={saving}
        onClick={() => { const n = parseInt(value) + 1; setValue(String(n)); onChange(invItem.id, n); }}
        className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-30 text-xs"
      >
        +
      </button>
    </div>
  );
}

// ── GM Character Inventory ────────────────────────────────────────────────────

export function GMCharacterInventory() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const charId = parseInt(characterId ?? '');

  const [characterName, setCharacterName] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [charOptions, setCharOptions] = useState<{ id: number; playerName: string; charName: string }[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    if (isNaN(charId)) return;

    Promise.all([
      fetch('/api/gm/characters').then((r) => r.json()),
      fetch(`/api/inventory/character/${charId}`).then((r) => r.json()),
    ]).then(([charJson, invData]: [{ success: boolean; data: { id: number; name: string; characters: { id: number; name: string }[] }[] }, InventoryItem[]]) => {
      const opts: { id: number; playerName: string; charName: string }[] = [];
      for (const player of charJson.data) {
        for (const c of player.characters) {
          opts.push({ id: c.id, playerName: player.name, charName: c.name });
        }
        const match = player.characters.find((c) => c.id === charId);
        if (match) {
          setCharacterName(match.name);
          setPlayerName(player.name);
        }
      }
      setCharOptions(opts);
      setInventory(invData);
    }).finally(() => setLoading(false));
  }, [charId]);

  const handleQtyChange = async (id: number, qty: number) => {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty }),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.deleted) {
        setInventory((prev) => prev.filter((inv) => inv.id !== id));
      } else {
        setInventory((prev) => prev.map((inv) => (inv.id === id ? { ...inv, quantity: qty } : inv)));
      }
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate('/gm/inventory')}
            className="text-gray-600 hover:text-gray-300 text-sm transition-colors"
          >
            ← All Characters
          </button>

          {charOptions.length > 0 && (
            <select
              value={charId}
              onChange={(e) => navigate(`/gm/inventory/${e.target.value}`)}
              className="bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm
                         px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-nexus-600
                         max-w-xs truncate"
            >
              {charOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.playerName} — {opt.charName}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="text-nexus-500 text-xs uppercase tracking-widest">
          GM Console — {playerName}
        </p>
        <h1 className="text-2xl font-bold text-gray-100">{characterName || 'Character'} — Inventory</h1>
        {!loading && (
          <p className="text-gray-600 text-sm">
            {inventory.length} item{inventory.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {inventory.length === 0 ? (
        <p className="text-gray-600 text-sm">This character's inventory is empty.</p>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950">
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Type</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Sub-Type</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">TL</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-24">Mass</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-32">Qty</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-32">Base Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {inventory.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setSelected(inv.item)}
                        className="text-gray-200 hover:text-nexus-300 font-medium transition-colors text-left"
                      >
                        {inv.item.name}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-gray-400 text-xs">{inv.item.type}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-gray-500 text-xs">{inv.item.sub_type}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-gray-400 text-xs">{inv.item.tech_level}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-gray-500 text-xs">{formatMass(inv.item.mass_kg)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <QtyCell invItem={inv} onChange={handleQtyChange} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-gray-300 text-xs">{formatCost(inv.item.cost_cr)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <ItemViewModal item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default GMCharacterInventory;
