import { createContext, useContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
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
        const email = (currentUser.email || "").toLowerCase();
        
        try {
          // 1. Get the real data from the STAFF collection
          let staffData: any = null;
          try {
            const staffQ = query(collection(db, "staff"), where("email", "==", email));
            const staffSnap = await getDocs(staffQ);
            if (!staffSnap.empty) {
              staffData = staffSnap.docs[0].data();
            }
          } catch (e) { console.warn("Staff lookup failed", e); }

          const staffDept = staffData?.department || "Ground Operations";
          const isSMT = staffData?.isSMT === true;
          const isManagerPos = (staffData?.position || '').toLowerCase().includes('manager');

          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            let updates: any = {};
            let needsUpdate = false;

            // Auto-heal Department
            if (userData.department !== staffDept) {
              updates.department = staffDept;
              needsUpdate = true;
            }

            // Auto-heal Role (Upgrade to SMT/Manager if staff record says so)
            if (userData.role === 'staff') {
              if (isSMT) { updates.role = 'smt'; needsUpdate = true; }
              else if (isManagerPos) { updates.role = 'manager'; needsUpdate = true; }
            }

            if (needsUpdate) {
              await updateDoc(userRef, updates);
              setProfile({ ...userData, ...updates });
            } else {
              setProfile(userData);
            }

          } else {
            // New user - check for preset
            let presetDoc: any = null;
            let presetId: string | null = null;

            try {
              const q = query(collection(db, "user_presets"), where("email", "==", email));
              const presetSnap = await getDocs(q);
              if (!presetSnap.empty) {
                presetDoc = presetSnap.docs[0].data();
                presetId = presetSnap.docs[0].id;
              }
            } catch (presetErr) {
              console.warn("Could not look up preset:", presetErr);
            }

            // Determine initial role based on Staff record or Preset
            let initialRole = presetDoc?.role || "staff";
            if (initialRole === "staff" && isSMT) initialRole = "smt";
            if (initialRole === "staff" && isManagerPos) initialRole = "manager";

            const newProfile = {
              email: currentUser.email,
              role: initialRole,
              department: presetDoc?.department || staffDept,
              createdAt: new Date().toISOString(),
              ...(presetDoc && { presetApplied: true })
            };

            await setDoc(userRef, newProfile);
            setProfile(newProfile);

            if (presetId) {
              try { await deleteDoc(doc(db, "user_presets", presetId)); } catch (cleanupErr) { console.warn("Could not delete preset:", cleanupErr); }
            }
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setProfile({ email: currentUser.email, role: "staff", department: "Ground Operations" });
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Firebase Login Error:", error);
      throw error;
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);