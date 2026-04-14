import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'gm' | 'player';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { player } = useAuth();

  if (!player) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && player.role !== requiredRole) {
    return <Navigate to={player.role === 'gm' ? '/gm' : '/player'} replace />;
  }

  return <>{children}</>;
}
