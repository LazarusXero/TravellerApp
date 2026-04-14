interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
  accent?: boolean;
}

export function StatCard({ label, value, icon, trend, accent }: StatCardProps) {
  return (
    <div
      className={`card flex items-start gap-4 ${
        accent ? 'border-nexus-800 bg-nexus-950/40' : ''
      }`}
    >
      <div
        className={`p-2.5 rounded-lg text-lg leading-none ${
          accent ? 'bg-nexus-800/50 text-nexus-300' : 'bg-gray-800 text-gray-300'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-100 leading-none">{value}</p>
        {trend && <p className="text-gray-500 text-xs mt-1">{trend}</p>}
      </div>
    </div>
  );
}
