import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';
import { hasRole } from '../../utils/roles';
import AppLayout from './AppLayout';
import { Spinner } from '../ui/index';

interface Props {
  /** The route is allowed when the user holds any one of these roles. */
  allowedRoles?: Role[];
}

const ProtectedRoute: React.FC<Props> = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !hasRole(user, ...allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default ProtectedRoute;
