import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { JobDetailsPage } from "./pages/JobDetailsPage";
import { Settings } from "./pages/Settings";
import { Scripts } from "./pages/Scripts";
import { ScriptExecutionDetailsPage } from "./pages/ScriptExecutionDetailsPage";
import { GoogleOAuthProvider } from '@react-oauth/google';

// Google Provider - reads Client ID from .env (VITE_GOOGLE_CLIENT_ID)
const AppGoogleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

  if (!clientId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-rose-500 gap-2">
        <span className="font-bold text-lg">⚠️ VITE_GOOGLE_CLIENT_ID chưa được cấu hình</span>
        <span className="text-sm text-slate-400">Thêm VITE_GOOGLE_CLIENT_ID vào file frontend/.env</span>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
};

// A wrapper to protect authentication-required pages
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AppGoogleProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Main Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <Jobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:id"
              element={
                <ProtectedRoute>
                  <JobDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scripts"
              element={
                <ProtectedRoute>
                  <Scripts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scripts/executions/:id"
              element={
                <ProtectedRoute>
                  <ScriptExecutionDetailsPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </AppGoogleProvider>
  );
}

export default App;
