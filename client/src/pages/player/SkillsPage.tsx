import { useState } from 'react';
import { CHARACTER_COLORS, SKILL_CATEGORIES } from '../../constants/characters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillState {
  level: number | null;           // CharacterSkill.level
  training_days_applied: number;  // SkillTraining.training_days_applied
}

interface CharState {
  colorScheme: string;            // Character.colorScheme
  skill_points: number;           // Character.skill_points
  actions_spent_day: boolean;     // true if Character.actions_spent_day is non-null
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_SKILLS: Record<string, SkillState> = {
  'Pilot (Spacecraft)':         { level: 2, training_days_applied: 14 },
  'Pilot (Small Craft)':        { level: 0, training_days_applied: 3  },
  'Astrogation':                { level: 1, training_days_applied: 8  },
  'Vacc Suit':                  { level: 1, training_days_applied: 6  },
  'Engineer (M-Drive)':         { level: 0, training_days_applied: 2  },
  'Gun Combat (Energy)':        { level: 1, training_days_applied: 5  },
  'Melee (Blade)':              { level: 0, training_days_applied: 3  },
  'Electronics (Computers)':    { level: 1, training_days_applied: 3  },
  'Electronics (Sensors)':      { level: 0, training_days_applied: 2  },
  'Mechanic':                   { level: 2, training_days_applied: 11 },
  'Medic':                      { level: 0, training_days_applied: 1  },
  'Navigation':                 { level: 0, training_days_applied: 2  },
  'Carouse':                    { level: 1, training_days_applied: 4  },
  'Persuade':                   { level: 1, training_days_applied: 3  },
  'Streetwise':                 { level: 0, training_days_applied: 1  },
  'Stealth':                    { level: 0, training_days_applied: 2  },
  'Recon':                      { level: 0, training_days_applied: 1  },
};

const INITIAL_CHAR: CharState = {
  colorScheme:      'Jedi Blue',
  skill_points:     3,
  actions_spent_day: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexFor(name: string): string {
  return CHARACTER_COLORS.find((c) => c.name === name)?.hex ?? '#4FC3F7';
}

// ── Skill Tile ────────────────────────────────────────────────────────────────

interface SkillTileProps {
  skillName: string;
  data: SkillState;
  hex: string;
  onClick: () => void;
}

function SkillTile({ skillName, data, hex, onClick }: SkillTileProps) {
  const [hovered, setHovered] = useState(false);
  const hasLevel = data.level !== null;
  const levelText = data.level === null ? '—' : String(data.level);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-left rounded-lg p-3 w-full transition-all duration-150 active:scale-[0.97]"
      style={{
        backgroundColor: hovered ? '#1f2937' : '#111827',
        border: `1px solid ${hovered ? hex + '60' : '#1f2937'}`,
      }}
    >
      <div className="text-gray-200 text-sm font-medium leading-tight truncate mb-2">
        {skillName}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-xs font-bold font-mono px-1.5 py-0.5 rounded shrink-0"
          style={{
            color: hasLevel ? hex : '#6b7280',
            backgroundColor: hasLevel ? hex + '22' : '#1f2937',
            border: `1px solid ${hasLevel ? hex + '44' : '#374151'}`,
          }}
        >
          Lv {levelText}
        </span>
        <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: data.training_days_applied > 0 ? hex + 'aa' : '#4b5563' }}>
          ◷ {data.training_days_applied}d
        </span>
      </div>
    </button>
  );
}

// ── Skill Modal ───────────────────────────────────────────────────────────────

interface SkillModalProps {
  skillName: string;
  data: SkillState;
  char: CharState;
  hex: string;
  onSpendPoint: () => void;
  onTrainForDay: () => void;
  onClose: () => void;
}

