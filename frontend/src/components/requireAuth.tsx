import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getCurrentUserEmail } from '../api/authStore.js';

export function RequireAuth({ children }: { children: ReactNode }) {
  const email = getCurrentUserEmail();
  if (!email) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
