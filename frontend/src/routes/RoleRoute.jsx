import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRef } from 'react';

export default function RoleRoute({ children, roles = ['admin'] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const warned = useRef(false);

  if (!user) return <Navigate to="/login" replace />;

  const hasAccess = roles.includes(user.role) || user.role === 'admin' || user.role === 'Super Admin';

  if (!hasAccess) {
    if (!warned.current) {
      warned.current = true;
      toast('Access denied', 'error');
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
