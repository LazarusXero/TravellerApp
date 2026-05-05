import type { GunnerObject, BoardingAction } from './GunnerWeaponPanel';

export function ShipStatusPanel({
  ship,
  boarding,
}: {
  ship: GunnerObject;
  boarding?: BoardingAction | null;
}) {
  const activeHits = (ship.system_hits ?? []).filter((h) => !h.repaired);
  const lsTimer = ship.life_support_timer;
  const lsStatus = ship.life_support_status;
  const hasBoarding =
    boarding != null &&
    (boarding.attacker_object_id === ship.id || boarding.defender_object_id === ship.id);

  return (
    <div className="card space-y-4">
      <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Ship Status</h2>

      {/* Core stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Hull</p>
          <p className="text-gray-100 font-mono font-bold text-lg">
            {ship.hull_current ?? '—'}/{ship.hull_max ?? '—'}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Thrust</p>
          <p className="text-gray-100 font-mono font-bold text-lg">
            {ship.current_thrust ?? '—'}/{ship.adjusted_max_thrust ?? '—'}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Sensor Lock</p>
          <p
            className={`font-bold text-sm mt-1 ${
              ship.sensor_lock_status === 'SENSOR LOCKED' ? 'text-amber-400' : 'text-gray-500'
            }`}
          >
            {ship.sensor_lock_status === 'SENSOR LOCKED' ? 'LOCKED' : 'Clear'}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Armor</p>
          <p className="text-gray-100 font-mono font-bold text-lg">{ship.current_armor ?? '—'}</p>
        </div>
      </div>

      {/* Life support */}
      {lsStatus && lsStatus !== 'Operational' && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
            lsStatus === 'Failed'
              ? 'bg-red-900/30 border-red-700/50'
              : 'bg-amber-900/20 border-amber-700/40'
          }`}
        >
          <span className="text-xl">⚠</span>
          <div>
            <p
              className={`font-semibold text-sm ${
                lsStatus === 'Failed' ? 'text-red-300' : 'text-amber-300'
              }`}
            >
              Life Support: {lsStatus}
            </p>
            {lsTimer != null && (
              <p className="text-red-400 font-mono text-xs mt-0.5">
                {lsTimer} round{lsTimer !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        </div>
      )}

      {/* Active system hits */}
      {activeHits.length > 0 && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Critical Damage</p>
          <div className="space-y-1.5">
            {activeHits.map((hit) => (
              <div
                key={hit.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-900 rounded-lg"
              >
                <span className="text-gray-300 text-sm">{hit.system_name}</span>
                <span className="font-mono text-xs text-red-400">
                  Sev {hit.severity}/{hit.max_severity}
                  {hit.beyond_repair && ' · Beyond Repair'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boarding status */}
      {hasBoarding && boarding && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50">
          <span className="text-xl mt-0.5">⚔</span>
          <div className="space-y-1">
            <p className="text-red-300 font-semibold text-sm">
              Boarding action in progress — {boarding.phase === 'PACIFICATION' ? 'Pacification' : 'Resolution'}
            </p>
            {boarding.phase === 'RESOLUTION' && boarding.rounds_remaining != null && (
              <p className="text-red-400 text-xs">
                Next resolution in {boarding.rounds_remaining} round{boarding.rounds_remaining !== 1 ? 's' : ''}
              </p>
            )}
            {boarding.phase === 'PACIFICATION' && (
              <>
                {boarding.pacification_timer != null && (
                  <p className="text-red-400 text-xs">
                    Rounds to secure: {boarding.pacification_timer}
                  </p>
                )}
                {boarding.pacification_paused && (
                  <p className="text-amber-400 text-xs font-medium">⚠ Paused — return to Adjacent range</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeHits.length === 0 && !hasBoarding && (!lsStatus || lsStatus === 'Operational') && (
        <p className="text-gray-700 text-xs">No critical damage — ship is nominal.</p>
      )}
    </div>
  );
}
