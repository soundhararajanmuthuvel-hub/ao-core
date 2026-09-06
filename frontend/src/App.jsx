import AppRoutes from './routes/AppRoutes';
import { useAuth } from './context/AuthContext';
import GlobalLoader from './components/GlobalLoader';

/**
 * Main Application Root
 *
 * ONE APP • ONE GLOBAL LOADING SCREEN • ZERO ARTIFICIAL DELAY
 */
export default function App() {
  const { loading } = useAuth();

  // If initial authentication/health restoration is still underway, display the single GlobalLoader
  if (loading) {
    return <GlobalLoader message="Initializing application..." />;
  }

  return <AppRoutes />;
}
