import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi';
import { CHARACTER_COLORS } from '../../constants/characters';

function hexFor(colorScheme: string): string {
  return CHARACTER_COLORS.find((c) => c.name === colorScheme)?.hex ?? '#4FC3F7';
}

interface CharacterSkill {
  id: number;
  characterId: number;
  skillName: string;
  level: number | null;
}

interface Character {
  id: number;
  name: string;
  species: string | null;
  colorScheme: string;
  status: string;
  character_skills: CharacterSkill[];
  [key: string]: unknown;
}

interface PlayerWithCharacters {
  id: number;
  name: string;
  characters: Character[];
}

export function GMCharactersPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerWithCharacters[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PlayerWithCharacters[]>('/api/gm/characters')
      .then((res) => setPlayers(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const totalCharacters = players.reduce((sum, p) => sum + p.characters.length, 0);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Players</p>
        <h1 className="text-2xl font-bold text-gray-100">Characters</h1>
        <p className="text-gray-500 text-sm mt-1">
          {totalCharacters} character{totalCharacters !== 1 ? 's' : ''} across {players.length} player{players.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Player sections */}
      {players.map((player) => (
        <div key={player.id} className="space-y-3">
          <p className="text-nexus-500 text-xs uppercase tracking-widest">{player.name}</p>

          {player.characters.length === 0 ? (
            <p className="text-gray-600 text-sm">No characters yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.characters.map((char) => {
                const hex = hexFor(char.colorScheme);
                return (
                  <button
                    key={char.id}
                    onClick={() => navigate(`/gm/characters/${char.id}`)}
                    className="card text-left flex flex-col gap-3 transition-all duration-150 w-full hover:scale-[1.02] cursor-pointer"
                  >
                    {/* Top row: color dot + name */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: hex, boxShadow: `0 0 6px ${hex}88` }}
                      />
                      <span
                        className="font-bold text-sm leading-tight truncate"
                        style={{ color: hex }}
                      >
                        {char.name}
                      </span>
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
                      <span className="text-gray-700 text-xs">View sheet →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
