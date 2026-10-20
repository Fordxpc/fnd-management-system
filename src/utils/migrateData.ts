import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const oldOpsConfig = {
  apiKey: "AIzaSyB-7XyqfLV9qtL022WPjgg01CKb1t57gSk",
  authDomain: "fnd-daily-rwy-inspections.firebaseapp.com",
  projectId: "fnd-daily-rwy-inspections",
  storageBucket: "fnd-daily-rwy-inspections.firebasestorage.app",
  messagingSenderId: "213970868214",
  appId: "1:213970868214:web:329b2337db5f7018ae19d7",
};

const oldFlightConfig = {
  apiKey: "AIzaSyDlkuORmCXiM4QkixjTGzwGXVz01EFKeko",
  authDomain: "fnd-flight-inspection.firebaseapp.com",
  projectId: "fnd-flight-inspection",
  storageBucket: "fnd-flight-inspection.firebasestorage.app",
  messagingSenderId: "330765997236",
  appId: "1:330765997236:web:7089a631b37744c27473e1"
};

export const migrateOldOpsData = async (onProgress: (msg: string) => void) => {
  onProgress("Connecting to old Ops database...");
  const oldApp = initializeApp(oldOpsConfig, 'OldOpsApp');
  const oldDb = getFirestore(oldApp);

  try {
    onProgress("Fetching Runway History...");
    const runwaySnap = await getDocs(collection(oldDb, 'daily_team_assignments'));
    let runwayCount = 0;
    for (const doc of runwaySnap.docs) {
      const data = doc.data();
      const timestamp = data.timestamp || new Date().toISOString();
      await addDoc(collection(db, 'ops_runway_history'), {
        date: timestamp.split('T')[0],
        time: new Date(timestamp).toLocaleTimeString(),
        createdAt: timestamp,
        rwy19: data.rwy19?.members || [],
        rwy01: data.rwy01?.members || [],
        lights: data.lights?.members || []
      });
      runwayCount++;
    }
    onProgress(`Imported ${runwayCount} Runway records.`);

    onProgress("Fetching Ground History...");
    const groundSnap = await getDocs(collection(oldDb, 'ground_task_assignments'));
    let groundCount = 0;
    for (const doc of groundSnap.docs) {
      const data = doc.data();
      const timestamp = data.timestamp || new Date().toISOString();
      await addDoc(collection(db, 'ops_ground_history'), {
        date: timestamp.split('T')[0],
        time: new Date(timestamp).toLocaleTimeString(),
        createdAt: timestamp,
        assignments: data.assignments || {}
      });
      groundCount++;
    }
    onProgress(`Imported ${groundCount} Ground records.`);
    await deleteApp(oldApp);
    return true;
  } catch (error: any) {
    await deleteApp(oldApp);
    throw error;
  }
};

// NEW: Migrate Ramp Check Data
export const migrateOldRampData = async (onProgress: (msg: string) => void) => {
  onProgress("Connecting to old Flight Inspection database...");
  const oldApp = initializeApp(oldFlightConfig, 'OldFlightApp');
  const oldDb = getFirestore(oldApp);

  try {
    onProgress("Fetching Ramp Check Reports...");
    const rampSnap = await getDocs(collection(oldDb, 'flightInspections'));
    let count = 0;
    
    for (const doc of rampSnap.docs) {
      const data = doc.data();
      await addDoc(collection(db, 'ramp_inspections'), {
        ...data, 
        createdAt: new Date().toISOString()
      });
      count++;
    }
    
    onProgress(`Imported ${count} Ramp Check records.`);
    await deleteApp(oldApp);
    return true;
  } catch (error: any) {
    await deleteApp(oldApp);
    throw error;
  }
};