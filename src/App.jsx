import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import YourData from './pages/YourData';
import SettingsPage from './pages/Settings';
import Account from './pages/Account';
import Brands from './pages/Brands';
import Items from './pages/Items';
import Stock from './pages/Stock';
import CreateBill from './pages/CreateBill';
import PastBills from './pages/PastBills';
import SalesReturn from './pages/SalesReturn';
import SaleSummary from './pages/SaleSummary';
import Suppliers from './pages/Suppliers';
import Fulfillment from './pages/Fulfillment';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
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
                <Route path="past-bills" element={<PastBills />} />
                <Route path="your-data" element={<YourData />} />
                <Route path="brands" element={<Brands />} />
                <Route path="items" element={<Items />} />
                <Route path="stock" element={<Stock />} />
                <Route path="sales-return" element={<SalesReturn />} />
                <Route path="sale-summary" element={<SaleSummary />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="fulfillment" element={<Fulfillment />} />
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
