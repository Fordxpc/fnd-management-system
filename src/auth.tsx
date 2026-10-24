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
          // 1. Get the real department from the STAFF collection
          let staffDept = "Ground Operations";
          try {
            const staffQ = query(collection(db, "staff"), where("email", "==", email));
            const staffSnap = await getDocs(staffQ);
            if (!staffSnap.empty) {
              staffDept = staffSnap.docs[0].data().department || "Ground Operations";
            }
          } catch (e) { console.warn("Staff lookup failed", e); }

          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            // Self-heal: If user's department doesn't match staff department, fix it!
            if (userData.department !== staffDept) {
              await updateDoc(userRef, { department: staffDept });
              setProfile({ ...userData, department: staffDept });
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

            const newProfile = presetDoc
              ? { email: currentUser.email, role: presetDoc.role || "staff", department: presetDoc.department || staffDept, createdAt: new Date().toISOString(), presetApplied: true }
              : { email: currentUser.email, role: "staff", department: staffDept, createdAt: new Date().toISOString() };

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