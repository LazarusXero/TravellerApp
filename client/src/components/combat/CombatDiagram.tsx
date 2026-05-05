const BANDS = ['ADJACENT', 'CLOSE', 'SHORT', 'MEDIUM', 'LONG', 'VERY LONG', 'DISTANT'] as const;
type Band = (typeof BANDS)[number];

export interface DiagramRange {
  id: number;
  from_object_id: number;
  to_object_id: number;
  band: string;
}

export interface DiagramObject {
  id: number;
  name: string;
  object_type: string;
  is_player_ship: boolean;
  is_destroyed: boolean;
  move_intent: string | null;
  move_target_id: number | null;
  missile_quantity: number | null;
  rounds_to_contact: number | null;
}

interface CombatDiagramProps {
  referenceObjectId: number;
  objects: DiagramObject[];
  ranges: DiagramRange[];
}

function getBand(
  objectId: number,
  referenceId: number,
  ranges: DiagramRange[],
): string | null {
  const a = Math.min(objectId, referenceId);
  const b = Math.max(objectId, referenceId);
  return ranges.find((r) => r.from_object_id === a && r.to_object_id === b)?.band ?? null;
}

function getArrow(obj: DiagramObject, referenceId: number): string {
  if (!obj.move_intent || obj.move_intent === 'HOLD') return '';
  const targetIsRef = obj.move_target_id === referenceId;
  if (targetIsRef && obj.move_intent === 'CLOSE') return '←';
  if (targetIsRef && obj.move_intent === 'FLEE') return '>>';
  if (!targetIsRef && obj.move_intent === 'CLOSE') return '>';
  if (!targetIsRef && obj.move_intent === 'FLEE') return '←';
  return '';
}

export function CombatDiagram({ referenceObjectId, objects, ranges }: CombatDiagramProps) {
  const reference = objects.find((o) => o.id === referenceObjectId);
  if (!reference) {
    return (
      <div className="text-center py-8 text-gray-700 text-sm">
        No player ship found. Add a ship with "Is Player Ship" enabled to display the combat diagram.
      </div>
    );
  }

  const nonReference = objects.filter((o) => o.id !== referenceObjectId);

  const buckets: Record<Band, DiagramObject[]> = {
    ADJACENT: [], CLOSE: [], SHORT: [], MEDIUM: [],
    LONG: [], 'VERY LONG': [], DISTANT: [],
  };
  const unranged: DiagramObject[] = [];

  for (const obj of nonReference) {
    const band = getBand(obj.id, referenceObjectId, ranges);
    if (band && band in buckets) {
      buckets[band as Band].push(obj);
    } else {
      unranged.push(obj);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Header */}
          <div className="grid grid-cols-8 gap-1 mb-1">
            <div className="flex items-center justify-center px-2 py-2 rounded bg-nexus-900/40 border border-nexus-700/50 min-h-[40px]">
              <span className="text-nexus-400 text-xs font-semibold text-center leading-tight truncate">
                {reference.name}
              </span>
            </div>
            {BANDS.map((band) => (
              <div
                key={band}
                className="px-1 py-2 rounded bg-gray-900 border border-gray-800 text-center"
              >
                <span className="text-gray-500 text-xs">
                  {band === 'VERY LONG' ? 'V.LONG' : band}
                </span>
              </div>
            ))}
          </div>

          {/* Content row */}
          <div className="grid grid-cols-8 gap-1">
            {/* Reference column */}
            <div className="flex items-start justify-center px-2 py-2 rounded bg-nexus-900/20 border border-nexus-800/30 min-h-[60px]">
              <span className="text-nexus-300 text-sm mt-1">★</span>
            </div>

            {/* Band columns */}
            {BANDS.map((band) => (
              <div
                key={band}
                className="px-1.5 py-1.5 rounded bg-gray-900/50 border border-gray-800/50 min-h-[60px] space-y-1"
              >
                {buckets[band].map((obj) => {
                  const arrow = getArrow(obj, referenceObjectId);
                  return (
                    <div
                      key={obj.id}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-xs ${
                        obj.is_destroyed ? 'opacity-40' : ''
                      }`}
                    >
                      <span
                        className={`flex-1 truncate ${
                          obj.object_type === 'MISSILE_SALVO'
                            ? 'text-amber-400'
                            : obj.object_type === 'PLANET'
                              ? 'text-blue-400'
                              : 'text-gray-300'
                        }`}
                      >
                        {obj.object_type === 'MISSILE_SALVO' ? '⬡' : '◆'} {obj.name}
                      </span>
                      {arrow && (
                        <span className="text-amber-400 font-mono shrink-0 text-xs">{arrow}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Unranged overflow */}
          {unranged.length > 0 && (
            <div className="mt-1 px-2 py-1.5 rounded bg-gray-900/30 border border-dashed border-gray-800 text-xs text-gray-600">
              No range data:{' '}
              {unranged.map((o) => o.name).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      {nonReference.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-gray-800">
          {nonReference.map((obj) => {
            const band = getBand(obj.id, referenceObjectId, ranges);
            const notes: string[] = [];
            if (obj.object_type === 'MISSILE_SALVO') notes.push('Missile salvo');
            if (obj.rounds_to_contact != null && obj.rounds_to_contact > 0)
              notes.push(`Rounds to contact: ${obj.rounds_to_contact}`);
            if (obj.is_destroyed) notes.push('Destroyed');
            return (
              <div key={obj.id} className="flex items-center gap-3 text-xs text-gray-600">
                <span className="text-gray-400 font-medium w-40 truncate">{obj.name}</span>
                <span className="text-gray-700 w-24">
                  {obj.object_type.replace('_', ' ')}
                </span>
                {band && <span className="text-gray-700">{band}</span>}
                {notes.map((n) => (
                  <span key={n} className="text-gray-600 italic">
                    {n}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
