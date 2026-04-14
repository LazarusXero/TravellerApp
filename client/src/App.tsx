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
import { NotFound } from './pages/NotFound';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function RootRedirect() {
  const { player } = useAuth();
  if (!player) return <Navigate to="/login" replace />;
  return <Navigate to={player.role === 'gm' ? '/gm' : '/player'} replace />;
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

            {/* Player routes */}
            <Route
              path="/player"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout>
                    <PlayerDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/game"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout>
                    <PlayerGame />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/worlds"
              element={
                <ProtectedRoute requiredRole="player">
                  <AppLayout>
                    <PlayerWorlds />
                  </AppLayout>
                </ProtectedRoute>
              }
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
