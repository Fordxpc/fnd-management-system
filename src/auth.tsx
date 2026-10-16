import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
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
            // Existing user — use their saved profile
            setProfile(userSnap.data());
          } else {
            // New user — check for pre-registration by email first
            const email = (currentUser.email || "").toLowerCase();
            let presetDoc: any = null;
            let presetId: string | null = null;

            try {
              const q = query(
                collection(db, "user_presets"),
                where("email", "==", email)
              );
              const presetSnap = await getDocs(q);
              if (!presetSnap.empty) {
                presetDoc = presetSnap.docs[0].data();
                presetId = presetSnap.docs[0].id;
              }
            } catch (presetErr) {
              console.warn("Could not look up preset:", presetErr);
            }

            const newProfile = presetDoc
              ? {
                  email: currentUser.email,
                  role: presetDoc.role || "staff",
                  department: presetDoc.department || "Ground Operations",
                  createdAt: new Date().toISOString(),
                  presetApplied: true,
                }
              : {
                  email: currentUser.email,
                  role: "staff",
                  department: "Ground Operations",
                  createdAt: new Date().toISOString(),
                };

            await setDoc(userRef, newProfile);
            setProfile(newProfile);

            // Clean up the preset (one-time use)
            if (presetId) {
              try {
                await deleteDoc(doc(db, "user_presets", presetId));
              } catch (cleanupErr) {
                console.warn("Could not delete preset:", cleanupErr);
              }
            }
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setProfile({
            email: currentUser.email,
            role: "staff",
            department: "Ground Operations",
          });
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