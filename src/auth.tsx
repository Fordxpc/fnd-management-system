import { createContext, useContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
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
            const staffList = await apiFetch('/staff');
            const match = staffList.find(
              (s: any) =>
                (s.email || '')
                  .trim()
                  .toLowerCase() === email
            );
            if (match) staffData = match;
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

            // Only update role if it's currently 'staff' and they qualify for SMT/Manager
            if (userData.role === 'staff') {
              if (isSMT) { updates.role = 'smt'; needsUpdate = true; }
              else if (isManagerPos) { updates.role = 'manager'; needsUpdate = true; }
            }

            // DO NOT overwrite department if it exists. Only set it if missing.
            if (!userData.department) {
              updates.department = staffDept || 'Ground Operations';
              needsUpdate = true;
            }

            // DO NOT overwrite name/position if they exist.
            if (!userData.name) {
              updates.name = staffData?.name || currentUser.email?.split('@')[0] || 'User';
              needsUpdate = true;
            }
            if (!userData.position) {
              updates.position = staffData?.position || 'Staff';
              needsUpdate = true;
            }

            if (needsUpdate) {
              await updateDoc(userRef, updates);
              finalProfile = { ...userData, ...updates };
            } else {
              finalProfile = userData;
            }
          } else {
            let presetDoc: any = null; let presetId: string | null = null;
            try {
              const presets = await apiFetch('/user-presets');
              const presetMatch = presets.find(
                (p: any) =>
                  (p.email || '')
                    .trim()
                    .toLowerCase() === email
              );
              if (presetMatch) { presetDoc = presetMatch; presetId = presetMatch.id; }
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