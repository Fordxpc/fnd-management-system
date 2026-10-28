import { createContext, useContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";
import { apiFetch } from './lib/api';

const AuthContext = createContext<any>({});

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tempAccess, setTempAccess] = useState<any[]>([]);
  const [lightsInspectors, setLightsInspectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const email = (currentUser.email || "").trim().toLowerCase();
        
        try {
          let staffData: any = null;
          try {
            const staffSnap = await getDocs(collection(db, "staff"));
            const match = staffSnap.docs.find(d => (d.data().email || "").trim().toLowerCase() === email);
            if (match) staffData = match.data();
          } catch (e) { console.warn(e); }

          const staffDept = staffData?.department || ""; 
          const isSMT = staffData?.isSMT === true;
          const isManagerPos = (staffData?.position || '').toLowerCase().includes('manager');

          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          let finalProfile: any = null;

          if (userSnap.exists()) {
            const userData = userSnap.data();
            let updates: any = {};
            let needsUpdate = false;

            // Only apply staffDept if the user doesn't have a department set yet
            if (staffDept && !userData.department) { 
              updates.department = staffDept; 
              needsUpdate = true; 
            }
            if (userData.role === 'staff') {
              if (isSMT) { updates.role = 'smt'; needsUpdate = true; }
              else if (isManagerPos) { updates.role = 'manager'; needsUpdate = true; }
            }
            
            // Ensure name and position are synced
            const staffName = staffData?.name || userData.name || currentUser.email?.split('@')[0] || 'User';
            const staffPosition = staffData?.position || userData.position || 'Staff';
            if (userData.name !== staffName) { updates.name = staffName; needsUpdate = true; }
            if (userData.position !== staffPosition) { updates.position = staffPosition; needsUpdate = true; }

            if (needsUpdate) {
              await updateDoc(userRef, updates);
              finalProfile = { ...userData, ...updates };
            } else finalProfile = userData;
          } else {
            let presetDoc: any = null; let presetId: string | null = null;
            try {
              const q = query(collection(db, "user_presets"), where("email", "==", email));
              const presetSnap = await getDocs(q);
              if (!presetSnap.empty) { presetDoc = presetSnap.docs[0].data(); presetId = presetSnap.docs[0].id; }
            } catch (e) {}

            let initialRole = presetDoc?.role || "staff";
            if (initialRole === "staff" && isSMT) initialRole = "smt";
            if (initialRole === "staff" && isManagerPos) initialRole = "manager";

            const newProfile = {
              email: currentUser.email, 
              role: initialRole,
              department: presetDoc?.department || staffDept || "Ground Operations",
              name: staffData?.name || currentUser.email?.split('@')[0] || 'User',
              position: staffData?.position || 'Staff',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
            finalProfile = newProfile;
            if (presetId) await deleteDoc(doc(db, "user_presets", presetId));
          }

          setProfile(finalProfile);

          // Fetch Temp Access
          try {
            const tAccess = await apiFetch('/temp-access');
            const today = new Date().toISOString().split('T')[0];
            const activeAccess = tAccess.filter((t: any) => 
              t.email.toLowerCase() === email && t.startDate <= today && t.endDate >= today
            );
            setTempAccess(activeAccess);
          } catch (e) { console.warn("Temp access fetch failed", e); }

          // Fetch Lights Inspectors
          try {
            const inspectors = await apiFetch('/lights-inspectors');
            setLightsInspectors(inspectors);
          } catch (e) { console.warn("Lights inspectors fetch failed", e); }

          if (finalProfile) {
            try {
              await apiFetch('/users/sync', {
                method: 'POST',
                body: JSON.stringify({
                  uid: currentUser.uid, email: currentUser.email,
                  role: finalProfile.role || 'staff', 
                  department: finalProfile.department || 'Ground Operations',
                  name: finalProfile.name,
                  position: finalProfile.position
                })
              });
            } catch (d1Err) {}
          }

        } catch (err) {
          setProfile({ email: currentUser.email, role: "staff", department: "Ground Operations", name: "User", position: "Staff" });
        }
      } else {
        setProfile(null);
        setTempAccess([]);
        setLightsInspectors([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => await signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, tempAccess, lightsInspectors, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);