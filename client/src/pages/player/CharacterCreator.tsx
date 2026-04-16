import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../hooks/useApi';
import { getStatDM, getSkillDM } from '../../utils/characterUtils';
import { CHARACTER_COLORS, SKILL_LIST, SKILL_CATEGORIES } from '../../constants/characters';

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillName = (typeof SKILL_LIST)[number];

interface StatFields {
  str: string;
  dex: string;
  end: string;
  int: string;
  edu: string;
  soc: string;
}

interface ExistingCharacter {
  colorScheme: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_ACCENT = '#4FC3F7'; // Cyan fallback before color is chosen
const STAT_KEYS = ['str', 'dex', 'end', 'int', 'edu', 'soc'] as const;
const STAT_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', end: 'END', int: 'INT', edu: 'EDU', soc: 'SOC',
};
const TOTAL_SKILLS = SKILL_LIST.length;

// ── Sub-components ────────────────────────────────────────────────────────────

function DmBadge({ dm, hex }: { dm: string; hex: string }) {
  return (
    <span
      className="inline-block text-xs font-bold px-1.5 py-0.5 rounded font-mono min-w-[2.5rem] text-center"
      style={{ color: hex, backgroundColor: hex + '22', border: `1px solid ${hex}44` }}
    >
      {dm}
    </span>
  );
}

