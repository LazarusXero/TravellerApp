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
  const { allCharacters, loading, refetch } = useActiveCharacter(player?.id ?? 0);
  const [activating, setActivating] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleDelete(e: React.MouseEvent, charId: number) {
    e.stopPropagation();
    if (confirmDelete !== charId) {
      setConfirmDelete(charId);
      return;
    }
    setDeleting(charId);
    setConfirmDelete(null);
    try {
      await apiFetch(`/api/characters/${charId}`, { method: 'DELETE' });
      refetch?.();
    } finally {
      setDeleting(null);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(null);
  }

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

            const isConfirming = confirmDelete === char.id;
            const isDeleting = deleting === char.id;

            return (
              <div key={char.id} className="relative">
                <button
                  onClick={() => void handleSelect(char)}
                  disabled={disabled || isDeleting}
                  className={[
                    'card text-left flex flex-col gap-3 transition-all duration-150 w-full',
                    disabled || isDeleting
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
                        {isActivating ? 'Switching…' : isDeleting ? 'Deleting…' : char.name}
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

                {/* Delete control */}
                {!isDeleting && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isConfirming ? (
                      <>
                        <button
                          onClick={(e) => void handleDelete(e, char.id)}
                          className="text-xs px-2 py-0.5 rounded bg-red-900/70 text-red-300 hover:bg-red-800 border border-red-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => void handleDelete(e, char.id)}
                        title="Delete character"
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
