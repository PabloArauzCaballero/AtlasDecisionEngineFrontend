import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from './useAuth';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingScreen label="Validando sesión segura" />;
  if (status === 'unauthenticated')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
