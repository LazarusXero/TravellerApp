import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../hooks/useApi';
import { useActiveCharacter, BannerCharacter } from '../../components/ActiveCharacterBanner';
import { CHARACTER_COLORS } from '../../constants/characters';

function hexFor(colorScheme: string): string {
  return CHARACTER_COLORS.find((c) => c.name === colorScheme)?.hex ?? '#4FC3F7';
}

export function CharactersPage() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const { allCharacters, loading } = useActiveCharacter(player?.id ?? 0);
  const [activating, setActivating] = useState<number | null>(null);

  async function handleSelect(char: BannerCharacter) {
    if (char.isActive) {
      navigate('/player/character');
      return;
    }
    setActivating(char.id);
    await apiFetch(`/api/characters/${char.id}/activate`, { method: 'PUT' });
    // Full navigation so both the banner and character sheet reload with the new active character
    window.location.href = '/player/character';
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading characters…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Player</p>
          <h1 className="text-2xl font-bold text-gray-100">Characters</h1>
          {allCharacters.length > 0 && (
            <p className="text-gray-500 text-sm mt-1">
              {allCharacters.length} character{allCharacters.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/player/create-character')}
          //className="shrink-0 px-4 py-2 rounded-lg border border-nexus-700 text-nexus-400
          //           hover:bg-nexus-900/40 hover:text-nexus-300 hover:border-nexus-600
          //           text-sm font-medium transition-colors"
          className="btn-primary shrink-0"
        >
          + Create Character
        </button>
      </div>

      {/* Empty state */}
      {allCharacters.length === 0 ? (
        <div className="card text-center py-16 space-y-4">
          <p className="text-gray-500 text-sm">No characters yet.</p>
          <button
            onClick={() => navigate('/player/create-character')}
            className="text-nexus-400 hover:text-nexus-300 text-sm transition-colors"
          >
            Create your first character →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCharacters.map((char) => {
            const hex = hexFor(char.colorScheme);
            const isActivating = activating === char.id;
            const disabled = activating !== null;

            return (
              <button
                key={char.id}
                onClick={() => void handleSelect(char)}
                disabled={disabled}
                className={[
                  'card text-left flex flex-col gap-3 transition-all duration-150',
                  disabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:scale-[1.02] cursor-pointer',
                ].join(' ')}
                style={{
                  borderColor: char.isActive ? hex + '60' : undefined,
                  boxShadow: char.isActive ? `0 0 12px ${hex}22` : undefined,
                }}
              >
                {/* Top row: color dot + name + active badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: hex, boxShadow: `0 0 6px ${hex}88` }}
                    />
                    <span
                      className="font-bold text-sm leading-tight truncate"
                      style={{ color: hex }}
                    >
                      {isActivating ? 'Switching…' : char.name}
                    </span>
                  </div>
                  {char.isActive && (
                    <span
                      className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ color: hex, backgroundColor: hex + '22' }}
                    >
                      Active
                    </span>
                  )}
                </div>

                {/* Species */}
                {char.species && (
                  <p className="text-gray-400 text-xs truncate">{char.species}</p>
                )}

                {/* Status */}
                <div className="mt-auto pt-1 border-t border-gray-800 flex items-center justify-between">
                  <span
                    className={[
                      'text-xs uppercase tracking-wider font-medium',
                      char.status === 'ACTIVE' ? 'text-emerald-500' : 'text-gray-600',
                    ].join(' ')}
                  >
                    {char.status === 'ACTIVE' ? 'Alive' : char.status.toLowerCase()}
                  </span>
                  <span className="text-gray-700 text-xs">
                    {char.isActive ? 'View sheet →' : 'Switch & view →'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
