import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import LoginModal from "./components/LoginModal";

import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import TransactionDetailsPage from "./pages/TransactionDetailsPage";


function App() {
  return (
    <AuthProvider>

      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions/:year/:month/:category" element={<TransactionsPage />} />
        <Route path="/transaction/:transactionId" element={<TransactionDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <LoginModal />

    </AuthProvider>
  );
}

export default App;
