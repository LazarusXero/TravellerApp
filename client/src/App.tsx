import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { NotificationToast } from './components/NotificationToast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { GmDashboard } from './pages/GmDashboard';
import { GmGame } from './pages/GmGame';
import { GmWorlds } from './pages/GmWorlds';
import { PlayersManager } from './pages/PlayersManager';
import { PlayerDashboard } from './pages/PlayerDashboard';
import { PlayerGame } from './pages/PlayerGame';
import { PlayerWorlds } from './pages/PlayerWorlds';
import { GMItemBrowser } from './pages/gm/ItemBrowser';
import { GMCharactersPage } from './pages/gm/GMCharactersPage';
import { GMCharacterSheet } from './pages/gm/GMCharacterSheet';
import { GMInventoryPage } from './pages/gm/GMInventoryPage';
import { GMCharacterInventory } from './pages/gm/GMCharacterInventory';
import { PlayerItemBrowser } from './pages/player/ItemBrowser';
import { CharacterCreator } from './pages/player/CharacterCreator';
import { CharacterSheet } from './pages/player/CharacterSheet';
import { CharactersPage } from './pages/player/CharactersPage';
import { SkillsPage } from './pages/player/SkillsPage';
import { ActionsPage } from './pages/player/ActionsPage';
import { InventoryPage } from './pages/player/InventoryPage';
import { GMStorePage } from './pages/gm/Store';
import { GMBlackMarketPage } from './pages/gm/BlackMarket';
import { PlayerStorePage } from './pages/player/Store';
import { PlayerBlackMarketPage } from './pages/player/BlackMarket';
import { ActiveCharacterBanner } from './components/ActiveCharacterBanner';
import { NotFound } from './pages/NotFound';
import { GMCombatSetup } from './pages/combat/GMCombatSetup';
import { GMCombatInitiative } from './pages/combat/GMCombatInitiative';
import { GMCombatManoeuvre } from './pages/combat/GMCombatManoeuvre';
import { GMCombatAttack } from './pages/combat/GMCombatAttack';
import { GMCombatAction } from './pages/combat/GMCombatAction';
import { GMCombatResolution } from './pages/combat/GMCombatResolution';
import { PlayerCombatSetup } from './pages/combat/PlayerCombatSetup';
import { PlayerCombatInitiative } from './pages/combat/PlayerCombatInitiative';
import { PlayerCombatManoeuvre } from './pages/combat/PlayerCombatManoeuvre';
import { PlayerCombatAttack } from './pages/combat/PlayerCombatAttack';
import { PlayerCombatAction } from './pages/combat/PlayerCombatAction';

function AppLayout({
  children,
  showBanner = false,
}: {
  children: React.ReactNode;
  showBanner?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { player } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay — closes sidebar when tapping outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on md+ */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-gray-100 transition-colors p-1"
            aria-label="Open navigation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-nexus-400 font-bold tracking-tight">⬡ NEXUS</span>
        </div>

        {/* Active character banner — player pages only */}
        {showBanner && player && (
          <ActiveCharacterBanner playerId={player.id} />
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { player } = useAuth();
  if (!player) return <Navigate to="/login" replace />;
  return <Navigate to={player.role === 'gm' ? '/gm' : '/player'} replace />;
}

// Renders the correct component based on role. GM-only routes redirect players.
function CombatRoute({
  gmPage,
  playerPage,
}: {
  gmPage: React.ReactNode;
  playerPage?: React.ReactNode;
}) {
  const { player, isGM } = useAuth();
  if (!player) return <Navigate to="/login" replace />;
  if (!playerPage && !isGM) return <Navigate to="/player" replace />;
  return (
    <AppLayout showBanner={!isGM}>
      {isGM ? gmPage : playerPage}
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* GM routes */}
            <Route
              path="/gm"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GmDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/game"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GmGame />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/players"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <PlayersManager />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/worlds"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GmWorlds />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/gm/items"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMItemBrowser />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/characters"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMCharactersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/characters/:characterId"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMCharacterSheet />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/inventory"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMInventoryPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/inventory/:characterId"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMCharacterInventory />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/world/store"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMStorePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gm/world/black-market"
              element={
                <ProtectedRoute requiredRole="gm">
                  <AppLayout>
                    <GMBlackMarketPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Player routes */}
            <Route
              path="/player"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <PlayerDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/characters"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <CharactersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/character"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <CharacterSheet />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/game"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <PlayerGame />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/worlds"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <PlayerWorlds />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/player/items"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <PlayerItemBrowser />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/skills"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <SkillsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/actions"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <ActionsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/inventory"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <InventoryPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/world/store"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <PlayerStorePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/world/black-market"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout showBanner>
                    <PlayerBlackMarketPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/create-character"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout>
                    <CharacterCreator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Combat routes — shared paths, role-aware rendering */}
            <Route
              path="/combat/setup"
              element={<CombatRoute gmPage={<GMCombatSetup />} playerPage={<PlayerCombatSetup />} />}
            />
            <Route
              path="/combat/initiative"
              element={<CombatRoute gmPage={<GMCombatInitiative />} playerPage={<PlayerCombatInitiative />} />}
            />
            <Route
              path="/combat/manoeuvre"
              element={<CombatRoute gmPage={<GMCombatManoeuvre />} playerPage={<PlayerCombatManoeuvre />} />}
            />
            <Route
              path="/combat/attack"
              element={<CombatRoute gmPage={<GMCombatAttack />} playerPage={<PlayerCombatAttack />} />}
            />
            <Route
              path="/combat/action"
              element={<CombatRoute gmPage={<GMCombatAction />} playerPage={<PlayerCombatAction />} />}
            />
            <Route
              path="/combat/resolution"
              element={<CombatRoute gmPage={<GMCombatResolution />} />}
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          <NotificationToast />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
