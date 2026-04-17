import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useActiveCharacter } from '../../components/ActiveCharacterBanner';
import { Item } from './ItemBrowser';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  item_id: number;
  owner_type: string;
  owner_id: number;
  quantity: number;
  equipped: boolean;
  is_hidden: boolean;
  notes: string | null;
  purchased_price: number | null;
  created_at: string;
  item: Item;
}

interface CharacterOption {
  id: number;
  name: string;
  playerName: string;
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

// ── Inventory Item Modal ──────────────────────────────────────────────────────

function InventoryItemModal({
  invItem,
  sendingCharacterId,
  onClose,
  onSent,
}: {
  invItem: InventoryItem;
  sendingCharacterId: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const { item } = invItem;
  const [view, setView] = useState<'detail' | 'send'>('detail');

  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const field = (label: string, value: string | number | null | undefined) => (
    <div>
      <p className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-gray-200 text-sm">{value ?? '—'}</p>
    </div>
  );

  const openSendView = async () => {
    setView('send');
    setSelectedCharId('');
    setQuantity(1);
    setSuccessMsg(null);
    setErrorMsg(null);
    if (characters.length === 0) {
      setCharsLoading(true);
      try {
        const res = await fetch('/api/gm/characters');
        const json: { success: boolean; data: { id: number; name: string; characters: { id: number; name: string }[] }[] } = await res.json();
        const opts: CharacterOption[] = [];
        for (const player of json.data) {
          for (const char of player.characters) {
            if (char.id !== sendingCharacterId) {
              opts.push({ id: char.id, name: char.name, playerName: player.name });
            }
          }
        }
        setCharacters(opts);
      } finally {
        setCharsLoading(false);
      }
    }
  };

  const cancelSend = () => {
    setView('detail');
    setSuccessMsg(null);
  };

  const confirmSend = async () => {
    if (selectedCharId === '') return;
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/inventory/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, characterId: selectedCharId, quantity, senderCharacterId: sendingCharacterId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg((body as { error?: string }).error ?? 'Send failed');
        return;
      }
      const charName = characters.find((c) => c.id === selectedCharId)?.name ?? 'character';
      setSuccessMsg(`Item sent to ${charName}`);
      onSent();
      setTimeout(() => {
        setView('detail');
        setSuccessMsg(null);
      }, 1500);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {view === 'detail' ? (
          <>
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
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
              <button onClick={openSendView} className="btn-secondary mr-auto">
                Send to Character
              </button>
              <button onClick={onClose} className="btn-secondary">Close</button>
            </div>
          </>
        ) : (
          <>
            {/* Send view header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between shrink-0">
              <div>
                <p className="text-nexus-500 text-xs uppercase tracking-widest">Send to Character</p>
                <h2 className="text-lg font-bold text-gray-100 mt-0.5">{item.name}</h2>
                <p className="text-gray-600 text-xs mt-0.5">{item.type} / {item.sub_type}</p>
              </div>
              <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1">✕</button>
            </div>

            {/* Send view body */}
            <div className="px-6 py-6 flex-1 space-y-5">
              {successMsg ? (
                <p className="text-emerald-400 text-sm font-medium">{successMsg}</p>
              ) : errorMsg ? (
                <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Character</label>
                    {charsLoading ? (
                      <p className="text-gray-600 text-sm">Loading…</p>
                    ) : characters.length === 0 ? (
                      <p className="text-gray-600 text-sm">No other characters found.</p>
                    ) : (
                      <select
                        className="input w-full"
                        value={selectedCharId}
                        onChange={(e) => setSelectedCharId(e.target.value === '' ? '' : parseInt(e.target.value))}
                      >
                        <option value="">Select a character…</option>
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.playerName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Quantity <span className="text-gray-700 normal-case">(max {invItem.quantity})</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={invItem.quantity}
                      className="input w-24"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(invItem.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Send view footer */}
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
              <button onClick={cancelSend} className="btn-secondary">Cancel</button>
              {!successMsg && (
                <button
                  onClick={confirmSend}
                  disabled={sending || selectedCharId === '' || characters.length === 0}
                  className="btn-primary"
                >
                  {sending ? 'Sending…' : 'Confirm'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Player Inventory Page ─────────────────────────────────────────────────────

export function InventoryPage() {
  const { player } = useAuth();
  const { activeCharacter, loading: charLoading } = useActiveCharacter(player!.id);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const loadInventory = (characterId: number) => {
    setLoading(true);
    fetch(`/api/inventory/character/${characterId}`)
      .then((r) => r.json())
      .then((data: InventoryItem[]) => setInventory(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!activeCharacter) return;
    loadInventory(activeCharacter.id);
  }, [activeCharacter?.id]);

  const handleSent = () => {
    if (activeCharacter) loadInventory(activeCharacter.id);
    setTimeout(() => setSelected(null), 1500);
  };

  if (charLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-600 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Player View</p>
        <h1 className="text-2xl font-bold text-gray-100">Inventory</h1>
        {activeCharacter && !loading && (
          <p className="text-gray-600 text-sm mt-1">
            {inventory.length} item{inventory.length !== 1 ? 's' : ''} — {activeCharacter.name}
          </p>
        )}
      </div>

      {!activeCharacter ? (
        <p className="text-gray-600 text-sm">No active character selected.</p>
      ) : loading ? (
        <p className="text-gray-600 text-sm">Loading inventory…</p>
      ) : inventory.length === 0 ? (
        <p className="text-gray-600 text-sm">Your inventory is empty.</p>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950">
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Name</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Type</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium">Sub-Type</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-12">TL</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-24">Mass</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-16">Qty</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider font-medium w-32">Base Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {inventory.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setSelected(inv)}
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
                      <span className="font-mono text-gray-300 text-xs">{inv.quantity}</span>
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

      {selected && activeCharacter && (
        <InventoryItemModal
          invItem={selected}
          sendingCharacterId={activeCharacter.id}
          onClose={() => setSelected(null)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}

export default InventoryPage;
