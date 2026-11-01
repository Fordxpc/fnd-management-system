import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "./lib/api";
import { authClient } from "./lib/auth-client";

const AuthContext = createContext<any>({});

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tempAccess, setTempAccess] = useState<any[]>([]);
  const [lightsInspectors, setLightsInspectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await authClient.getSession();
        setUser(data?.user ?? null);

        if (!data?.user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const email = data.user.email.toLowerCase();
        
        // Auto-sync user to Neon
        await apiFetch("/users/me/sync", { method: "POST" }).catch(e => console.warn(e));

        const users = await apiFetch("/users");
        const existingUser = users.find((u: any) => (u.email || "").toLowerCase() === email);

        setProfile(existingUser || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message || "Login failed");
    }
    return result;
  };

  const logout = async () => {
    await authClient.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, tempAccess, lightsInspectors, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);