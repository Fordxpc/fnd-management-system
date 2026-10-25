import { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

// Helper to remove undefined values that crash D1
const cleanData = (obj: any) => {
  const clean: any = {};
  for (const key in obj) {
    if (obj[key] === undefined) {
      clean[key] = null;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      clean[key] = obj[key];
    } else {
      clean[key] = obj[key];
    }
  }
  return clean;
};

export default function MigrationTool() {
  const [migrating, setMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handleMigrate = async () => {
    if (!window.confirm("This will copy all data from Firebase to D1. Proceed?")) return;
    setMigrating(true);
    setLogs([]);

    try {
      // 1. MIGRATE STAFF
      addLog("Fetching Staff from Firebase...");
      const staffSnap = await getDocs(collection(db, 'staff'));
      setProgress({ current: 0, total: staffSnap.size });
      
      const existingStaff = await apiFetch('/staff');
      let staffCount = 0;

      for (const doc of staffSnap.docs) {
        const data = cleanData(doc.data());
        // Ensure email exists and is lowercase for comparison
        const email = (data.email || '').toLowerCase();
        if (!email || !data.name) continue; // Skip completely empty records

        const exists = existingStaff.some((s: any) => (s.email || '').toLowerCase() === email);
        if (!exists) {
           try {
             await apiFetch('/staff', { method: 'POST', body: JSON.stringify({ ...data, email }) });
             staffCount++;
           } catch (e: any) {
             addLog(`⚠️ Failed to migrate staff: ${data.name} (${e.message})`);
           }
        }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated ${staffCount} Staff records.`);

      // 2. MIGRATE LEAVE REQUESTS
      addLog("Fetching Leave Requests...");
      const leaveSnap = await getDocs(collection(db, 'leave_requests'));
      setProgress({ current: 0, total: leaveSnap.size });
      for (const doc of leaveSnap.docs) {
        try {
          await apiFetch('/leave-requests', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate leave request: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Leave Requests.`);

      // 3. MIGRATE ROSTER ENTRIES
      addLog("Fetching Roster Entries...");
      const rosterSnap = await getDocs(collection(db, 'roster_entries'));
      const rosterEntries = rosterSnap.docs.map(d => cleanData(d.data()));
      setProgress({ current: 0, total: rosterEntries.length });
      // Send in chunks of 50 to avoid overwhelming the API
      for (let i = 0; i < rosterEntries.length; i += 50) {
        try {
          await apiFetch('/roster/bulk', { method: 'POST', body: JSON.stringify({ entries: rosterEntries.slice(i, i + 50) }) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate a roster chunk: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: Math.min(prev.current + 50, rosterEntries.length) }));
      }
      addLog(`✅ Migrated Roster Entries.`);

      // 4. MIGRATE FLIGHTS
      addLog("Fetching Flights...");
      const flightsSnap = await getDocs(collection(db, 'flights'));
      setProgress({ current: 0, total: flightsSnap.size });
      for (const doc of flightsSnap.docs) {
        try {
          await apiFetch('/flights', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate flight: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Flights.`);

      // 5. MIGRATE OVERTIME
      addLog("Fetching Overtime...");
      const otSnap = await getDocs(collection(db, 'overtime_entries'));
      setProgress({ current: 0, total: otSnap.size });
      for (const doc of otSnap.docs) {
        try {
          await apiFetch('/overtime', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate OT: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Overtime Entries.`);

      // 6. MIGRATE HOLIDAYS
      addLog("Fetching Holidays...");
      const holSnap = await getDocs(collection(db, 'holidays'));
      setProgress({ current: 0, total: holSnap.size });
      for (const doc of holSnap.docs) {
        try {
          await apiFetch('/holidays', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate holiday: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Holidays.`);

      // 7. MIGRATE RAMP INSPECTIONS (Reports)
      addLog("Fetching Ramp Reports...");
      const rampSnap = await getDocs(collection(db, 'ramp_inspections'));
      setProgress({ current: 0, total: rampSnap.size });
      for (const doc of rampSnap.docs) {
        try {
          await apiFetch('/ramp/reports', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate ramp report: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Ramp Reports.`);

      // 8. MIGRATE FOD
      addLog("Fetching FOD Records...");
      const fodSnap = await getDocs(collection(db, 'fod_collections'));
      setProgress({ current: 0, total: fodSnap.size });
      for (const doc of fodSnap.docs) {
        try {
          await apiFetch('/fod', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate FOD: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated FOD Records.`);

      // 11. MIGRATE USERS (Active Accounts)
      addLog("Fetching Active Users...");
      const usersSnap = await getDocs(collection(db, 'users'));
      setProgress({ current: 0, total: usersSnap.size });
      for (const doc of usersSnap.docs) {
        const data = cleanData(doc.data());
        try {
          // We use the /users/sync endpoint which acts as an UPSERT
          await apiFetch('/users/sync', { 
            method: 'POST', 
            body: JSON.stringify({ 
              uid: doc.id, // Keep the Firebase Auth UID
              email: data.email, 
              role: data.role || 'staff', 
              department: data.department || 'Ground Operations' 
            }) 
          });
        } catch (e: any) { addLog(`⚠️ Failed to migrate user ${data.email}: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated ${usersSnap.size} Active Users.`);

      // 12. MIGRATE USER PRESETS (Pre-registered)
      addLog("Fetching Pre-registered Users...");
      const presetsSnap = await getDocs(collection(db, 'user_presets'));
      setProgress({ current: 0, total: presetsSnap.size });
      for (const doc of presetsSnap.docs) {
        try {
          await apiFetch('/user-presets', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate preset ${doc.data().email}: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated ${presetsSnap.size} User Presets.`);

      addLog("🎉 MIGRATION COMPLETE!");

      // 9. MIGRATE WILDLIFE
      addLog("Fetching Wildlife Records...");
      const wildSnap = await getDocs(collection(db, 'bird_counts'));
      setProgress({ current: 0, total: wildSnap.size });
      for (const doc of wildSnap.docs) {
        try {
          await apiFetch('/wildlife', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate wildlife: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Wildlife Records.`);

      // 10. MIGRATE OPS BOARDS
      addLog("Fetching Ops History...");
      const rwySnap = await getDocs(collection(db, 'ops_runway_history'));
      setProgress({ current: 0, total: rwySnap.size });
      for (const doc of rwySnap.docs) {
        try {
          await apiFetch('/ops/runway', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate runway board: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      const grdSnap = await getDocs(collection(db, 'ops_ground_history'));
      setProgress({ current: 0, total: grdSnap.size });
      for (const doc of grdSnap.docs) {
        try {
          await apiFetch('/ops/ground', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) });
        } catch (e: any) { addLog(`⚠️ Failed to migrate ground board: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Ops History.`);

      addLog("🎉 MIGRATION COMPLETE!");
      toast.success("All data migrated successfully!");
    } catch (err: any) {
      addLog(`❌ FATAL ERROR: ${err.message}`);
      toast.error("Migration failed. Check logs.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="page-content">
      <div className="dash-card" style={{ maxWidth: '600px', margin: '40px auto' }}>
        <h2>🚀 Firebase to D1 Migration</h2>
        <p style={{ color: '#64748b', marginBottom: '20px' }}>
          This tool will read all your historical data from Firebase and push it into your new Cloudflare D1 database.
        </p>
        
        <button 
          onClick={handleMigrate} 
          disabled={migrating}
          className="submit-btn" 
          style={{ width: '100%', padding: '15px', fontSize: '16px', background: migrating ? '#94a3b8' : '#2563eb' }}
        >
          {migrating ? '⏳ Migrating Data... Please Wait...' : '▶️ Start Migration'}
        </button>

        {migrating && progress.total > 0 && (
          <div style={{ marginTop: '15px', textAlign: 'center', fontWeight: 'bold' }}>
            Progress: {progress.current} / {progress.total}
          </div>
        )}

        {logs.length > 0 && (
          <div style={{ marginTop: '20px', background: '#0f172a', color: '#4ade80', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.includes('⚠️') ? '#facc15' : log.includes('❌') ? '#ef4444' : '#4ade80' }}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}