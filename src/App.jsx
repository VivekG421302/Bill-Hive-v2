import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ScreenSaver from './components/ScreenSaver';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import YourData from './pages/YourData';
import SettingsPage from './pages/Settings';
import Account from './pages/Account';
import Brands from './pages/Brands';
import Items from './pages/Items';
import Stock from './pages/Stock';
import CreateBill from './pages/CreateBill';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScreenSaver />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="create-bill" element={<CreateBill />} />
                <Route path="your-data" element={<YourData />} />
                <Route path="brands" element={<Brands />} />
                <Route path="items" element={<Items />} />
                <Route path="stock" element={<Stock />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="account" element={<Account />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
