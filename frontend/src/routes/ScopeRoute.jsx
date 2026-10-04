import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRef, useEffect } from 'react';

/**
 * ScopeRoute enforces application portal boundaries.
 * - scope="management_billing": Accessible only when logged into Management & Billing portal.
 * - scope="website_admin": Accessible only when logged into Website Admin portal.
 * 
 * Direct URL access attempts outside the active session scope are strictly blocked.
 */
export default function ScopeRoute({ children, scope = 'management_billing' }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const warnedRef = useRef(false);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const activeScope = user.activeScope || localStorage.getItem('ao_active_scope') || 'management_billing';
  const userScopes = Array.isArray(user.accessScopes) ? user.accessScopes : ['management_billing'];

  // Check if active scope matches required scope, or if user is authorized for that scope
  const isAuthorized = activeScope === scope && userScopes.includes(scope);

  useEffect(() => {
    if (!isAuthorized && !warnedRef.current) {
      warnedRef.current = true;
      const targetName = scope === 'website_admin' ? 'Website Admin' : 'Management & Billing';
      const activeName = activeScope === 'website_admin' ? 'Website Admin' : 'Management & Billing';
      toast(`Access Denied: You are signed into ${activeName}. ${targetName} requires logging into the ${targetName} portal.`, 'error');
    }
  }, [isAuthorized, scope, activeScope, toast]);

  if (!isAuthorized) {
    // Redirect to the allowed entry point for their active session
    if (activeScope === 'website_admin') {
      return <Navigate to="/website" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
