import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Cross } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4"
        role="status"
        aria-label="Checking authentication status"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 animate-pulse mb-4">
          <Cross className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-text-secondary animate-pulse">
          Verifying your secure session...
        </p>
      </div>
    );
  }

  if (!user) {
    // Only pass safe internal pathname to prevent open redirect vulnerabilities
    const safeRedirectPath = location.pathname.startsWith('/') ? location.pathname : '/dashboard';
    return <Navigate to="/login" state={{ from: safeRedirectPath }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
