import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../hooks/useApi';
import { useActiveCharacter } from '../../components/ActiveCharacterBanner';

const AP_MAX = 2;

interface Action {
  label: string;
  cost: 1 | 2;
  kind: 'navigate' | 'log';
  to?: string;
}

const ACTION_GROUPS: { title: string; actions: Action[] }[] = [
  {
    title: 'Commerce',
    actions: [
      { label: 'Shopping',            cost: 1, kind: 'navigate', to: '/player/shop' },
      { label: 'Trade Goods Buy/Sell', cost: 2, kind: 'navigate', to: '/player/trade' },
      { label: 'Black Market',        cost: 2, kind: 'navigate', to: '/player/black-market' },
    ],
  },
  {
    title: 'Ship Operations',
    actions: [
      { label: 'Ship System Maintenance', cost: 2, kind: 'log' },
      { label: 'Ship System Repair',      cost: 2, kind: 'log' },
    ],
  },
  {
    title: 'Ship Business',
    actions: [
      { label: 'Find Passengers', cost: 1, kind: 'log' },
      { label: 'Find Freight',    cost: 1, kind: 'log' },
    ],
  },
  {
    title: 'Other',
    actions: [
      { label: 'Skill Training',          cost: 2, kind: 'navigate', to: '/player/skills' },
      { label: 'Carouse',                 cost: 2, kind: 'log' },
      { label: 'Provide Medical Assistance',      cost: 1, kind: 'log' },
      { label: 'Asset Interaction',       cost: 1, kind: 'log' },
      { label: 'Other (GM Stipulated)',   cost: 1, kind: 'log' },
      { label: 'Other (GM Stipulated)',   cost: 2, kind: 'log' },
    ],
  },
];

export function ActionsPage() {
  const { player } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const { activeCharacter, loading: bannerLoading } = useActiveCharacter(player?.id ?? 0);

  const [ap, setAp] = useState<number | null>(null);
  const [apLoading, setApLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchAp = useCallback(async (charId: number) => {
    setApLoading(true);
    const res = await apiFetch<{ activity_points: number }>(`/api/characters/${charId}/activity-points`);
    if (res.success && res.data) setAp(res.data.activity_points);
    setApLoading(false);
  }, []);

  useEffect(() => {
    if (activeCharacter?.id) void fetchAp(activeCharacter.id);
  }, [activeCharacter?.id, fetchAp]);

  // Refetch AP when tab becomes visible (handles GM advancing the day in another tab)
  useEffect(() => {
    if (!activeCharacter?.id) return;
    const charId = activeCharacter.id;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchAp(charId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeCharacter?.id, fetchAp]);

  async function handleAction(action: Action) {
    if (!activeCharacter) return;
    const key = `${action.label}-${action.cost}`;
    setActing(key);

    const res = await apiFetch<{ activity_points: number }>(
      `/api/characters/${activeCharacter.id}/deduct-ap`,
      { method: 'POST', body: JSON.stringify({ cost: action.cost, actionLabel: action.label }) },
    );

    if (!res.success) {
      notify('error', res.error ?? 'Insufficient activity points');
      setActing(null);
      return;
    }

    setAp(res.data?.activity_points ?? null);
    setActing(null);

    if (action.kind === 'navigate' && action.to) {
      navigate(action.to);
    } else {
      notify('success', 'Action logged');
    }
  }

  if (bannerLoading || apLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading…</p>
      </div>
    );
  }

  if (!activeCharacter) {
    return (
      <div className="p-8 space-y-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Actions</p>
          <h1 className="text-2xl font-bold text-gray-100">Daily Actions</h1>
        </div>
        <div className="card text-center py-12">
          <p className="text-gray-400">No active character.</p>
        </div>
      </div>
    );
  }

  const current = ap ?? 0;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Actions</p>
        <h1 className="text-2xl font-bold text-gray-100">Daily Actions</h1>
      </div>

      {/* AP Counter */}
      <div className="card flex items-center gap-4 py-5">
        <span className="text-3xl">⚡</span>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Activity Points</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-bold tabular-nums ${current === 0 ? 'text-red-400' : 'text-nexus-300'}`}>
              {current}
            </span>
            <span className="text-xl text-gray-600">/ {AP_MAX}</span>
          </div>
        </div>
        <div className="ml-auto flex gap-1.5">
          {Array.from({ length: AP_MAX }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                i < current
                  ? 'bg-nexus-400 border-nexus-400'
                  : 'bg-transparent border-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action groups */}
      <div className="space-y-4">
        {ACTION_GROUPS.map((group) => (
          <div key={group.title} className="card space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest pb-1 border-b border-gray-800">
              {group.title}
            </h2>
            <div className="space-y-1.5">
              {group.actions.map((action, i) => {
                const key = `${action.label}-${action.cost}`;
                const disabled = current < action.cost;
                const busy = acting === key;
                return (
                  <button
                    key={i}
                    disabled={disabled || busy || acting !== null}
                    onClick={() => void handleAction(action)}
                    title={disabled ? 'Not enough activity points' : undefined}
                    className={[
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors',
                      disabled || acting !== null
                        ? 'border-gray-800 text-gray-700 cursor-not-allowed'
                        : 'border-gray-700 text-gray-200 hover:border-nexus-700 hover:bg-nexus-900/20 hover:text-nexus-200',
                    ].join(' ')}
                  >
                    <span>{busy ? '…' : action.label}</span>
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        disabled
                          ? 'text-gray-700 bg-gray-800/40'
                          : 'text-nexus-400 bg-nexus-900/40'
                      }`}
                    >
                      {action.cost}pt
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
