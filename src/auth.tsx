import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from './lib/api';
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
        const session = await authClient.getSession();

        const currentUser = session?.data?.user;

        setUser(currentUser || null);

        if (!currentUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const email = (currentUser.email || "")
          .trim()
          .toLowerCase();

        const users = await apiFetch("/users");

        const existingUser = users.find(
          (u: any) =>
            (u.email || "").toLowerCase() === email
        );

        setProfile(
          existingUser || {
            email: currentUser.email,
            role: "staff",
            department: "Ground Operations",
          }
        );

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {

    const result = await authClient.signIn.email({
      email,
      password,
    });


    if (result.error) {
      console.error("BETTER AUTH ERROR:", result.error);
      throw new Error(
        JSON.stringify(result.error)
      );
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