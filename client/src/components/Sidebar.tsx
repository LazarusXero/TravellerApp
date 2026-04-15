import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useHealth } from '../hooks/useHealth';
import { useAuth } from '../context/AuthContext';

// ── Nav tree types ────────────────────────────────────────────────────────────

interface LeafNode {
  kind: 'link';
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
  placeholder?: boolean;
}

interface SectionNode {
  kind: 'section';
  label: string;
  icon: string;
  storageKey: string;
  children: ChildNode[];
}

interface ChildNode {
  to: string;
  label: string;
  placeholder?: boolean;
}

type NavNode = LeafNode | SectionNode;

// ── Nav definitions ───────────────────────────────────────────────────────────

const GM_NAV: NavNode[] = [
  { kind: 'link', to: '/gm', label: 'Dashboard', icon: '▦', exact: true },
  {
    kind: 'section', label: 'Codex', icon: '⊟', storageKey: 'gm_codex',
    children: [
      { to: '/gm/worlds', label: 'Worlds' },
      { to: '/gm/items',  label: 'Items' },
    ],
  },
  {
    kind: 'section', label: 'Game', icon: '◈', storageKey: 'gm_game',
    children: [
      { to: '/gm/game',           label: 'Information' },
      { to: '/gm/game/eventlog',  label: 'Event Log',  placeholder: true },
      { to: '/gm/game/messaging', label: 'Messaging',  placeholder: true },
      { to: '/gm/game/characters',label: 'Characters', placeholder: true },
      { to: '/gm/game/events',    label: 'Events',     placeholder: true },
    ],
  },
  {
    kind: 'section', label: 'World', icon: '◉', storageKey: 'gm_world',
    children: [
      { to: '/gm/world/information',  label: 'Information',  placeholder: true },
      { to: '/gm/world/store',        label: 'Store',        placeholder: true },
      { to: '/gm/world/black-market', label: 'Black Market', placeholder: true },
      { to: '/gm/world/trade-goods',  label: 'Trade Goods',  placeholder: true },
      { to: '/gm/world/freight',      label: 'Freight',      placeholder: true },
      { to: '/gm/world/passengers',   label: 'Passengers',   placeholder: true },
    ],
  },
  {
    kind: 'section', label: 'Ship', icon: '◁', storageKey: 'gm_ship',
    children: [
      { to: '/gm/ship/information', label: 'Information', placeholder: true },
      { to: '/gm/ship/crew',        label: 'Crew',        placeholder: true },
      { to: '/gm/ship/inventory',   label: 'Inventory',   placeholder: true },
      { to: '/gm/ship/systems',     label: 'Systems',     placeholder: true },
      { to: '/gm/ship/cargo',       label: 'Cargo',       placeholder: true },
      { to: '/gm/ship/berths-passengers',label: 'Berths / Passengers', placeholder: true },
      { to: '/gm/ship/weapons',     label: 'Weapons',     placeholder: true },
      { to: '/gm/ship/combat',      label: 'Combat',      placeholder: true },
    ],
  },
  { kind: 'link', to: '/gm/npcs',     label: 'NPCs',     icon: '◎', placeholder: true },
  { kind: 'link', to: '/gm/factions', label: 'Factions', icon: '⬡', placeholder: true },
  { kind: 'link', to: '/gm/players',  label: 'Players',  icon: '◎' },
];

