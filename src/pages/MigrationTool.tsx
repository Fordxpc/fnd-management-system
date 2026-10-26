import { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

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
  const [showConfirm, setShowConfirm] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const executeMigration = async () => {
    setShowConfirm(false);
    setMigrating(true);
    setLogs([]);

    try {
      // 1. STAFF
      addLog("Fetching Staff from Firebase...");
      const staffSnap = await getDocs(collection(db, 'staff'));
      setProgress({ current: 0, total: staffSnap.size });
      const existingStaff = await apiFetch('/staff');
      let staffCount = 0;
      for (const doc of staffSnap.docs) {
        const data = cleanData(doc.data());
        const email = (data.email || '').toLowerCase();
        if (!email || !data.name) continue; 
        const exists = existingStaff.some((s: any) => (s.email || '').toLowerCase() === email);
        if (!exists) {
           try {
             await apiFetch('/staff', { method: 'POST', body: JSON.stringify({ ...data, email }) });
             staffCount++;
           } catch (e: any) { addLog(`⚠️ Failed staff: ${data.name} (${e.message})`); }
        }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated ${staffCount} Staff records.`);

      // 2. LEAVE REQUESTS
      addLog("Fetching Leave Requests...");
      const leaveSnap = await getDocs(collection(db, 'leave_requests'));
      setProgress({ current: 0, total: leaveSnap.size });
      for (const doc of leaveSnap.docs) {
        try { await apiFetch('/leave-requests', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed leave: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Leave Requests.`);

      // 3. ROSTER ENTRIES
      addLog("Fetching Roster Entries...");
      const rosterSnap = await getDocs(collection(db, 'roster_entries'));
      const rosterEntries = rosterSnap.docs.map(d => cleanData(d.data()));
      setProgress({ current: 0, total: rosterEntries.length });
      for (let i = 0; i < rosterEntries.length; i += 50) {
        try { await apiFetch('/roster/bulk', { method: 'POST', body: JSON.stringify({ entries: rosterEntries.slice(i, i + 50) }) }); } catch (e: any) { addLog(`⚠️ Failed roster chunk: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: Math.min(prev.current + 50, rosterEntries.length) }));
      }
      addLog(`✅ Migrated Roster Entries.`);

      // 4. FLIGHTS
      addLog("Fetching Flights...");
      const flightsSnap = await getDocs(collection(db, 'flights'));
      setProgress({ current: 0, total: flightsSnap.size });
      for (const doc of flightsSnap.docs) {
        try { await apiFetch('/flights', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed flight: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Flights.`);

      // 5. OVERTIME
      addLog("Fetching Overtime...");
      const otSnap = await getDocs(collection(db, 'overtime_entries'));
      setProgress({ current: 0, total: otSnap.size });
      for (const doc of otSnap.docs) {
        try { await apiFetch('/overtime', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed OT: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Overtime Entries.`);

      // 6. HOLIDAYS
      addLog("Fetching Holidays...");
      const holSnap = await getDocs(collection(db, 'holidays'));
      setProgress({ current: 0, total: holSnap.size });
      for (const doc of holSnap.docs) {
        try { await apiFetch('/holidays', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed holiday: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Holidays.`);

      // 7. RAMP INSPECTIONS
      addLog("Fetching Ramp Reports...");
      const rampSnap = await getDocs(collection(db, 'ramp_inspections'));
      setProgress({ current: 0, total: rampSnap.size });
      for (const doc of rampSnap.docs) {
        try { await apiFetch('/ramp/reports', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed ramp: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Ramp Reports.`);

      // 8. FOD
      addLog("Fetching FOD Records...");
      const fodSnap = await getDocs(collection(db, 'fod_collections'));
      setProgress({ current: 0, total: fodSnap.size });
      for (const doc of fodSnap.docs) {
        try { await apiFetch('/fod', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed FOD: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated FOD Records.`);

      // 9. WILDLIFE
      addLog("Fetching Wildlife Records...");
      const wildSnap = await getDocs(collection(db, 'bird_counts'));
      setProgress({ current: 0, total: wildSnap.size });
      for (const doc of wildSnap.docs) {
        try { await apiFetch('/wildlife', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed wildlife: ${e.message}`); }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      addLog(`✅ Migrated Wildlife Records.`);

      // 10. OPS BOARDS
      addLog("Fetching Ops History...");
      const rwySnap = await getDocs(collection(db, 'ops_runway_history'));
      for (const doc of rwySnap.docs) {
        try { await apiFetch('/ops/runway', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed runway: ${e.message}`); }
      }
      const grdSnap = await getDocs(collection(db, 'ops_ground_history'));
      for (const doc of grdSnap.docs) {
        try { await apiFetch('/ops/ground', { method: 'POST', body: JSON.stringify(cleanData(doc.data())) }); } catch (e: any) { addLog(`⚠️ Failed ground: ${e.message}`); }
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
          onClick={() => setShowConfirm(true)} 
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

      <ConfirmDialog 
        isOpen={showConfirm}
        title="Start Migration?"
        message="This will copy all data from Firebase to D1. Proceed?"
        confirmText="Yes, Start"
        isDanger={false}
        onConfirm={executeMigration}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}