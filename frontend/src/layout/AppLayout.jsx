import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar collapsed={collapsed} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`main-area ${collapsed ? 'collapsed' : ''}`}>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
