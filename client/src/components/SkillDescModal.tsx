import { useEffect } from 'react';
import skillsData from '../data/skills_data.json';

interface SkillSpeciality {
  name: string;
  description: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  specialities: SkillSpeciality[];
}

export function findSkillInfo(skillName: string): SkillInfo | null {
  const lower = skillName.toLowerCase();
  const exact = (skillsData as SkillInfo[]).find((s) => s.name.toLowerCase() === lower);
  if (exact) return exact;
  // Strip parenthetical speciality, e.g. "Animals (Handler)" → "Animals"
  const base = skillName.replace(/\s*\(.*?\)$/, '').trim().toLowerCase();
  return (skillsData as SkillInfo[]).find((s) => s.name.toLowerCase() === base) ?? null;
}

interface SkillDescModalProps {
  skillName: string;
  info: SkillInfo | null;
  onClose: () => void;
}

export function SkillDescModal({ skillName, info, onClose }: SkillDescModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: '#0f1623', border: '1px solid #2d3748' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0"
          style={{ backgroundColor: '#0f1623', borderColor: '#1f2937' }}
        >
          <h2 className="text-gray-100 font-semibold text-lg leading-tight">{skillName}</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors p-1 -mr-1 rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {info ? (
            <>
              <p className="text-gray-300 text-sm leading-relaxed">{info.description}</p>

              {info.specialities.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs text-gray-600 uppercase tracking-widest mb-3">Specialities</div>
                  <div className="space-y-3">
                    {info.specialities.map((spec) => (
                      <div key={spec.name} className="text-sm text-gray-400 leading-relaxed">
                        <span className="font-semibold text-gray-200">{spec.name}</span>
                        {' — '}
                        {spec.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-600 text-sm italic">No description available for this skill.</p>
          )}
        </div>
      </div>
    </div>
  );
}
