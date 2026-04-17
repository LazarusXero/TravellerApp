import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../hooks/useApi';
import { CHARACTER_COLORS, SKILL_CATEGORIES } from '../../constants/characters';
import { useActiveCharacter } from '../../components/ActiveCharacterBanner';
import { getSkillUpgradeCost } from '../../utils/characterUtils';
import { SkillDescModal, findSkillInfo } from '../../components/SkillDescModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CharacterSkill {
  skillName: string;
  level: number | null;
}

interface SkillTraining {
  skill_name: string;
  training_days_applied: number;
}

interface CharacterDetail {
  id: number;
  colorScheme: string;
  skill_points: number;
  actions_spent_day: number | null;
  character_skills: CharacterSkill[];
  skill_training?: SkillTraining[];
}

interface SkillState {
  level: number | null;
  training_days_applied: number;
}

interface GameData {
  day: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexFor(name: string): string {
  return CHARACTER_COLORS.find((c) => c.name === name)?.hex ?? '#4FC3F7';
}

function buildSkillMap(char: CharacterDetail): Record<string, SkillState> {
  const map: Record<string, SkillState> = {};
  for (const cs of char.character_skills) {
    map[cs.skillName] = { level: cs.level, training_days_applied: 0 };
  }
  for (const st of (char.skill_training ?? [])) {
    const existing = map[st.skill_name];
    if (existing) {
      map[st.skill_name] = { ...existing, training_days_applied: st.training_days_applied };
    } else {
      map[st.skill_name] = { level: null, training_days_applied: st.training_days_applied };
    }
  }
  return map;
}

// ── Skill Tile ────────────────────────────────────────────────────────────────

interface SkillTileProps {
  skillName: string;
  data: SkillState;
  hex: string;
  onClick: () => void;
  onInfoClick: () => void;
}

function SkillTile({ skillName, data, hex, onClick, onInfoClick }: SkillTileProps) {
  const [hovered, setHovered] = useState(false);
  const hasLevel = data.level !== null;
  const levelText = data.level === null ? '—' : String(data.level);

  return (
    <div
      className="relative rounded-lg w-full"
      style={{
        backgroundColor: hovered ? '#1f2937' : '#111827',
        border: `1px solid ${hovered ? hex + '60' : '#1f2937'}`,
        transition: 'background-color 150ms, border-color 150ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main action area */}
      <button
        onClick={onClick}
        className="text-left p-3 w-full transition-all duration-150 active:scale-[0.97] pr-7"
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

      {/* Info icon */}
      <button
        onClick={(e) => { e.stopPropagation(); onInfoClick(); }}
        aria-label={`Info for ${skillName}`}
        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded transition-colors"
        style={{ color: '#6b7280' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#d1d5db')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </div>
  );
}

// ── Skill Modal ───────────────────────────────────────────────────────────────

interface SkillModalProps {
  skillName: string;
  data: SkillState;
  skillPoints: number;
  upgradeCost: number;
  actionsSpentDay: boolean;
  hex: string;
  onSpendPoint: () => void;
  onTrainForDay: () => void;
  onClose: () => void;
}

function SkillModal({ skillName, data, skillPoints, upgradeCost, actionsSpentDay, hex, onSpendPoint, onTrainForDay, onClose }: SkillModalProps) {
  const canSpend = skillPoints >= upgradeCost;
  const canTrain = !actionsSpentDay;
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
              {upgradeCost} SP
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SkillsPage() {
  const { player } = useAuth();
  const { notify } = useApp();
  const { activeCharacter, loading: bannerLoading } = useActiveCharacter(player?.id ?? 0);

  const [char, setChar] = useState<CharacterDetail | null>(null);
  const [gameDay, setGameDay] = useState<number>(0);
  const [skills, setSkills] = useState<Record<string, SkillState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<'trained' | 'all'>('trained');
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(Object.keys(SKILL_CATEGORIES)));
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const [descSkill, setDescSkill] = useState<string | null>(null);
  const [descModalOpen, setDescModalOpen] = useState(false);

  function openDescModal(skillName: string) {
    setDescSkill(skillName);
    setDescModalOpen(true);
  }

  function closeDescModal() {
    setDescModalOpen(false);
    setDescSkill(null);
  }

  const fetchData = useCallback(async (charId: number) => {
    setLoading(true);
    try {
      const [charRes, gameRes] = await Promise.all([
        apiFetch<CharacterDetail>(`/api/characters/${charId}`),
        apiFetch<GameData>('/api/game'),
      ]);

      if (charRes.success && charRes.data) {
        setChar(charRes.data);
        setSkills(buildSkillMap(charRes.data));
        setError(null);
      } else {
        setError(charRes.error ?? 'Failed to load character');
      }

      if (gameRes.success && gameRes.data) {
        setGameDay(gameRes.data.day);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error loading skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeCharacter?.id) void fetchData(activeCharacter.id);
  }, [activeCharacter?.id, fetchData]);

  const hex = char ? hexFor(char.colorScheme) : '#4FC3F7';
  const actionsSpentDay = char !== null && char.actions_spent_day !== null && char.actions_spent_day === gameDay;

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
      const data = skills[name];
      const matchesView = view === 'all' || (data?.level !== null && data?.level !== undefined) || (data?.training_days_applied ?? 0) > 0;
      return matchesSearch && matchesView;
    });
  }

  async function handleSpendPoint() {
    if (!selectedSkill || !char) return;
    const curr = skills[selectedSkill] ?? { level: null, training_days_applied: 0 };
    const cost = getSkillUpgradeCost(curr.level);
    if (char.skill_points < cost) return;
    const newLevel = curr.level === null ? 0 : curr.level + 1;
    const newSP = char.skill_points - cost;

    setSkills((prev) => ({ ...prev, [selectedSkill]: { ...curr, level: newLevel } }));
    setChar((prev) => prev ? { ...prev, skill_points: newSP } : prev);

    await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ skills: [{ skillName: selectedSkill, level: newLevel }], skill_points: newSP }),
    });
  }

  async function handleTrainForDay() {
    if (!selectedSkill || !char || actionsSpentDay) return;
    const curr = skills[selectedSkill] ?? { level: null, training_days_applied: 0 };
    const skill = selectedSkill;

    // Optimistic update
    setSkills((prev) => ({ ...prev, [skill]: { ...curr, training_days_applied: curr.training_days_applied + 1 } }));
    setChar((prev) => prev ? { ...prev, actions_spent_day: gameDay } : prev);
    setSelectedSkill(null);

    const res = await apiFetch<{
      training_days_applied: number;
      skill_point_awarded: boolean;
      new_skill_points?: number;
    }>(`/api/characters/${char.id}/train-skill`, {
      method: 'POST',
      body: JSON.stringify({ skill_name: skill }),
    });

    if (!res.success) {
      // Roll back optimistic update
      setSkills((prev) => ({ ...prev, [skill]: curr }));
      setChar((prev) => prev ? { ...prev, actions_spent_day: char.actions_spent_day } : prev);
      return;
    }

    if (res.data?.skill_point_awarded) {
      // Reset training days to 0 and apply the awarded SP
      setSkills((prev) => ({ ...prev, [skill]: { ...curr, training_days_applied: 0 } }));
      if (res.data.new_skill_points !== undefined) {
        setChar((prev) => prev ? { ...prev, skill_points: res.data!.new_skill_points! } : prev);
      }
      notify('success', `30 days of ${skill} training complete — +1 Skill Point awarded!`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (bannerLoading || loading) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: '#0a0e1a' }}>
        <div className="text-gray-600 text-sm">Loading skills…</div>
      </div>
    );
  }

  if (error || !char) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: '#0a0e1a' }}>
        <div className="text-red-500 text-sm">{error ?? 'No character loaded'}</div>
      </div>
    );
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
        {actionsSpentDay && (
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
                      onInfoClick={() => openDescModal(skillName)}
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
          skillPoints={char.skill_points}
          upgradeCost={getSkillUpgradeCost((skills[selectedSkill] ?? { level: null }).level)}
          actionsSpentDay={actionsSpentDay}
          hex={hex}
          onSpendPoint={() => void handleSpendPoint()}
          onTrainForDay={() => void handleTrainForDay()}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      {/* ── Skill Description Modal ─────────────────────────────────────────── */}
      {descModalOpen && descSkill && (
        <SkillDescModal
          skillName={descSkill}
          info={findSkillInfo(descSkill)}
          onClose={closeDescModal}
        />
      )}
    </div>
  );
}
