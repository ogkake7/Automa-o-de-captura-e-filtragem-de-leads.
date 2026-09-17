import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewSearch } from './pages/NewSearch';
import { Monitoring } from './pages/Monitoring';
import { Leads } from './pages/Leads';
import { Templates } from './pages/Templates';
import { Campaigns } from './pages/Campaigns';
import { NoWhatsApp } from './pages/NoWhatsApp';
import { Settings } from './pages/Settings';
import { UserHistory } from './pages/UserHistory';
import { Profile } from './pages/Profile';
import { Help } from './pages/Help';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="search" element={<NewSearch />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="leads" element={<Leads />} />
              <Route path="templates" element={<Templates />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="profile" element={<Profile />} />
              <Route path="help" element={<Help />} />
              <Route path="no-whatsapp" element={<NoWhatsApp />} />
              
              <Route element={<ProtectedRoute requireAdmin={true} />}>
                <Route path="settings" element={<Settings />} />
                <Route path="admin/users" element={<UserHistory />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
