import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/auth';
import Login from './pages/Login';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Listings from './pages/Listings';
import Reports from './pages/Reports';
import SellerDashboard from './pages/SellerDashboard';
import BuyerDashboard from './pages/BuyerDashboard';
import AdminLog from './pages/AdminLog';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin) {
    const adminRoles = ['superadmin', 'moderator', 'staff'];
    if (!adminRoles.includes(user.role)) {
      return <Navigate to="/seller" replace />;
    }
  }
  return children;
}

export default function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<ProtectedRoute requireAdmin><Overview /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
          <Route path="users/:id" element={<ProtectedRoute requireAdmin><UserDetail /></ProtectedRoute>} />
          <Route path="listings" element={<ProtectedRoute requireAdmin><Listings /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
          <Route path="log" element={<ProtectedRoute requireAdmin><AdminLog /></ProtectedRoute>} />
          <Route path="seller" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="buyer" element={<ProtectedRoute><BuyerDashboard /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}