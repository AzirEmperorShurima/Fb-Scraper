import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Loader2 } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';

const Facebook: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

export const Login: React.FC = () => {
  const { login, loginWithGoogle, register } = useAuth();
  const navigate = useNavigate();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Authentication failed. Please verify your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 transition-colors duration-300">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 right-0 h-[500px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-card rounded-xl border border-border p-8 shadow-lg relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-primary/10 rounded-xl mb-4">
            <Facebook className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary">
            {isRegister ? "Join Scraper Pro" : "Welcome Back"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 text-center">
            {isRegister 
              ? "Create your account to start scraping Facebook Groups." 
              : "Sign in to manage and download your group data."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Email hoặc Số điện thoại
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email hoặc số điện thoại..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-primary text-primary-foreground rounded-[10px] font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>{isRegister ? "Create Account" : "Sign In"}</span>
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-slate-500">Hoặc tiếp tục với</span>
            </div>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                if (credentialResponse.credential) {
                  setError("");
                  try {
                    await loginWithGoogle(credentialResponse.credential);
                    navigate("/");
                  } catch (err: any) {
                    setError("Google Sign-In failed.");
                  }
                }
              }}
              onError={() => {
                setError("Google Sign-In was unsuccessful.");
              }}
            />
          </div>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {isRegister ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};
