import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../hooks/useApi';

export interface World {
  id: number;
  name: string;
  hex_code: string;
  port_type: string;
  size: string;
  atmosphere: string;
  hydrographics: string;
  population: string;
  government: string;
  law: string;
  technology: string;
  trade_codes: string | null;
  allegiance: string | null;
  port_attitude: string | null;
  naval_base: boolean;
  key_system: boolean;
  secure_world: boolean;
  dangerous_world: boolean;
  is_hidden: boolean;
  is_aslan_port: boolean;
  total_donations_cr: number;
  sector: string | null;
  subsector: string | null;
  notes: string | null;
}

interface Props {
  world: World;
  gmMode: boolean;
  onClose: () => void;
  onUpdate: (updated: Partial<World>) => void;
}

const ATTITUDE_FENCE: Record<string, number> = {
  Haven: 30,
  Friendly: 25,
  Tolerant: 20,
  Neutral: 10,
  Suspicious: 10,
  Unfriendly: 0,
  Hostile: 0,
};

const PORT_LABELS: Record<string, string> = {
  A: 'Class A — Excellent',
  B: 'Class B — Good',
  C: 'Class C — Routine',
  D: 'Class D — Poor',
  E: 'Class E — Frontier',
  X: 'Class X — No Port',
};

const ATM_LABELS: Record<string, string> = {
  '0': 'None',
  '1': 'Trace',
  '2': 'Very Thin (tainted)',
  '3': 'Very Thin',
  '4': 'Thin (tainted)',
  '5': 'Thin',
  '6': 'Standard',
  '7': 'Standard (tainted)',
  '8': 'Dense',
  '9': 'Dense (tainted)',
  A: 'Exotic',
  B: 'Corrosive',
  C: 'Insidious',
  D: 'Dense (high)',
  E: 'Thin (low)',
  F: 'Unusual',
};

const HYDRO_LABELS: Record<string, string> = {
  '0': 'Desert (0–5%)',
  '1': '6–15%',
  '2': '16–25%',
  '3': '26–35%',
  '4': '36–45%',
  '5': '46–55%',
  '6': '56–65%',
  '7': '66–75%',
  '8': '76–85%',
  '9': '86–95%',
  A: 'Water World (96–100%)',
};

const GOV_LABELS: Record<string, string> = {
  '0': 'None',
  '1': 'Company/Corp',
  '2': 'Participating Democracy',
  '3': 'Self-Perpetuating Oligarchy',
  '4': 'Representative Democracy',
  '5': 'Feudal Technocracy',
  '6': 'Captive Government',
  '7': 'Balkanization',
  '8': 'Civil Service Bureaucracy',
  '9': 'Impersonal Bureaucracy',
  A: 'Charismatic Dictator',
  B: 'Non-Charismatic Leader',
  C: 'Charismatic Oligarchy',
  D: 'Religious Dictatorship',
  E: 'Religious Autocracy',
  F: 'Totalitarian Oligarchy',
};

function UwpRow({ label, code, detail }: { label: string; code: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <div className="text-right">
        <span className="font-mono text-gray-200 text-sm">{code}</span>
        {detail && <span className="text-gray-500 text-xs ml-2">— {detail}</span>}
      </div>
    </div>
  );
}

export function WorldModal({ world, gmMode, onClose, onUpdate }: Props) {
  const [notes, setNotes] = useState(world.notes ?? '');
  const [saving, setSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const saveNotes = async () => {
    if (!gmMode || notes === (world.notes ?? '')) return;
    setSaving(true);
    const res = await apiFetch(`/api/worlds/${world.id}`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    if (res.success) onUpdate({ notes });
  };

  const uwp = `${world.port_type}${world.size}${world.atmosphere}${world.hydrographics}${world.population}${world.government}${world.law}-${world.technology}`;
  const fence = world.port_attitude ? (ATTITUDE_FENCE[world.port_attitude] ?? null) : null;
  const jumpMapUrl = `https://travellermap.com/api/jumpmap?sector=Trojan%20Reach&hex=${world.hex_code}&jump=2&style=poster&scale=48`;

  const flags = [
    world.naval_base && 'Naval Base',
    world.key_system && 'Key System',
    world.secure_world && 'Secure World',
    world.dangerous_world && 'Dangerous',
    world.is_aslan_port && 'Aslan Port',
  ].filter(Boolean) as string[];

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <p className="text-gray-500 text-xs font-mono mb-0.5">{world.hex_code} · {world.sector ?? ''}{world.subsector ? ` / ${world.subsector}` : ''}</p>
            <h2 className="text-xl font-bold text-gray-100">{world.name}</h2>
            <p className="font-mono text-nexus-400 text-sm mt-0.5 tracking-widest">{uwp}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 text-xl leading-none mt-1 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* UWP Breakdown */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">UWP Breakdown</h3>
            <div className="bg-gray-800/50 rounded-lg px-4 py-2">
              <UwpRow label="Starport" code={world.port_type} detail={PORT_LABELS[world.port_type]} />
              <UwpRow label="Size" code={world.size} />
              <UwpRow label="Atmosphere" code={world.atmosphere} detail={ATM_LABELS[world.atmosphere]} />
              <UwpRow label="Hydrographics" code={world.hydrographics} detail={HYDRO_LABELS[world.hydrographics]} />
              <UwpRow label="Population" code={world.population} />
              <UwpRow label="Government" code={world.government} detail={GOV_LABELS[world.government]} />
              <UwpRow label="Law Level" code={world.law} />
              <UwpRow label="Tech Level" code={world.technology} />
            </div>
          </section>

          {/* Trade Codes + Flags */}
          {(world.trade_codes || flags.length > 0) && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Codes &amp; Flags</h3>
              <div className="flex flex-wrap gap-2">
                {world.trade_codes?.split(/\s+/).filter(Boolean).map((tc) => (
                  <span key={tc} className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 text-xs font-mono">{tc}</span>
                ))}
                {flags.map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded bg-nexus-900/60 border border-nexus-800 text-nexus-300 text-xs">{f}</span>
                ))}
              </div>
            </section>
          )}

          {/* Allegiance + Attitude */}
          {(world.allegiance || world.port_attitude) && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Allegiance &amp; Attitude</h3>
              <div className="grid grid-cols-2 gap-4">
                {world.allegiance && (
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Allegiance</p>
                    <p className="text-gray-200 text-sm font-medium">{world.allegiance}</p>
                  </div>
                )}
                {world.port_attitude && (
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Port Attitude</p>
                    <p className="text-gray-200 text-sm font-medium">{world.port_attitude}</p>
                    {fence != null && (
                      <p className="text-gray-500 text-xs mt-1">Fence: {fence}%</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Jump Map */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Jump-2 Map</h3>
            <div className="rounded-lg overflow-hidden border border-gray-800 bg-gray-950 flex items-center justify-center min-h-[120px]">
              <img
                src={jumpMapUrl}
                alt={`Jump-2 map for ${world.name}`}
                className="max-w-full"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </section>

          {/* GM Notes */}
          {gmMode ? (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">GM Notes</h3>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-nexus-600 focus:border-nexus-600"
                rows={4}
                placeholder="Private notes visible only to the GM…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => void saveNotes()}
              />
              {saving && <p className="text-xs text-gray-600 mt-1">Saving…</p>}
            </section>
          ) : world.notes ? (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Notes</h3>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{world.notes}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
