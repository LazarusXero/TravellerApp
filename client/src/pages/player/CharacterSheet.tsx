import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../hooks/useApi';
import { getStatDM, getSkillDM } from '../../utils/characterUtils';
import { CHARACTER_COLORS, SKILL_LIST, SKILL_CATEGORIES } from '../../constants/characters';
import { useActiveCharacter } from '../../components/ActiveCharacterBanner';
import { SkillDescModal, findSkillInfo } from '../../components/SkillDescModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CharacterSkill {
  id: number;
  characterId: number;
  skillName: string;
  level: number | null;
}

interface CharacterDetail {
  id: number;
  player_id: number;
  name: string;
  species: string | null;
  age: number | null;
  gender: string | null;
  homeworld: string | null;
  background: string | null;
  notes: string | null;
  portrait_url: string | null;
  colorScheme: string;
  isActive: boolean;
  status: string;
  str: number;
  dex: number;
  end: number;
  int: number;
  edu: number;
  soc: number;
  credits: number;
  skill_points: number;
  character_skills: CharacterSkill[];
}

type StatKey = 'str' | 'dex' | 'end' | 'int' | 'edu' | 'soc';
type SkillName = (typeof SKILL_LIST)[number];

const STAT_DEFS: { key: StatKey; label: string }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'end', label: 'END' },
  { key: 'int', label: 'INT' },
  { key: 'edu', label: 'EDU' },
  { key: 'soc', label: 'SOC' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexFor(colorScheme: string): string {
  return CHARACTER_COLORS.find((c) => c.name === colorScheme)?.hex ?? '#4FC3F7';
}

function DmBadge({ dm, hex }: { dm: string; hex: string }) {
  return (
    <span
      className="inline-block text-xs font-bold font-mono px-1.5 py-0.5 rounded min-w-[2.5rem] text-center"
      style={{ color: hex, backgroundColor: hex + '22', border: `1px solid ${hex}44` }}
    >
      {dm}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CharacterSheet() {
  const { player } = useAuth();
  const { activeCharacter, loading: bannerLoading } = useActiveCharacter(player?.id ?? 0);

  const [char, setChar] = useState<CharacterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Skill state (local map for immediate UI updates)
  const [skillMap, setSkillMap] = useState<Map<string, number | null>>(new Map());
  const [savingSkills, setSavingSkills] = useState<Set<string>>(new Set());

  // Stat inline editing
  const [editingStat, setEditingStat] = useState<StatKey | null>(null);
  const [statDraft, setStatDraft] = useState('');

  // Credits / skill points inline editing
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditsDraft, setCreditsDraft] = useState('');
  const [editingSkillPoints, setEditingSkillPoints] = useState(false);
  const [spDraft, setSpDraft] = useState('');

  // Activity Points (display only)
  const [apPoints, setApPoints] = useState<number | null>(null);

  // Background / notes
  const [bgOpen, setBgOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingBg, setEditingBg] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [bgDraft, setBgDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savingText, setSavingText] = useState(false);

  // Skills panel
  const [skillView, setSkillView] = useState<'trained' | 'all'>('trained');
  const [skillSearch, setSkillSearch] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  // Skill description modal
  const [descSkill, setDescSkill] = useState<string | null>(null);

  // Edit identity modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: '', species: '', age: '', gender: '', homeworld: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Portrait
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch full character detail ─────────────────────────────────────────────

  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    const res = await apiFetch<CharacterDetail>(`/api/characters/${id}`);
    if (res.success && res.data) {
      const c = res.data;
      setChar(c);
      const map = new Map<string, number | null>();
      c.character_skills.forEach((s) => map.set(s.skillName, s.level));
      setSkillMap(map);
      setBgDraft(c.background ?? '');
      setNotesDraft(c.notes ?? '');
      setError(null);
    } else {
      setError(res.error ?? 'Failed to load character');
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (activeCharacter?.id) {
      void fetchDetail(activeCharacter.id);
      apiFetch<{ activity_points: number }>(`/api/characters/${activeCharacter.id}/activity-points`)
        .then((res) => { if (res.success && res.data) setApPoints(res.data.activity_points); })
        .catch(() => {});
    }
  }, [activeCharacter?.id, fetchDetail]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hex = char ? hexFor(char.colorScheme) : '#4FC3F7';

  // ── Stat editing ────────────────────────────────────────────────────────────

  function beginEditStat(key: StatKey) {
    if (!char) return;
    setEditingStat(key);
    // null → empty string so the input starts blank, not "null"
    const current = char[key];
    setStatDraft(current !== null && current !== undefined ? String(current) : '');
  }

  async function commitStat() {
    if (!char || !editingStat) return;
    // Empty input → cancel without saving
    if (statDraft === '') {
      setEditingStat(null);
      return;
    }
    const val = parseInt(statDraft, 10);
    if (isNaN(val) || val < 0 || val > 25) {
      setEditingStat(null);
      return;
    }
    setChar((prev) => prev ? { ...prev, [editingStat]: val } : prev);
    setEditingStat(null);
    await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [editingStat]: val }),
    });
  }

  async function commitCredits() {
    if (!char) return;
    const val = parseInt(creditsDraft.replace(/,/g, ''), 10);
    setEditingCredits(false);
    if (isNaN(val) || val < 0) return;
    setChar((prev) => prev ? { ...prev, credits: val } : prev);
    await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ credits: val }),
    });
  }

  async function commitSkillPoints() {
    if (!char) return;
    const val = parseInt(spDraft, 10);
    setEditingSkillPoints(false);
    if (isNaN(val) || val < 0) return;
    setChar((prev) => prev ? { ...prev, skill_points: val } : prev);
    await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ skill_points: val }),
    });
  }

  // ── Text section save ───────────────────────────────────────────────────────

  async function saveTextField(field: 'background' | 'notes', value: string) {
    if (!char) return;
    setSavingText(true);
    await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: value }),
    });
    setChar((prev) => prev ? { ...prev, [field]: value } : prev);
    setSavingText(false);
  }

  // ── Skill save ──────────────────────────────────────────────────────────────

  async function saveSkill(skillName: string, level: number | null) {
    if (!char) return;
    const prevLevel = skillMap.get(skillName) ?? null;
    // Optimistic local update
    setSkillMap((m) => new Map(m).set(skillName, level));
    setSavingSkills((s) => new Set(s).add(skillName));
    const res = await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify({ skills: [{ skillName, level }] }),
    });
    setSavingSkills((s) => {
      const next = new Set(s);
      next.delete(skillName);
      return next;
    });
    if (!res.success) {
      // Roll back optimistic update
      setSkillMap((m) => new Map(m).set(skillName, prevLevel));
      console.error('[saveSkill] Failed to save', skillName, res.error);
    }
  }

  // ── Portrait upload ─────────────────────────────────────────────────────────

  async function handlePortraitUpload(file: File) {
    if (!char) return;
    setUploadingPortrait(true);
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`/api/characters/${char.id}/portrait`, {
      method: 'POST',
      body: form,
    });
    const json = (await res.json()) as { success: boolean; data?: { portrait_url: string } };
    if (json.success && json.data) {
      setChar((prev) => prev ? { ...prev, portrait_url: json.data!.portrait_url } : prev);
    }
    setUploadingPortrait(false);
  }

  // ── Identity edit modal ─────────────────────────────────────────────────────

  function openEditModal() {
    if (!char) return;
    setEditDraft({
      name: char.name,
      species: char.species ?? '',
      age: char.age !== null ? String(char.age) : '',
      gender: char.gender ?? '',
      homeworld: char.homeworld ?? '',
    });
    setShowEditModal(true);
  }

  async function saveEditModal() {
    if (!char) return;
    setSavingEdit(true);
    const payload: Record<string, unknown> = {
      name: editDraft.name.trim(),
      species: editDraft.species.trim() || null,
      gender: editDraft.gender.trim() || null,
      homeworld: editDraft.homeworld.trim() || null,
      age: editDraft.age ? parseInt(editDraft.age, 10) : null,
    };
    await apiFetch(`/api/characters/${char.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setChar((prev) =>
      prev
        ? {
            ...prev,
            name: payload.name as string,
            species: payload.species as string | null,
            gender: payload.gender as string | null,
            homeworld: payload.homeworld as string | null,
            age: payload.age as number | null,
          }
        : prev,
    );
    setSavingEdit(false);
    setShowEditModal(false);
  }

  // ── Category helpers ────────────────────────────────────────────────────────

  function toggleCat(cat: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // ── Skill row ────────────────────────────────────────────────────────────────

  function SkillRow({ skillName }: { skillName: string }) {
    const level = skillMap.get(skillName) ?? null;
    const saving = savingSkills.has(skillName);
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-gray-800/60 last:border-0 gap-3">
        <button
          onClick={() => setDescSkill(skillName)}
          className="text-gray-300 hover:text-gray-100 text-sm flex-1 min-w-0 truncate text-left transition-colors underline-offset-2 hover:underline"
        >
          {skillName}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-gray-600 text-xs">…</span>}
          <select
            value={level === null || level === undefined ? '' : String(level)}
            onChange={(e) => {
              const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
              void saveSkill(skillName, val);
            }}
            className="bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm px-1 py-0.5
                       focus:outline-none focus:ring-1 w-16"
          >
            <option value="">NA</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <DmBadge dm={getSkillDM(level)} hex={hex} />
        </div>
      </div>
    );
  }

  // ── Skills panel rendering ────────────────────────────────────────────────

  function renderSkills() {
    const q = skillSearch.trim().toLowerCase();
    const isSearching = q.length > 0;

    let visibleSkills: string[];
    if (isSearching) {
      visibleSkills = SKILL_LIST.filter((s) => s.toLowerCase().includes(q));
    } else if (skillView === 'trained') {
      visibleSkills = SKILL_LIST.filter((s) => {
        const level = skillMap.get(s);
        return level !== null && level !== undefined;
      });
    } else {
      visibleSkills = [...SKILL_LIST];
    }

    const trainedCount = [...skillMap.values()].filter(
      (v) => v !== null && v !== undefined,
    ).length;

    return (
      <div className="card space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Skills</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">
              <span style={{ color: trainedCount > 0 ? hex : undefined }} className="font-bold">
                {trainedCount}
              </span>{' '}
              trained
            </span>
            {/* Toggle */}
            <div className="flex rounded-md overflow-hidden border border-gray-700 text-xs">
              {(['trained', 'all'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSkillView(v)}
                  className="px-3 py-1 transition-colors capitalize"
                  style={
                    skillView === v
                      ? { backgroundColor: hex + '33', color: hex }
                      : { color: '#6b7280' }
                  }
                >
                  {v === 'trained' ? 'Trained Only' : 'All Skills'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            className="input pl-8 text-sm"
            placeholder="Search skills…"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Skill content */}
        <div className="max-h-[480px] overflow-y-auto space-y-2 pr-0.5">
          {/* Flat list when searching */}
          {isSearching ? (
            visibleSkills.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-6">No skills match "{skillSearch}"</p>
            ) : (
              <div className="space-y-0">
                {visibleSkills.map((s) => <SkillRow key={s} skillName={s} />)}
              </div>
            )
          ) : skillView === 'trained' ? (
            /* Trained-only view — grouped by category, only non-null */
            visibleSkills.length === 0 ? (
              <p className="text-gray-600 text-sm py-4">No skills trained yet.</p>
            ) : (
              Object.entries(SKILL_CATEGORIES).map(([cat, catSkills]) => {
                const inCategory = catSkills.filter((s) => {
                  const l = skillMap.get(s);
                  return l !== null && l !== undefined;
                });
                if (inCategory.length === 0) return null;
                return (
                  <div key={cat} className="rounded-lg border border-gray-800 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-800/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{cat}</span>
                      <span className="text-xs text-gray-600">{inCategory.length}</span>
                    </div>
                    <div className="px-3 pb-1 pt-0.5">
                      {inCategory.map((s) => <SkillRow key={s} skillName={s} />)}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* All skills view — collapsible categories */
            Object.entries(SKILL_CATEGORIES).map(([cat, catSkills]) => {
              const isOpen = openCats.has(cat);
              const catTrained = catSkills.filter((s) => {
                const l = skillMap.get(s);
                return l !== null && l !== undefined;
              }).length;
              return (
                <div key={cat} className="rounded-lg border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/40
                               hover:bg-gray-800/70 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs transition-transform"
                        style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                        ▶
                      </span>
                      <span className="text-sm font-medium text-gray-300">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {catTrained > 0 && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ color: hex, backgroundColor: hex + '22' }}>
                          {catTrained}
                        </span>
                      )}
                      <span className="text-gray-600 text-xs">{catSkills.length}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-1 pt-0.5">
                      {catSkills.map((s) => <SkillRow key={s} skillName={s} />)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (bannerLoading || detailLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-700 text-sm">Loading character…</p>
      </div>
    );
  }

  if (!activeCharacter) {
    return (
      <div className="p-8 space-y-4">
        <div>
          <p className="text-nexus-500 text-xs uppercase tracking-widest mb-1">Character</p>
          <h1 className="text-2xl font-bold text-gray-100">Character Sheet</h1>
        </div>
        <div className="card text-center py-12 space-y-3">
          <p className="text-gray-400">No active character.</p>
          <a href="/player/create-character" className="text-nexus-400 hover:text-nexus-300 text-sm transition-colors">
            Create a character →
          </a>
        </div>
      </div>
    );
  }

  if (error || !char) {
    return (
      <div className="p-8">
        <p className="text-red-400 text-sm">{error ?? 'Character data unavailable.'}</p>
      </div>
    );
  }

  const portraitSrc = char.portrait_url ? `/${char.portrait_url}` : null;

  // ── Full sheet render ─────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="card flex flex-col sm:flex-row gap-5">
        {/* Portrait */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <div
            className="w-28 h-28 rounded-xl overflow-hidden border-2 flex items-center justify-center
                       bg-gray-800 relative group cursor-pointer"
            style={{ borderColor: hex + '60' }}
            onClick={() => portraitInputRef.current?.click()}
          >
            {portraitSrc ? (
              <img src={portraitSrc} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold" style={{ color: hex }}>
                {char.name.charAt(0).toUpperCase()}
              </span>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity
                            flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {uploadingPortrait ? '…' : 'Upload'}
              </span>
            </div>
          </div>
          <button
            onClick={() => portraitInputRef.current?.click()}
            disabled={uploadingPortrait}
            className="text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40"
            style={{ borderColor: hex + '50', color: hex }}
          >
            {uploadingPortrait ? 'Uploading…' : 'Upload Portrait'}
          </button>
          <input
            ref={portraitInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePortraitUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: hex }}>
                {char.name}
              </h1>
              <p className="text-gray-500 text-sm mt-1 space-x-2">
                {char.species && <span>{char.species}</span>}
                {char.age !== null && <span>Age {char.age}</span>}
                {char.gender && <span>{char.gender}</span>}
                {char.homeworld && <span>◉ {char.homeworld}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {char.status !== 'ACTIVE' && (
                <span className="badge bg-red-900/60 text-red-300 border border-red-800">
                  {char.status}
                </span>
              )}
              <button
                onClick={openEditModal}
                className="btn-secondary text-xs py-1.5"
              >
                Edit
              </button>
            </div>
          </div>

          {/* Color swatch */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
            <span>{char.colorScheme}</span>
          </div>

          {/* Credits / SP / AP */}
          <div className="flex gap-3 pt-1">
            {/* Credits */}
            <div
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm cursor-pointer hover:border-emerald-700 transition-colors"
              onClick={() => { if (!editingCredits) { setCreditsDraft(String(char.credits)); setEditingCredits(true); } }}
              title="Click to edit"
            >
              <span className="text-gray-500 text-xs block">Credits</span>
              {editingCredits ? (
                <input
                  type="number"
                  min={0}
                  value={creditsDraft}
                  autoFocus
                  onChange={(e) => setCreditsDraft(e.target.value)}
                  onBlur={() => void commitCredits()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitCredits();
                    if (e.key === 'Escape') setEditingCredits(false);
                  }}
                  className="font-bold text-emerald-400 bg-transparent w-28 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="font-bold text-emerald-400">Cr {char.credits.toLocaleString()}</span>
              )}
            </div>
            {/* Activity Points */}
            {apPoints !== null && (
              <div className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm">
                <span className="text-gray-500 text-xs block">Activity Points</span>
                <span className={`font-bold ${apPoints === 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                  ⚡ {apPoints} / 2
                </span>
              </div>
            )}
            {/* Skill Points */}
            <div
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm cursor-pointer hover:border-gray-500 transition-colors"
              onClick={() => { if (!editingSkillPoints) { setSpDraft(String(char.skill_points)); setEditingSkillPoints(true); } }}
              title="Click to edit"
            >
              <span className="text-gray-500 text-xs block">Skill Points</span>
              {editingSkillPoints ? (
                <input
                  type="number"
                  min={0}
                  value={spDraft}
                  autoFocus
                  onChange={(e) => setSpDraft(e.target.value)}
                  onBlur={() => void commitSkillPoints()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitSkillPoints();
                    if (e.key === 'Escape') setEditingSkillPoints(false);
                  }}
                  className="font-bold bg-transparent w-16 focus:outline-none"
                  style={{ color: hex }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="font-bold" style={{ color: hex }}>{char.skill_points}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHARACTERISTICS ────────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Characteristics
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {STAT_DEFS.map(({ key, label }) => {
            const val = char[key];
            const isEditing = editingStat === key;
            const isNull = val === null || val === undefined;
            const draftValid =
              statDraft !== '' &&
              !isNaN(parseInt(statDraft, 10)) &&
              parseInt(statDraft, 10) >= 0 &&
              parseInt(statDraft, 10) <= 25;
            return (
              <div
                key={key}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors"
                style={isEditing
                  ? { borderColor: hex + '80', backgroundColor: hex + '11' }
                  : { borderColor: '#374151', backgroundColor: '#1f2937' }}
              >
                <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={statDraft}
                    autoFocus
                    onChange={(e) => setStatDraft(e.target.value)}
                    onBlur={() => void commitStat()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draftValid) void commitStat();
                      if (e.key === 'Escape') setEditingStat(null);
                    }}
                    className="w-full text-center text-xl font-bold bg-transparent text-gray-100
                               focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => beginEditStat(key)}
                    className="text-2xl font-bold hover:text-white transition-colors
                               focus:outline-none w-full text-center"
                    style={{ color: isNull ? '#4b5563' : '#f3f4f6' }}
                    title="Click to edit"
                  >
                    {isNull ? '—' : val}
                  </button>
                )}
                {!isEditing && !isNull && <DmBadge dm={getStatDM(val)} hex={hex} />}
                {isEditing && (
                  <span className={`text-xs font-mono ${draftValid ? '' : 'text-gray-600'}`}
                    style={draftValid ? { color: hex } : {}}>
                    {draftValid ? getStatDM(parseInt(statDraft, 10)) : '—'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-gray-700 text-xs">Click a value to edit. Press Enter to save, Escape to cancel.</p>
      </div>

      {/* ── BACKGROUND & NOTES ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Background */}
        <div className="card space-y-2">
          <button
            onClick={() => setBgOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Background / Career Summary
            </h3>
            <span className="text-gray-600 text-xs"
              style={{ transform: bgOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>
              ▶
            </span>
          </button>
          {bgOpen && (
            <div className="space-y-2 pt-1">
              {editingBg ? (
                <>
                  <textarea
                    className="input resize-none text-sm"
                    rows={6}
                    value={bgDraft}
                    onChange={(e) => setBgDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await saveTextField('background', bgDraft);
                        setEditingBg(false);
                      }}
                      disabled={savingText}
                      className="text-xs px-3 py-1 rounded font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: hex + '33', color: hex }}
                    >
                      {savingText ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setBgDraft(char.background ?? ''); setEditingBg(false); }}
                      className="text-xs px-3 py-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {char.background || <span className="text-gray-700 italic">No background set.</span>}
                  </p>
                  <button
                    onClick={() => setEditingBg(true)}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card space-y-2">
          <button
            onClick={() => setNotesOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Miscellaneous Notes
            </h3>
            <span className="text-gray-600 text-xs"
              style={{ transform: notesOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>
              ▶
            </span>
          </button>
          {notesOpen && (
            <div className="space-y-2 pt-1">
              {editingNotes ? (
                <>
                  <textarea
                    className="input resize-none text-sm"
                    rows={6}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await saveTextField('notes', notesDraft);
                        setEditingNotes(false);
                      }}
                      disabled={savingText}
                      className="text-xs px-3 py-1 rounded font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: hex + '33', color: hex }}
                    >
                      {savingText ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setNotesDraft(char.notes ?? ''); setEditingNotes(false); }}
                      className="text-xs px-3 py-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {char.notes || <span className="text-gray-700 italic">No notes set.</span>}
                  </p>
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SKILLS ─────────────────────────────────────────────────────────── */}
      {renderSkills()}

      {/* ── SKILL DESCRIPTION MODAL ────────────────────────────────────────── */}
      {descSkill && (
        <SkillDescModal
          skillName={descSkill}
          info={findSkillInfo(descSkill)}
          onClose={() => setDescSkill(null)}
        />
      )}

      {/* ── EDIT IDENTITY MODAL ────────────────────────────────────────────── */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md
                          mx-4 shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-100">Edit Character</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-600 hover:text-gray-300 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'name', label: 'Name', required: true },
                { key: 'species', label: 'Species', required: true },
                { key: 'gender', label: 'Gender', required: false },
                { key: 'homeworld', label: 'Homeworld', required: false },
              ].map(({ key, label, required }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">
                    {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input
                    className="input"
                    value={editDraft[key as keyof typeof editDraft]}
                    onChange={(e) =>
                      setEditDraft((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Age</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={editDraft.age}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, age: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => void saveEditModal()}
                disabled={savingEdit || !editDraft.name.trim()}
                className="flex-1 py-2 rounded-lg font-bold text-sm transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: hex, color: '#000' }}
              >
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
