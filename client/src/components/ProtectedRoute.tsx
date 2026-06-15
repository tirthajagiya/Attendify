import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from './Spinner';
import type { UserRole } from '../lib/types';

interface Props {
  children: ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (roles && !roles.includes(user.role)) {
    // Send users to their own dashboard rather than showing a forbidden page.
    return <Navigate to={user.role === 'faculty' ? '/faculty' : '/student'} replace />;
  }

  return <>{children}</>;
}