function StepIndicator({ step, accentHex }: { step: number; accentHex: string }) {
  const LABELS = ['Identity', 'Color', 'Stats', 'Skills', 'Review'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8 flex-wrap gap-y-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
              style={
                s === step
                  ? { borderColor: accentHex, color: accentHex, boxShadow: `0 0 8px ${accentHex}66` }
                  : s < step
                  ? { borderColor: accentHex, color: accentHex, backgroundColor: accentHex + '22' }
                  : { borderColor: '#374151', color: '#6b7280' }
              }
            >
              {s < step ? '✓' : s}
            </div>
            <span
              className="text-xs hidden sm:block"
              style={{ color: s === step ? accentHex : s < step ? accentHex + 'bb' : '#6b7280' }}
            >
              {LABELS[s - 1]}
            </span>
          </div>
          {s < 5 && (
            <div
              className="w-8 h-px mx-1 mt-0 sm:-mt-4"
              style={{ backgroundColor: s < step ? accentHex + '66' : '#374151' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CharacterCreator() {
  const { player } = useAuth();
  const navigate = useNavigate();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — Identity
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [homeworld, setHomeworld] = useState('');
  const [background, setBackground] = useState('');
  const [notes, setNotes] = useState('');
  const [step1Error, setStep1Error] = useState('');
  const [step3Error, setStep3Error] = useState('');

  // Step 2 — Color
  const [colorScheme, setColorScheme] = useState<string | null>(null);
  const [takenColors, setTakenColors] = useState<string[]>([]);
  const [colorsLoading, setColorsLoading] = useState(false);

  // Step 3 — Stats
  const [stats, setStats] = useState<StatFields>({
    str: '', dex: '', end: '', int: '', edu: '', soc: '',
  });

  // Step 4 — Skills
  const [skillLevels, setSkillLevels] = useState<Partial<Record<SkillName, number | null>>>({});
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // Step 5 — Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Derived
  const accentHex =
    CHARACTER_COLORS.find((c) => c.name === colorScheme)?.hex ?? DEFAULT_ACCENT;

  const trainedCount = Object.values(skillLevels).filter((v) => v !== null && v !== undefined).length;

  // ── Fetch taken colors when entering step 2 ──────────────────────────────

  useEffect(() => {
    if (step !== 2 || !player) return;
    setColorsLoading(true);
    apiFetch<ExistingCharacter[]>(`/api/characters/player/${player.id}`).then((res) => {
      if (res.success && res.data) {
        setTakenColors(res.data.map((c) => c.colorScheme));
      }
      setColorsLoading(false);
    });
  }, [step, player]);

  // ── Navigation helpers ───────────────────────────────────────────────────

  function goNext() {
    if (step === 1) {
      if (!name.trim()) { setStep1Error('Name is required.'); return; }
      if (!species.trim()) { setStep1Error('Species is required.'); return; }
      setStep1Error('');
    }
    if (step === 3) {
      const allFilled = STAT_KEYS.every((k) => {
        const v = stats[k];
        if (v === '') return false;
        const n = parseInt(v, 10);
        return !isNaN(n) && n >= 0 && n <= 25;
      });
      if (!allFilled) { setStep3Error('All characteristics are required (0–25).'); return; }
      setStep3Error('');
    }
    setStep((s) => Math.min(s + 1, 5));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function toggleCategory(cat: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function setSkillLevel(skill: SkillName, value: number | null) {
    setSkillLevels((prev) => ({ ...prev, [skill]: value }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!player || !colorScheme) return;
    setSubmitting(true);
    setSubmitError(null);

    const skills = Object.entries(skillLevels)
      .filter(([, level]) => level !== null && level !== undefined)
      .map(([skillName, level]) => ({ skillName, level: level as number }));

    const body: Record<string, unknown> = {
      playerId: player.id,
      name: name.trim(),
      species: species.trim(),
      colorScheme,
      str: parseInt(stats.str, 10),
      dex: parseInt(stats.dex, 10),
      end: parseInt(stats.end, 10),
      int: parseInt(stats.int, 10),
      edu: parseInt(stats.edu, 10),
      soc: parseInt(stats.soc, 10),
      skills,
    };
    if (age) body.age = parseInt(age, 10);
    if (gender.trim()) body.gender = gender.trim();
    if (homeworld.trim()) body.homeworld = homeworld.trim();
    if (background.trim()) body.background = background.trim();
    if (notes.trim()) body.notes = notes.trim();

    console.log('[CharacterCreator] POST /api/characters payload:', JSON.stringify(body, null, 2));

    const res = await apiFetch('/api/characters', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (res.success) {
      navigate('/player');
    } else {
      setSubmitError(res.error ?? 'Failed to create character. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Skill row helper ─────────────────────────────────────────────────────

  function SkillRow({ skill }: { skill: SkillName }) {
    const level = skillLevels[skill] ?? null;
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 gap-3">
        <span className="text-gray-300 text-sm flex-1 min-w-0 truncate">{skill}</span>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={level === null || level === undefined ? '' : String(level)}
            onChange={(e) =>
              setSkillLevel(skill, e.target.value === '' ? null : parseInt(e.target.value, 10))
            }
            className="bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm
                       px-1 py-0.5 focus:outline-none focus:ring-1 w-16"
            style={{ focusBorderColor: accentHex } as React.CSSProperties}
          >
            <option value="">NA</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <DmBadge dm={getSkillDM(level)} hex={accentHex} />
        </div>
      </div>
    );
  }

  // ── Render steps ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: accentHex }}>
            Step 1 of 5
          </p>
          <h2 className="text-xl font-bold text-gray-100">Identity</h2>
          <p className="text-gray-500 text-sm mt-1">Basic information about your character.</p>
        </div>

        {step1Error && (
          <div className="p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm">
            {step1Error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              className="input"
              placeholder="Character name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider">
              Species <span className="text-red-400">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Human, Aslan, Vargr…"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Age</label>
            <input
              className="input"
              type="number"
              min={0}
              max={999}
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Gender</label>
            <input
              className="input"
              placeholder="Optional"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Homeworld</label>
            <input
              className="input"
              placeholder="Planet or system of origin"
              value={homeworld}
              onChange={(e) => setHomeworld(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Background</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Career history, upbringing, notable events…"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Notes</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Anything else worth noting…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: accentHex }}>
            Step 2 of 5
          </p>
          <h2 className="text-xl font-bold text-gray-100">Color Scheme</h2>
          <p className="text-gray-500 text-sm mt-1">
            Choose a unique color that represents your character. Each player can only use each
            color once.
          </p>
        </div>

        {colorsLoading ? (
          <p className="text-gray-600 text-sm">Loading color availability…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CHARACTER_COLORS.map(({ name: colorName, hex }) => {
              const taken = takenColors.includes(colorName);
              const selected = colorScheme === colorName;
              return (
                <button
                  key={colorName}
                  onClick={() => !taken && setColorScheme(colorName)}
                  disabled={taken}
                  className={[
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left',
                    taken
                      ? 'opacity-40 cursor-not-allowed border-gray-800'
                      : selected
                      ? 'cursor-pointer'
                      : 'cursor-pointer border-gray-700 hover:border-gray-500',
                  ].join(' ')}
                  style={selected ? { borderColor: hex, boxShadow: `0 0 12px ${hex}44` } : {}}
                >
                  {/* Color swatch */}
                  <div
                    className="w-12 h-12 rounded-full border-2 border-black/20"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-xs text-gray-300 text-center leading-tight">{colorName}</span>

                  {/* Taken label */}
                  {taken && (
                    <span className="absolute top-2 right-2 text-xs text-red-400 font-bold">
                      Taken
                    </span>
                  )}

                  {/* Selected checkmark */}
                  {selected && (
                    <span
                      className="absolute top-2 right-2 text-sm font-bold"
                      style={{ color: hex }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!colorScheme && !colorsLoading && (
          <p className="text-gray-600 text-xs">Select a color to continue.</p>
        )}
      </div>
    );
  }

  function renderStep3() {
    const rows: (keyof StatFields)[][] = [
      ['str', 'dex', 'end'],
      ['int', 'edu', 'soc'],
    ];
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: accentHex }}>
            Step 3 of 5
          </p>
          <h2 className="text-xl font-bold text-gray-100">Characteristics</h2>
          <p className="text-gray-500 text-sm mt-1">
            All six characteristics are required. Enter a value from 0 to 25.
          </p>
        </div>

        {step3Error && (
          <div className="p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm">
            {step3Error}
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-3">
              {row.map((key) => {
                const rawVal = stats[key];
                const parsed = rawVal === '' ? null : parseInt(rawVal, 10);
                const isEmpty = rawVal === '';
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800/60 border border-gray-700"
                  >
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: accentHex }}
                    >
                      {STAT_LABELS[key]} <span className="text-red-400">*</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      value={rawVal}
                      onChange={(e) => {
                        setStep3Error('');
                        setStats((prev) => ({ ...prev, [key]: e.target.value }));
                      }}
                      className="w-full text-center text-xl font-bold bg-gray-900 border border-gray-700
                                 rounded-lg py-2 text-gray-100 focus:outline-none focus:ring-2"
                      style={{ focusRingColor: accentHex } as React.CSSProperties}
                    />
                    {isEmpty ? (
                      <span className="text-xs text-gray-600 font-mono">—</span>
                    ) : (
                      <DmBadge dm={getStatDM(parsed)} hex={accentHex} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStep4() {
    const q = search.trim().toLowerCase();
    const isSearching = q.length > 0;

    // Flat search results
    const searchResults = isSearching
      ? SKILL_LIST.filter((s) => s.toLowerCase().includes(q))
      : [];

    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: accentHex }}>
            Step 4 of 5
          </p>
          <h2 className="text-xl font-bold text-gray-100">Skills</h2>
          <p className="text-gray-500 text-sm mt-1">
            Plan your starting skill levels. These are for review only — you can update them
            later on your character sheet.
          </p>
        </div>

        {/* Search + count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              className="input pl-8"
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <span className="text-xs text-gray-500 shrink-0">
            <span style={{ color: trainedCount > 0 ? accentHex : undefined }} className="font-bold">
              {trainedCount}
            </span>{' '}
            of {TOTAL_SKILLS} trained
          </span>
        </div>

        {/* Skill list */}
        <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
          {isSearching ? (
            searchResults.length === 0 ? (
              <p className="text-gray-600 text-sm py-4 text-center">No skills match "{search}"</p>
            ) : (
              <div className="card py-2 px-3">
                {searchResults.map((skill) => (
                  <SkillRow key={skill} skill={skill} />
                ))}
              </div>
            )
          ) : (
            Object.entries(SKILL_CATEGORIES).map(([cat, catSkills]) => {
              const isOpen = openCategories.has(cat);
              const catTrained = catSkills.filter(
                (s) => skillLevels[s as SkillName] !== null && skillLevels[s as SkillName] !== undefined
              ).length;

              return (
                <div key={cat} className="rounded-xl border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/60
                               hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm font-semibold transition-transform"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}
                      >
                        ▶
                      </span>
                      <span className="text-gray-200 text-sm font-medium">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {catTrained > 0 && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ color: accentHex, backgroundColor: accentHex + '22' }}
                        >
                          {catTrained} trained
                        </span>
                      )}
                      <span className="text-gray-600 text-xs">{catSkills.length} skills</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-2 pt-1 bg-gray-900/60">
                      {catSkills.map((skill) => (
                        <SkillRow key={skill} skill={skill as SkillName} />
                      ))}
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

  function renderStep5() {
    const trainedSkills = SKILL_LIST.filter(
      (s) => skillLevels[s] !== null && skillLevels[s] !== undefined
    );
    const chosenColor = CHARACTER_COLORS.find((c) => c.name === colorScheme);

    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: accentHex }}>
            Step 5 of 5
          </p>
          <h2 className="text-xl font-bold text-gray-100">Review &amp; Create</h2>
          <p className="text-gray-500 text-sm mt-1">
            Confirm your character before submitting. Stats and skills can be refined later.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Identity */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Identity
            </h3>
            <ReviewRow label="Name" value={name} accentHex={accentHex} />
            <ReviewRow label="Species" value={species} accentHex={accentHex} />
            {age && <ReviewRow label="Age" value={age} accentHex={accentHex} />}
            {gender && <ReviewRow label="Gender" value={gender} accentHex={accentHex} />}
            {homeworld && <ReviewRow label="Homeworld" value={homeworld} accentHex={accentHex} />}
            {background && (
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider block mb-0.5">
                  Background
                </span>
                <p className="text-gray-300 text-sm leading-relaxed">{background}</p>
              </div>
            )}
            {notes && (
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider block mb-0.5">
                  Notes
                </span>
                <p className="text-gray-300 text-sm leading-relaxed">{notes}</p>
              </div>
            )}
          </div>

          {/* Color */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Color Scheme
            </h3>
            {chosenColor && (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border-2 border-black/20 shrink-0"
                  style={{ backgroundColor: chosenColor.hex }}
                />
                <span className="text-gray-200 font-medium">{chosenColor.name}</span>
              </div>
            )}
          </div>

          {/* Characteristics */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Characteristics
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {STAT_KEYS.map((key) => {
                const rawVal = stats[key];
                const parsed = rawVal === '' ? null : parseInt(rawVal, 10);
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center p-2 rounded-lg bg-gray-800 border border-gray-700"
                  >
                    <span className="text-xs text-gray-500 uppercase">{STAT_LABELS[key]}</span>
                    <span className="text-lg font-bold text-gray-100">
                      {rawVal === '' ? '—' : rawVal}
                    </span>
                    {parsed !== null && <DmBadge dm={getStatDM(parsed)} hex={accentHex} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skills */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Planned Skills
            </h3>
            {trainedSkills.length === 0 ? (
              <p className="text-gray-600 text-sm">No skills set — you can add them later.</p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {trainedSkills.map((skill) => {
                  const level = skillLevels[skill as SkillName] ?? null;
                  return (
                    <li
                      key={skill}
                      className="flex items-center justify-between py-1 border-b border-gray-800 last:border-0"
                    >
                      <span className="text-gray-300 text-sm">{skill}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">{level}</span>
                        <DmBadge dm={getSkillDM(level)} hex={accentHex} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm">
            {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: accentHex,
            color: '#000',
            boxShadow: submitting ? 'none' : `0 0 20px ${accentHex}55`,
          }}
        >
          {submitting ? 'Creating Character…' : 'Create Character'}
        </button>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  const canProceed = step === 2 ? !!colorScheme : true;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: accentHex }}>
          Character Creation
        </p>
        <h1 className="text-2xl font-bold text-gray-100">New Character</h1>
        {player && <p className="text-gray-500 text-sm mt-1">Player: {player.name}</p>}
      </div>

      {/* Step indicator */}
      <StepIndicator step={step} accentHex={accentHex} />

      {/* Step content */}
      <div className="card">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>

      {/* Nav buttons (not shown on step 5 — submit is embedded there) */}
      {step < 5 && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={step === 1 ? () => navigate('/player') : goBack}
            className="btn-secondary"
          >
            {step === 1 ? '← Cancel' : '← Back'}
          </button>
          <button
            onClick={goNext}
            disabled={!canProceed}
            className="px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentHex, color: '#000' }}
          >
            {step === 4 ? 'Review →' : 'Next →'}
          </button>
        </div>
      )}

      {/* Back button on step 5 */}
      {step === 5 && (
        <button onClick={goBack} className="btn-secondary">
          ← Back
        </button>
      )}
    </div>
  );
}

// ── Small review helper ───────────────────────────────────────────────────────

function ReviewRow({
  label,
  value,
  accentHex,
}: {
  label: string;
  value: string;
  accentHex: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gray-800 pb-1.5 last:border-0 last:pb-0">
      <span className="text-xs text-gray-500 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-gray-200 text-sm text-right" style={{ color: value ? undefined : accentHex }}>
        {value || '—'}
      </span>
    </div>
  );
}
