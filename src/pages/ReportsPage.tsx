import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';

const ExcelHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div style={{ textAlign: 'center', marginBottom: '16px', fontFamily: 'Arial, sans-serif' }}>
    <img src="/racl-logo.png" alt="RACL" style={{ height: '60px', objectFit: 'contain', marginBottom: '8px' }} />
    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{title}</div>
    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{subtitle}</div>
  </div>
);

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'Arial, sans-serif', textAlign: 'center' };
const thStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px', background: '#f1f5f9', fontWeight: 'bold', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px', whiteSpace: 'nowrap' };

function ReportsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dfis' | 'wildlife' | 'fod' | 'stats' | 'traffic' | 'lights' | 'custom'>('dfis');
  
  // Data State
  const [rampData, setRampData] = useState<any[]>([]);
  const [fodData, setFodData] = useState<any[]>([]);
  const [birdData, setBirdData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [flightData, setFlightData] = useState<any[]>([]);

  // Custom Report State
  const [reportType, setReportType] = useState<'staff' | 'ops' | 'wildlife'>('staff');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'ramp_inspections'), s => {
      const data: any[] = s.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setRampData(data);
    });
    const u2 = onSnapshot(collection(db, 'fod_collections'), s => {
      const data: any[] = s.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setFodData(data);
    });
    const u3 = onSnapshot(collection(db, 'bird_counts'), s => {
      const data: any[] = s.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setBirdData(data);
    });
    const u4 = onSnapshot(collection(db, 'staff'), s => setStaffData(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(collection(db, 'roster_entries'), s => setRosterData(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u6 = onSnapshot(collection(db, 'flights'), s => setFlightData(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  const generateCustomReport = () => {
    if (!startDate || !endDate) { alert("Please select Start and End dates"); return; }

    if (reportType === 'staff') {
      if (!selectedStaff) { alert("Please select a staff member"); return; }
      const staffInfo = staffData.find(s => s.id === selectedStaff);
      
      const entries = rosterData.filter(r => r.staffId === selectedStaff && r.date >= startDate && r.date <= endDate);
      
      let present = 0;
      let absent = 0;
      const leaves: { [key: string]: number } = {};

      entries.forEach(e => {
        if (e.status === 'scheduled') present++;
        else if (e.status === 'ABSENT') absent++;
        else {
          leaves[e.status] = (leaves[e.status] || 0) + 1;
        }
      });

      setGeneratedReport({ type: 'staff', staffInfo, present, absent, leaves, totalDays: entries.length });

    } else if (reportType === 'ops') {
      const filteredFlights = flightData.filter(f => f.date >= startDate && f.date <= endDate && (selectedAircraft === '' || f.aircraft === selectedAircraft));
      const totalMvmts = filteredFlights.length * 2; // In/Out
      setGeneratedReport({ type: 'ops', totalMvmts, flights: filteredFlights });

    } else if (reportType === 'wildlife') {
      const filteredBirds = birdData.filter(b => b.date >= startDate && b.date <= endDate);
      const speciesCount: { [key: string]: number } = {};
      filteredBirds.forEach(b => {
        b.rows.forEach((r: any) => {
          if (r.bird) {
            const qty = r.zones.reduce((a:any,c:any)=>a+c,0);
            speciesCount[r.bird] = (speciesCount[r.bird] || 0) + qty;
          }
        });
      });
      setGeneratedReport({ type: 'wildlife', speciesCount, totalRecords: filteredBirds.length });
    }
  };

  const isStaff = profile?.role === 'staff' && !profile?.isSMT;
  if (isStaff) {
    return <div className="page-content"><div className="empty-state"><h2>Access Denied</h2><p>You do not have permission to view Reports.</p></div></div>;
  }

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>📊 Operations Reports</h2>
      </div>

      <div className="ops-tabs no-print" style={{ flexWrap: 'wrap' }}>
        <button className={`ops-tab-btn ${activeTab === 'custom' ? 'active' : ''}`} style={{ background: activeTab === 'custom' ? '#8b5cf6' : '', color: activeTab === 'custom' ? 'white' : '' }} onClick={() => setActiveTab('custom')}>✨ Custom Generator</button>
        <button className={`ops-tab-btn ${activeTab === 'dfis' ? 'active' : ''}`} onClick={() => setActiveTab('dfis')}>DFIS</button>
        <button className={`ops-tab-btn ${activeTab === 'wildlife' ? 'active' : ''}`} onClick={() => setActiveTab('wildlife')}>Wildlife</button>
        <button className={`ops-tab-btn ${activeTab === 'fod' ? 'active' : ''}`} onClick={() => setActiveTab('fod')}>FOD</button>
        <button className={`ops-tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistics</button>
        <button className={`ops-tab-btn ${activeTab === 'traffic' ? 'active' : ''}`} onClick={() => setActiveTab('traffic')}>Traffic</button>
        <button className={`ops-tab-btn ${activeTab === 'lights' ? 'active' : ''}`} onClick={() => setActiveTab('lights')}>RWY Lights</button>
      </div>

      <div className="dash-card" style={{ padding: '24px', overflowX: 'auto', background: '#fff' }}>
        
        {/* CUSTOM GENERATOR TAB */}
        {activeTab === 'custom' && (
          <div>
            <ExcelHeader title="CUSTOM REPORT GENERATOR" subtitle="Select parameters to generate a detailed report" />
            
            <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Report Type</label>
                <select value={reportType} onChange={(e: any) => { setReportType(e.target.value); setGeneratedReport(null); }} style={{ display: 'block', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}>
                  <option value="staff">👤 Individual Staff</option>
                  <option value="ops">✈️ Operations (Flights)</option>
                  <option value="wildlife">🦅 Wildlife (Species)</option>
                </select>
              </div>
              
              {reportType === 'staff' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Select Staff</label>
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} style={{ display: 'block', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}>
                    <option value="">-- Choose Staff --</option>
                    {staffData.map(s => <option key={s.id} value={s.id}>{s.name} ({s.sn})</option>)}
                  </select>
                </div>
              )}

              {reportType === 'ops' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Aircraft (Optional)</label>
                  <select value={selectedAircraft} onChange={(e) => setSelectedAircraft(e.target.value)} style={{ display: 'block', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}>
                    <option value="">All Aircraft</option>
                    <option value="ATR-72/600">ATR-72/600</option>
                    <option value="ATR-42/600">ATR-42/600</option>
                    <option value="DH-8/300">DH-8/300</option>
                    <option value="DH-8/200">DH-8/200</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ display: 'block', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ display: 'block', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={generateCustomReport} className="quick-btn" style={{ background: '#8b5cf6', color: 'white', padding: '9px 20px' }}>Generate Report</button>
              </div>
            </div>

            {/* REPORT RESULTS */}
            {generatedReport?.type === 'staff' && (
              <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                <h3 style={{ color: '#1e40af', margin: '0 0 16px' }}>👤 Staff Report: {generatedReport.staffInfo?.name} ({generatedReport.staffInfo?.sn})</h3>
                <p style={{ fontSize: '14px', marginBottom: '16px' }}>Period: <strong>{startDate}</strong> to <strong>{endDate}</strong></p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>{generatedReport.present}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Days Present</div>
                  </div>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{generatedReport.absent}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Days Absent</div>
                  </div>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{generatedReport.totalDays}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Total Recorded Days</div>
                  </div>
                </div>
                <h4>Leaves Taken:</h4>
                <ul style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  {Object.keys(generatedReport.leaves).length === 0 ? <li>No leaves recorded in this period.</li> : 
                    Object.entries(generatedReport.leaves).map(([type, count]: any) => <li key={type}><strong>{type}:</strong> {count} days</li>)
                  }
                </ul>
              </div>
            )}

            {generatedReport?.type === 'ops' && (
              <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '8px', border: '2px solid #22c55e' }}>
                <h3 style={{ color: '#166534', margin: '0 0 16px' }}>✈️ Operations Report</h3>
                <p style={{ fontSize: '14px', marginBottom: '16px' }}>Aircraft: <strong>{selectedAircraft || 'All Types'}</strong> | Period: <strong>{startDate}</strong> to <strong>{endDate}</strong></p>
                <div style={{ background: 'white', padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#166534' }}>{generatedReport.totalMvmts}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Total Movements (Arrivals + Departures)</div>
                </div>
              </div>
            )}

            {generatedReport?.type === 'wildlife' && (
              <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                <h3 style={{ color: '#92400e', margin: '0 0 16px' }}>🦅 Wildlife Species Report</h3>
                <p style={{ fontSize: '14px', marginBottom: '16px' }}>Period: <strong>{startDate}</strong> to <strong>{endDate}</strong> | Total Bird Count Records: <strong>{generatedReport.totalRecords}</strong></p>
                <table style={tableStyle}>
                  <thead><tr><th style={thStyle}>Species Name</th><th style={thStyle}>Total Count Sighted</th></tr></thead>
                  <tbody>
                    {Object.entries(generatedReport.speciesCount).map(([name, count]: any) => (
                      <tr key={name}>
                        <td style={{...tdStyle, fontWeight: 'bold'}}>{name}</td>
                        <td style={tdStyle}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Keep the existing DFIS, Statistics, Traffic, Wildlife, FOD, Lights tabs here */}
        {/* ... (Paste the rest of the code from your previous ReportsPage.tsx here) ... */}

      </div>
    </div>
  );
}

export default ReportsPage;