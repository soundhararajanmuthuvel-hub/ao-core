import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalLoader from '../components/GlobalLoader';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <GlobalLoader message="Restoring session..." />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
