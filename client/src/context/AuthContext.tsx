import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface SessionPlayer {
  id: number;
  name: string;
  role: string;
  active_character_id: number | null;
}

interface AuthContextValue {
  player: SessionPlayer | null;
  isAuthenticated: boolean;
  isGM: boolean;
  login: (player: SessionPlayer) => void;
  logout: () => void;
}

const STORAGE_KEY = 'nexus_session';

function readSession(): SessionPlayer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionPlayer;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<SessionPlayer | null>(readSession);

  const login = useCallback((p: SessionPlayer) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setPlayer(p);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        player,
        isAuthenticated: player !== null,
        isGM: player?.role === 'gm',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
