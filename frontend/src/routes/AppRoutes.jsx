import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../layout/AppLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Products from '../pages/Products';
import Sales from '../pages/Sales';
import SaleCreate from '../pages/SaleCreate';
import SaleView from '../pages/SaleView';
import SalePrint from '../pages/SalePrint';
import Customers from '../pages/Customers';
import Users from '../pages/Users';
import Settings from '../pages/Settings';
import Inventory from '../pages/Inventory';
import Analytics from '../pages/Analytics';
import Reports from '../pages/Reports';
import Purchases from '../pages/Purchases';
import Activity from '../pages/Activity';
import Suppliers from '../pages/Suppliers';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="sales" element={<Sales />} />
        <Route path="sales/new" element={<SaleCreate />} />
        <Route path="sales/:id" element={<SaleView />} />
        <Route path="sales/:id/print" element={<SalePrint />} />
        <Route path="customers" element={<Customers />} />
        <Route
          path="inventory"
          element={
            <RoleRoute>
              <Inventory />
            </RoleRoute>
          }
        />
        <Route
          path="purchases"
          element={
            <RoleRoute>
              <Purchases />
            </RoleRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <RoleRoute>
              <Analytics />
            </RoleRoute>
          }
        />
        <Route
          path="users"
          element={
            <RoleRoute>
              <Users />
            </RoleRoute>
          }
        />
        <Route
          path="settings"
          element={
            <RoleRoute>
              <Settings />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute>
              <Reports />
            </RoleRoute>
          }
        />
        <Route
          path="activity"
          element={
            <RoleRoute>
              <Activity />
            </RoleRoute>
          }
        />
        <Route
          path="suppliers"
          element={
            <RoleRoute>
              <Suppliers />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