function SkillModal({ skillName, data, char, hex, onSpendPoint, onTrainForDay, onClose }: SkillModalProps) {
  const canSpend = char.skill_points > 0;
  const canTrain = !char.actions_spent_day;
  const levelLabel = data.level === null ? 'Untrained' : `Level ${data.level}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{
          backgroundColor: '#0f1623',
          border: `1px solid ${hex}35`,
          boxShadow: `0 0 40px ${hex}15`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-gray-100 font-semibold text-base leading-tight">{skillName}</h2>
            <p className="text-xs mt-0.5 font-mono" style={{ color: hex }}>{levelLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors p-1 -mr-1 -mt-1 rounded"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: '#1a2236' }}>
            <div className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Level</div>
            <div className="font-mono font-bold text-sm" style={{ color: data.level !== null ? hex : '#4b5563' }}>
              {data.level !== null ? data.level : '—'}
            </div>
          </div>
          <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: '#1a2236' }}>
            <div className="text-xs text-gray-600 uppercase tracking-wider mb-0.5">Days Trained</div>
            <div className="font-mono font-bold text-sm text-gray-300">{data.training_days_applied}</div>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-4 text-xs text-gray-600 uppercase tracking-widest">Choose Action</div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Spend Points */}
          <button
            onClick={() => { onSpendPoint(); onClose(); }}
            disabled={!canSpend}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed"
            style={canSpend ? {
              backgroundColor: hex + '18',
              border: `1px solid ${hex}55`,
              color: hex,
            } : {
              backgroundColor: '#111827',
              border: '1px solid #1f2937',
              color: '#4b5563',
            }}
          >
            <span className="flex items-center gap-2">
              <span>⬆</span>
              <span>Spend Points</span>
            </span>
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
              style={canSpend ? {
                backgroundColor: hex + '28',
                color: hex,
              } : {
                backgroundColor: '#1f2937',
                color: '#374151',
              }}
            >
              {char.skill_points} SP
            </span>
          </button>

          {/* Train for Day */}
          <button
            onClick={() => { onTrainForDay(); }}
            disabled={!canTrain}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed"
            style={canTrain ? {
              backgroundColor: '#1a2236',
              border: '1px solid #2d3748',
              color: '#e2e8f0',
            } : {
              backgroundColor: '#0f1623',
              border: '1px solid #1a2236',
              color: '#374151',
            }}
          >
            <span className="flex items-center gap-2">
              <span>◷</span>
              <span>Train for the Day</span>
            </span>
            {!canTrain && (
              <span className="text-xs text-gray-700">Already used</span>
            )}
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-xs text-gray-700 hover:text-gray-500 transition-colors uppercase tracking-widest"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Demo Controls Panel ───────────────────────────────────────────────────────

interface DemoPanelProps {
  char: CharState;
  hex: string;
  onChange: (updates: Partial<CharState>) => void;
}

function DemoPanel({ char, hex, onChange }: DemoPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          className="rounded-xl p-4 shadow-2xl w-60"
          style={{ backgroundColor: '#0f1623', border: '1px solid #1f2937' }}
        >
          <div className="text-xs text-gray-600 uppercase tracking-widest mb-3 font-semibold">Demo Controls</div>
          <div className="space-y-3">
            {/* Color scheme picker */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Color Scheme</label>
              <select
                value={char.colorScheme}
                onChange={(e) => onChange({ colorScheme: e.target.value })}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg text-gray-200 text-xs px-2 py-1.5 focus:outline-none"
              >
                {CHARACTER_COLORS.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Daily action toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => onChange({ actions_spent_day: !char.actions_spent_day })}
                className="w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer shrink-0"
                style={{ backgroundColor: char.actions_spent_day ? hex + '80' : '#374151' }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-gray-200 transition-transform duration-200 shadow"
                  style={{ transform: char.actions_spent_day ? 'translateX(1.25rem)' : 'translateX(0.125rem)' }}
                />
              </div>
              <span className="text-xs text-gray-400">Daily action used</span>
            </label>

            {/* Skill points stepper */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Skill Points</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onChange({ skill_points: Math.max(0, char.skill_points - 1) })}
                  className="w-7 h-7 rounded-md border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base transition-colors flex items-center justify-center"
                >−</button>
                <span className="font-mono text-sm text-gray-200 min-w-[2rem] text-center">{char.skill_points}</span>
                <button
                  onClick={() => onChange({ skill_points: char.skill_points + 1 })}
                  className="w-7 h-7 rounded-md border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base transition-colors flex items-center justify-center"
                >+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shadow-lg transition-all duration-150 border"
        style={{
          backgroundColor: open ? hex + '20' : '#0f1623',
          borderColor: open ? hex + '50' : '#1f2937',
          color: open ? hex : '#6b7280',
        }}
      >
        <span>⚙</span> Demo
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SkillsPage() {
  const [char, setChar] = useState<CharState>(INITIAL_CHAR);
  const [skills, setSkills] = useState<Record<string, SkillState>>(INITIAL_SKILLS);
  const [view, setView] = useState<'trained' | 'all'>('trained');
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(Object.keys(SKILL_CATEGORIES)));
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const hex = hexFor(char.colorScheme);

  function toggleCat(cat: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function visibleSkills(catSkills: string[]): string[] {
    const q = search.toLowerCase();
    return catSkills.filter((name) => {
      const matchesSearch = q === '' || name.toLowerCase().includes(q);
      const matchesView = view === 'all' || (skills[name]?.training_days_applied ?? 0) > 0;
      return matchesSearch && matchesView;
    });
  }

  function handleSpendPoint() {
    if (!selectedSkill || char.skill_points <= 0) return;
    setSkills((prev) => {
      const curr = prev[selectedSkill] ?? { level: null, training_days_applied: 0 };
      return { ...prev, [selectedSkill]: { ...curr, level: curr.level === null ? 0 : curr.level + 1 } };
    });
    setChar((prev) => ({ ...prev, skill_points: prev.skill_points - 1 }));
  }

  function handleTrainForDay() {
    if (!selectedSkill || char.actions_spent_day) return;
    setSkills((prev) => {
      const curr = prev[selectedSkill] ?? { level: null, training_days_applied: 0 };
      return { ...prev, [selectedSkill]: { ...curr, training_days_applied: curr.training_days_applied + 1 } };
    });
    setChar((prev) => ({ ...prev, actions_spent_day: true }));
    setSelectedSkill(null);
  }

  const hasAnyVisible = Object.values(SKILL_CATEGORIES).some((s) => visibleSkills(s).length > 0);

  return (
    <div className="min-h-full pb-20" style={{ backgroundColor: '#0a0e1a', color: '#f9fafb' }}>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div
        className="px-5 py-4 border-b sticky top-0 z-10"
        style={{ borderColor: hex + '28', backgroundColor: '#0c1220', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-bold tracking-widest uppercase" style={{ color: hex }}>
              Skills
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">Training & Progression</p>
          </div>

          {/* Skill Points Badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0"
            style={{
              backgroundColor: hex + '14',
              border: `1px solid ${hex}45`,
              color: hex,
              boxShadow: `0 0 12px ${hex}18`,
            }}
          >
            <span className="text-base leading-none">⬡</span>
            <span className="font-mono font-bold">{char.skill_points}</span>
            <span className="text-xs opacity-60">SP</span>
          </div>
        </div>

        {/* Daily action status */}
        {char.actions_spent_day && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <span>◉</span>
            <span>Daily training action already used</span>
          </div>
        )}
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-gray-900">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm select-none">⌕</span>
          <input
            type="text"
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-700 focus:outline-none transition-colors"
            style={{
              backgroundColor: '#111827',
              border: `1px solid ${search ? hex + '50' : '#1f2937'}`,
            }}
            onFocus={(e) => (e.target.style.borderColor = hex + '60')}
            onBlur={(e) => (e.target.style.borderColor = search ? hex + '50' : '#1f2937')}
          />
        </div>

        {/* View toggle */}
        <div
          className="flex rounded-lg p-0.5 shrink-0"
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          {(['trained', 'all'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
              style={view === v ? {
                backgroundColor: hex + '22',
                color: hex,
                boxShadow: `0 0 8px ${hex}25`,
              } : {
                color: '#6b7280',
              }}
            >
              {v === 'trained' ? 'Trained Only' : 'All Skills'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category List ───────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-2">
        {!hasAnyVisible && (
          <div className="text-center py-16 text-gray-700 text-sm">
            {search
              ? `No skills match "${search}"`
              : 'No trained skills yet. Switch to "All Skills" to browse.'}
          </div>
        )}

        {Object.entries(SKILL_CATEGORIES).map(([cat, catSkills]) => {
          const visible = visibleSkills(catSkills);
          if (visible.length === 0) return null;
          const isOpen = openCats.has(cat);

          return (
            <div
              key={cat}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid #1a2236' }}
            >
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-900/60"
                style={{ backgroundColor: '#0f1623' }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-gray-300 text-xs font-bold tracking-widest uppercase">{cat}</span>
                  <span
                    className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ color: hex + 'bb', backgroundColor: hex + '14' }}
                  >
                    {visible.length}
                  </span>
                </div>
                <span
                  className="text-gray-600 text-xs transition-transform duration-200"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}
                >
                  ▸
                </span>
              </button>

              {/* Skill tile grid */}
              {isOpen && (
                <div
                  className="p-3 grid gap-2"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                    backgroundColor: '#0a0e1a',
                  }}
                >
                  {visible.map((skillName) => (
                    <SkillTile
                      key={skillName}
                      skillName={skillName}
                      data={skills[skillName] ?? { level: null, training_days_applied: 0 }}
                      hex={hex}
                      onClick={() => setSelectedSkill(skillName)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Skill Action Modal ──────────────────────────────────────────────── */}
      {selectedSkill && (
        <SkillModal
          skillName={selectedSkill}
          data={skills[selectedSkill] ?? { level: null, training_days_applied: 0 }}
          char={char}
          hex={hex}
          onSpendPoint={handleSpendPoint}
          onTrainForDay={handleTrainForDay}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      {/* ── Demo Controls ──────────────────────────────────────────────────── */}
      <DemoPanel
        char={char}
        hex={hex}
        onChange={(updates) => setChar((prev) => ({ ...prev, ...updates }))}
      />
    </div>
  );
}
