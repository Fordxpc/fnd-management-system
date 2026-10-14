import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext<any>({});

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setProfile(userSnap.data());
          } else {
            // Auto-create default profile on first login
            const defaultProfile = {
              email: currentUser.email,
              department: "Operations",
              role: "staff", // 'developer' | 'manager' | 'owner' | 'admin' | 'smt' | 'staff'
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, defaultProfile);
            setProfile(defaultProfile);
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setProfile({ email: currentUser.email, department: "Operations", role: "staff" });
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);