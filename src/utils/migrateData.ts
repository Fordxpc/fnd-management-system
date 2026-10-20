import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Your NEW database
import { addDoc, collection as newCollection } from 'firebase/firestore';

// The old Firebase config from your standalone Daily Ops app
const oldFirebaseConfig = {
  apiKey: "AIzaSyB-7XyqfLV9qtL022WPjgg01CKb1t57gSk",
  authDomain: "fnd-daily-rwy-inspections.firebaseapp.com",
  projectId: "fnd-daily-rwy-inspections",
  storageBucket: "fnd-daily-rwy-inspections.firebasestorage.app",
  messagingSenderId: "213970868214",
  appId: "1:213970868214:web:329b2337db5f7018ae19d7",
  measurementId: "G-B7ES92SBN0"
};

export const migrateOldOpsData = async (onProgress: (msg: string) => void) => {
  onProgress("Connecting to old database...");
  
  // Initialize a temporary connection to the old database
  const oldApp = initializeApp(oldFirebaseConfig, 'OldOpsApp');
  const oldDb = getFirestore(oldApp);

  try {
    // 1. Migrate Runway History
    onProgress("Fetching Runway History...");
    const runwaySnap = await getDocs(collection(oldDb, 'daily_team_assignments'));
    
    let runwayCount = 0;
    for (const doc of runwaySnap.docs) {
      const data = doc.data();
      const timestamp = data.timestamp || new Date().toISOString();
      const dateStr = timestamp.split('T')[0];
      const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await addDoc(newCollection(db, 'ops_runway_history'), {
        date: dateStr,
        time: timeStr,
        createdAt: timestamp,
        rwy19: data.rwy19?.members || [],
        rwy01: data.rwy01?.members || [],
        lights: data.lights?.members || []
      });
      runwayCount++;
    }
    onProgress(`Imported ${runwayCount} Runway records.`);

    // 2. Migrate Ground History
    onProgress("Fetching Ground Task History...");
    const groundSnap = await getDocs(collection(oldDb, 'ground_task_assignments'));
    
    let groundCount = 0;
    for (const doc of groundSnap.docs) {
      const data = doc.data();
      const timestamp = data.timestamp || new Date().toISOString();
      const dateStr = timestamp.split('T')[0];
      const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await addDoc(newCollection(db, 'ops_ground_history'), {
        date: dateStr,
        time: timeStr,
        createdAt: timestamp,
        assignments: data.assignments || {}
      });
      groundCount++;
    }
    onProgress(`Imported ${groundCount} Ground records.`);

    onProgress("✅ Migration Complete!");
    await deleteApp(oldApp); // Clean up
    return true;
  } catch (error: any) {
    console.error(error);
    onProgress("❌ Error: " + error.message);
    await deleteApp(oldApp);
    return false;
  }
};