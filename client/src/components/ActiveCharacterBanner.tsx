import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi';
import { CHARACTER_COLORS } from '../constants/characters';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BannerCharacter {
  id: number;
  name: string;
  species: string | null;
  colorScheme: string;
  isActive: boolean;
  status: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useActiveCharacter(playerId: number) {
  const [allCharacters, setAllCharacters] = useState<BannerCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<BannerCharacter[]>(`/api/characters/player/${playerId}`);
    if (res.success && res.data) setAllCharacters(res.data);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const activeCharacter = allCharacters.find((c) => c.isActive) ?? null;
  return { activeCharacter, allCharacters, loading, refetch };
}

// ── Banner component ──────────────────────────────────────────────────────────

export function ActiveCharacterBanner({ playerId }: { playerId: number }) {
  const { activeCharacter, allCharacters, loading } = useActiveCharacter(playerId);
  const [switching, setSwitching] = useState(false);

  // Don't flash anything while loading
  if (loading) return null;

  // No characters at all
  if (allCharacters.length === 0) {
    return (
      <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <span className="text-gray-600 text-xs uppercase tracking-wider">No active character</span>
        <Link
          to="/player/create-character"
          className="text-nexus-400 hover:text-nexus-300 text-xs transition-colors"
        >
          Create one →
        </Link>
      </div>
    );
  }

  if (!activeCharacter) return null;

  const hex =
    CHARACTER_COLORS.find((c) => c.name === activeCharacter.colorScheme)?.hex ?? '#4FC3F7';

  // Characters that are alive (status=ACTIVE) but not currently the active one
  const switchable = allCharacters.filter(
    (c) => c.id !== activeCharacter.id && c.status === 'ACTIVE',
  );

  async function handleSwitch(targetId: number) {
    setSwitching(true);
    await apiFetch(`/api/characters/${targetId}/activate`, { method: 'PUT' });
    window.location.reload();
  }

  return (
    <div
      className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-4 shrink-0"
      style={{ backgroundColor: hex + '1a' /* 10% */ }}
    >
      {/* Identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: hex, boxShadow: `0 0 6px ${hex}88` }}
        />
        <span className="font-bold text-sm leading-none truncate" style={{ color: hex }}>
          {activeCharacter.name}
        </span>
        {activeCharacter.species && (
          <span className="text-gray-500 text-xs hidden sm:inline truncate">
            {activeCharacter.species}
          </span>
        )}
      </div>

      {/* Switch controls */}
      {switchable.length === 1 && (
        <button
          onClick={() => void handleSwitch(switchable[0].id)}
          disabled={switching}
          className="text-xs px-2.5 py-1 rounded border transition-colors shrink-0 disabled:opacity-40"
          style={{ borderColor: hex + '60', color: hex }}
        >
          {switching ? '…' : `Switch to ${switchable[0].name}`}
        </button>
      )}

      {switchable.length > 1 && (
        <select
          disabled={switching}
          onChange={(e) => e.target.value && void handleSwitch(parseInt(e.target.value, 10))}
          className="text-xs px-2 py-1 rounded bg-transparent border transition-colors shrink-0 disabled:opacity-40"
          style={{ borderColor: hex + '60', color: hex }}
          value=""
          // Resets to placeholder after selection
          key={switching ? 'switching' : 'idle'}
        >
          <option value="" disabled>Switch character…</option>
          {switchable.map((c) => (
            <option key={c.id} value={c.id} style={{ color: '#e5e7eb', backgroundColor: '#1f2937' }}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
