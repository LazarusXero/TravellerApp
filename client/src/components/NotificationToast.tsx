import { useApp } from '../context/AppContext';

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
} as const;

const STYLES = {
  success: 'bg-emerald-900 border-emerald-700 text-emerald-100',
  error: 'bg-red-900 border-red-700 text-red-100',
  info: 'bg-nexus-900 border-nexus-700 text-nexus-100',
  warning: 'bg-amber-900 border-amber-700 text-amber-100',
} as const;

export function NotificationToast() {
  const { notifications, dismiss } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 p-3 rounded-lg border text-sm shadow-lg ${STYLES[n.type]}`}
        >
          <span className="font-bold shrink-0">{ICONS[n.type]}</span>
          <span className="flex-1">{n.message}</span>
          <button
            onClick={() => dismiss(n.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
