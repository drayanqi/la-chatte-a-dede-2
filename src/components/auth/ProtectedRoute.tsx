/**
 * ProtectedRoute - Route wrapper that requires authentication
 * OWNER: Dev Team
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isRestoring } = useAuthStore();
  const location = useLocation();

  // Wait for session restoration before deciding
  if (isRestoring) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the intended destination so login can return the user to it
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
