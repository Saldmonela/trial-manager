import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Route guard that redirects unauthenticated users to /login.
 * Wrap protected routes with this component.
 */
export default function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
