import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';

function ReportsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dfis' | 'wildlife' | 'fod' | 'stats' | 'traffic' | 'lights'>('dfis');
  
  const [rampData, setRampData] = useState<any[]>([]);
  const [fodData, setFodData] = useState<any[]>([]);
  const [flightData, setFlightData] = useState<any[]>([]);
  const [birdData, setBirdData] = useState<any[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'ramp_inspections'), s => setRampData(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u2 = onSnapshot(collection(db, 'fod_collections'), s => setFodData(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u3 = onSnapshot(collection(db, 'flights'), s => setFlightData(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const u4 = onSnapshot(collection(db, 'bird_counts'), s => setBirdData(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>📊 Operations Reports</h2>
      </div>

      <div className="ops-tabs" style={{ flexWrap: 'wrap' }}>
        <button className={`ops-tab-btn ${activeTab === 'dfis' ? 'active' : ''}`} onClick={() => setActiveTab('dfis')}>DFIS</button>
        <button className={`ops-tab-btn ${activeTab === 'wildlife' ? 'active' : ''}`} onClick={() => setActiveTab('wildlife')}>Wildlife</button>
        <button className={`ops-tab-btn ${activeTab === 'fod' ? 'active' : ''}`} onClick={() => setActiveTab('fod')}>FOD</button>
        <button className={`ops-tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistics</button>
        <button className={`ops-tab-btn ${activeTab === 'traffic' ? 'active' : ''}`} onClick={() => setActiveTab('traffic')}>Traffic</button>
        <button className={`ops-tab-btn ${activeTab === 'lights' ? 'active' : ''}`} onClick={() => setActiveTab('lights')}>RWY Lights</button>
      </div>

      {/* DFIS TAB */}
      {activeTab === 'dfis' && (
        <div className="dash-card">
          <h3>Daily Flight Information Sheet (DFIS)</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Auto-generated from Ramp Supervisor Check Sheets.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="mini-table" style={{ fontSize: '11px' }}>
              <thead>
                <tr><th>Date</th><th>Flight No</th><th>A/C Reg</th><th>Route</th><th>PAX In (Ad/In)</th><th>PAX Out (Ad/In)</th><th>Cargo In</th><th>Cargo Out</th><th>ATD</th></tr>
              </thead>
              <tbody>
                {rampData.map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td className="font-bold">{r.fltNo}</td>
                    <td>{r.acReg}</td>
                    <td>{r.route}</td>
                    <td>{r.paxInAdult || 0} / {r.paxInInf || 0}</td>
                    <td>{r.paxOutAdult || 0} / {r.paxOutInf || 0}</td>
                    <td>{r.cargoIn || 0} kg</td>
                    <td>{r.cargoOut || 0} kg</td>
                    <td>{r.atd || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WILDLIFE TAB */}
      {activeTab === 'wildlife' && (
        <div className="dash-card">
          <h3>Wildlife Trend Analysis</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Monthly Bird Sightings & Risk Summary</p>
          <table className="mini-table">
            <thead><tr><th>Date</th><th>Ref No</th><th>Species Logged</th><th>Highest Risk Level</th><th>Observer</th></tr></thead>
            <tbody>
              {birdData.map(b => {
                let highest = 'LOW RISK';
                b.rows.forEach((r: any) => {
                  // simple mock logic for highest risk
                  if (r.zones && r.zones.reduce((a:any, c:any)=>a+c,0) > 5) highest = 'HIGH RISK';
                });
                return (
                  <tr key={b.id}>
                    <td>{b.date}</td>
                    <td>{b.refNo}</td>
                    <td>{b.rows.length} species</td>
                    <td><span className={`status-badge ${highest === 'HIGH RISK' ? 'status-pending' : 'status-approved'}`}>{highest}</span></td>
                    <td>{b.observer}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* FOD TAB */}
      {activeTab === 'fod' && (
        <div className="dash-card">
          <h3>FOD Collection Log</h3>
          <table className="mini-table mt-4">
            <thead><tr><th>Date</th><th>Amount (grams)</th><th>Remarks</th><th>Logged By</th></tr></thead>
            <tbody>
              {fodData.map(f => (
                <tr key={f.id}>
                  <td>{f.date}</td>
                  <td className="font-bold text-red-600">{f.grams}g</td>
                  <td>{f.remarks}</td>
                  <td>{f.loggedBy.split('@')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* STATISTICS & TRAFFIC TABS */}
      {(activeTab === 'stats' || activeTab === 'traffic') && (
        <div className="dash-card">
          <h3>{activeTab === 'stats' ? 'Statistics Report' : 'Traffic Monthly Report'} (Auto-generated)</h3>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon">✈️</div><div><div className="stat-value">{flightData.length}</div><div className="stat-label">Total Flights Logged</div></div></div>
            <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon">👥</div><div><div className="stat-value">{rampData.reduce((sum, r) => sum + (Number(r.paxInTotal) || 0) + (Number(r.paxOutTotal) || 0), 0)}</div><div className="stat-label">Total PAX Mvmt</div></div></div>
          </div>
          <table className="mini-table">
            <thead><tr><th>Flight No</th><th>Type</th><th>Aircraft</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {flightData.map(f => (
                <tr key={f.id}>
                  <td className="font-bold">{f.flightNo}</td>
                  <td>{f.type || 'Scheduled'}</td>
                  <td>{f.aircraft}</td>
                  <td>{f.date}</td>
                  <td>{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RWY LIGHTS TAB */}
      {activeTab === 'lights' && (
        <div className="dash-card">
          <h3>Runway Lights Inspection Report</h3>
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <p>No specific light fault records exist yet. This will pull data once logged in the Ops Board.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;