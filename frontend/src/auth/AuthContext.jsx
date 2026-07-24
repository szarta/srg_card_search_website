// Auth state for the Run It Back section only. Mounted around the /run-it-back
// route subtree (see App.jsx), so the public site never triggers an auth check.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, see if an existing session cookie is still valid.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/rib/auth/me")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (key) => {
    try {
      const u = await api.post("/api/rib/auth/login", { key });
      setUser(u);
      return u;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw new Error("That access key was not recognized.");
      }
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/rib/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