const PLAYER_NAV: NavNode[] = [
  {
    kind: 'section', label: 'Player', icon: '★', storageKey: 'player_player',
    children: [
      { to: '/player/character', label: 'Character Sheet', placeholder: true },
      { to: '/player/skills',    label: 'Skills',          placeholder: true },
      { to: '/player/inventory', label: 'Inventory',       placeholder: true },
    ],
  },
  {
    kind: 'section', label: 'Codex', icon: '⊟', storageKey: 'player_codex',
    children: [
      { to: '/player/worlds', label: 'Worlds' },
      { to: '/player/items',  label: 'Items' },
    ],
  },
  {
    kind: 'section', label: 'Game', icon: '◈', storageKey: 'player_game',
    children: [
      { to: '/player/game',           label: 'Information' },
      { to: '/player/game/eventlog',  label: 'Event Log',  placeholder: true },
      { to: '/player/game/messaging', label: 'Messaging',  placeholder: true },
    ],
  },
  {
    kind: 'section', label: 'World', icon: '◉', storageKey: 'player_world',
    children: [
      { to: '/player/world/information',  label: 'Information',  placeholder: true },
      { to: '/player/world/store',        label: 'Store',        placeholder: true },
      { to: '/player/world/black-market', label: 'Black Market', placeholder: true },
      { to: '/player/world/trade-goods',  label: 'Trade Goods',  placeholder: true },
      { to: '/player/world/freight',      label: 'Freight',      placeholder: true },
      { to: '/player/world/passengers',   label: 'Passengers',   placeholder: true },
    ],
  },
  {
    kind: 'section', label: 'Ship', icon: '◁', storageKey: 'player_ship',
    children: [
      { to: '/player/ship/information',      label: 'Information',       placeholder: true },
      { to: '/player/ship/crew',             label: 'Crew',              placeholder: true },
      { to: '/player/ship/inventory',        label: 'Inventory',         placeholder: true },
      { to: '/player/ship/systems',          label: 'Systems',           placeholder: true },
      { to: '/player/ship/cargo',            label: 'Cargo',             placeholder: true },
      { to: '/player/ship/berths-passengers',label: 'Berths / Passengers', placeholder: true },
      { to: '/player/ship/combat',           label: 'Combat',            placeholder: true },
    ],
  },
  { kind: 'link', to: '/player/npcs',     label: 'NPCs',     icon: '◎', placeholder: true },
  { kind: 'link', to: '/player/factions', label: 'Factions', icon: '⬡', placeholder: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const LEAF_BASE = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100';
const LEAF_ACTIVE = 'bg-nexus-900/60 text-nexus-300 border border-nexus-800/60';
const LEAF_IDLE = 'text-gray-400 hover:text-gray-100 hover:bg-gray-800';
const LEAF_PLACEHOLDER = 'text-gray-700 cursor-not-allowed select-none';

function NavLeaf({ node, onClose }: { node: LeafNode; onClose: () => void }) {
  if (node.placeholder) {
    return (
      <div
        title="Coming soon"
        className={`${LEAF_BASE} ${LEAF_PLACEHOLDER}`}
      >
        <span className="text-base leading-none">{node.icon}</span>
        {node.label}
      </div>
    );
  }
  return (
    <NavLink
      to={node.to}
      end={node.exact}
      onClick={onClose}
      className={({ isActive }) => `${LEAF_BASE} ${isActive ? LEAF_ACTIVE : LEAF_IDLE}`}
    >
      <span className="text-base leading-none">{node.icon}</span>
      {node.label}
    </NavLink>
  );
}

function NavSection({ node, onClose }: { node: SectionNode; onClose: () => void }) {
  const location = useLocation();
  const storageKey = `nexus_nav_${node.storageKey}`;

  const isChildActive = node.children.some(
    (c) => !c.placeholder && location.pathname === c.to
  );

  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return stored === 'true';
    } catch {}
    return isChildActive;
  });

  // Auto-open when navigating to a child route
  useEffect(() => {
    if (isChildActive) {
      setIsOpen(true);
      try { localStorage.setItem(storageKey, 'true'); } catch {}
    }
  }, [isChildActive, storageKey]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    try { localStorage.setItem(storageKey, String(next)); } catch {}
  };

  return (
    <div>
      <button
        onClick={toggle}
        className={[
          LEAF_BASE,
          'w-full text-left',
          isChildActive ? 'text-nexus-400' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800',
        ].join(' ')}
      >
        <span className="text-base leading-none">{node.icon}</span>
        <span className="flex-1">{node.label}</span>
        <span
          className="text-xs transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▸
        </span>
      </button>

      {isOpen && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
          {node.children.map((child) => {
            if (child.placeholder) {
              return (
                <div
                  key={child.to}
                  title="Coming soon"
                  className="px-2 py-1.5 text-xs text-gray-700 cursor-not-allowed select-none rounded"
                >
                  {child.label}
                </div>
              );
            }
            return (
              <NavLink
                key={child.to}
                to={child.to}
                end
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'block px-2 py-1.5 text-xs rounded transition-colors duration-100',
                    isActive
                      ? 'text-nexus-300 bg-nexus-900/40'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800',
                  ].join(' ')
                }
              >
                {child.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ onClose }: { onClose: () => void }) {
  const health = useHealth();
  const { player, logout, isGM } = useAuth();
  const navigate = useNavigate();

  const navNodes = isGM ? GM_NAV : PLAYER_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-nexus-400 text-xl font-bold tracking-tight">⬡ NEXUS</span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">Command Centre</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-gray-500 hover:text-gray-200 transition-colors p-1"
            aria-label="Close navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Player badge */}
      {player && (
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-full bg-nexus-900 border border-nexus-700 flex items-center justify-center text-xs font-bold text-nexus-300 shrink-0">
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-gray-200 text-xs font-medium truncate">{player.name}</p>
            <p className={`text-xs uppercase tracking-wider ${isGM ? 'text-nexus-500' : 'text-gray-600'}`}>
              {isGM ? '★ GM' : 'Player'}
            </p>
          </div>
        </div>
      )}

      {/* Navigation — scrollable */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navNodes.map((node) =>
          node.kind === 'link' ? (
            <NavLeaf key={node.to} node={node} onClose={onClose} />
          ) : (
            <NavSection key={node.storageKey} node={node} onClose={onClose} />
          )
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800 space-y-3 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={[
              'w-1.5 h-1.5 rounded-full',
              health.status === 'healthy'
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                : health.status === 'checking'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-red-400',
            ].join(' ')}
          />
          <span className="text-gray-600 uppercase tracking-widest">
            {health.status === 'healthy'
              ? 'Systems Online'
              : health.status === 'checking'
              ? 'Connecting…'
              : 'Offline'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-700 hover:text-gray-400 uppercase tracking-widest transition-colors"
        >
          ⏻ Sign Out
        </button>
      </div>
    </aside>
  );
}
