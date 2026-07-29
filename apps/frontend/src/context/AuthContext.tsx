import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

interface User {
  email: string;
  id: number;
  is_active: boolean;
  gsheet_webhook?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await api.get("/api/auth/me");
          setUser(response.data);
        } catch (error) {
          console.error("Token verification failed", error);
          logout();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // OAuth2 password form data
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await api.post("/api/auth/login", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const { access_token } = response.data;
      localStorage.setItem("token", access_token);
      setToken(access_token);
      
      const userResponse = await api.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      setUser(userResponse.data);
    } catch (error) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (googleToken: string) => {
    setLoading(true);
    try {
      const response = await api.post("/api/auth/google", { token: googleToken });
      const { access_token, user } = response.data;
      localStorage.setItem("token", access_token);
      setToken(access_token);
      setUser(user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setLoading(true);
    try {
      await api.post("/api/auth/register", { email, password });
      await login(email, password);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
