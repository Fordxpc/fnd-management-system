import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const ExcelHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div style={{ textAlign: 'center', marginBottom: '16px', fontFamily: 'Arial, sans-serif' }}>
    <img src="/racl-logo.png" alt="RACL" style={{ height: '60px', objectFit: 'contain', marginBottom: '8px' }} />
    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{title}</div>
    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{subtitle}</div>
  </div>
);

// Added whiteSpace: 'nowrap' to enforce single line
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'Arial, sans-serif', textAlign: 'center' };
const thStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px', background: '#f1f5f9', fontWeight: 'bold', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px', whiteSpace: 'nowrap' };

function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'dfis' | 'wildlife' | 'fod' | 'stats' | 'traffic' | 'lights'>('dfis');
  
  const [rampData, setRampData] = useState<any[]>([]);
  const [fodData, setFodData] = useState<any[]>([]);
  const [birdData, setBirdData] = useState<any[]>([]);

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
    const u4 = onSnapshot(collection(db, 'bird_counts'), s => {
      const data: any[] = s.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setBirdData(data);
    });
    return () => { u1(); u2(); u4(); };
  }, []);

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>📊 Operations Reports</h2>
      </div>

      <div className="ops-tabs no-print" style={{ flexWrap: 'wrap' }}>
        <button className={`ops-tab-btn ${activeTab === 'dfis' ? 'active' : ''}`} onClick={() => setActiveTab('dfis')}>DFIS</button>
        <button className={`ops-tab-btn ${activeTab === 'wildlife' ? 'active' : ''}`} onClick={() => setActiveTab('wildlife')}>Wildlife</button>
        <button className={`ops-tab-btn ${activeTab === 'fod' ? 'active' : ''}`} onClick={() => setActiveTab('fod')}>FOD</button>
        <button className={`ops-tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistics</button>
        <button className={`ops-tab-btn ${activeTab === 'traffic' ? 'active' : ''}`} onClick={() => setActiveTab('traffic')}>Traffic</button>
        <button className={`ops-tab-btn ${activeTab === 'lights' ? 'active' : ''}`} onClick={() => setActiveTab('lights')}>RWY Lights</button>
      </div>

      <div className="dash-card" style={{ padding: '24px', overflowX: 'auto', background: '#fff' }}>
        
        {activeTab === 'dfis' && (
          <div>
            <ExcelHeader title="AIRCRAFT TURNAROUND LOG" subtitle="Funadhoo Airport" />
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle} rowSpan={2}>S.No.</th><th style={thStyle} rowSpan={2}>Date</th><th style={thStyle} rowSpan={2}>CHECK-IN</th><th style={thStyle} rowSpan={2}>Reg.</th>
                  <th style={thStyle} rowSpan={2}>Type of Aircraft</th><th style={thStyle} rowSpan={2}>Owner/Operator</th>
                  <th style={thStyle} colSpan={3}>Arrivals</th><th style={thStyle} colSpan={3}>Route</th>
                  <th style={thStyle} colSpan={2}>Departures</th><th style={thStyle} rowSpan={2}>Mvmnts</th>
                  <th style={thStyle} colSpan={2}>PAX IN</th><th style={thStyle} colSpan={2}>PAX OUT</th>
                  <th style={thStyle} colSpan={2}>TRANSIT</th><th style={thStyle} colSpan={3}>MAIL</th><th style={thStyle} colSpan={3}>CARGO</th>
                  <th style={thStyle} colSpan={3}>OTHERS</th><th style={thStyle} colSpan={3}>BAGGAGE</th>
                  <th style={thStyle} rowSpan={2}>Data Collected by</th><th style={thStyle} rowSpan={2}>Remarks</th>
                </tr>
                <tr>
                  <th style={thStyle}>Flight No.</th><th style={thStyle}>ETA</th><th style={thStyle}>ATA</th>
                  <th style={thStyle}>From</th><th style={thStyle}>Via</th><th style={thStyle}>To</th>
                  <th style={thStyle}>Flight No.</th><th style={thStyle}>Time (DT)</th>
                  <th style={thStyle}>Adult</th><th style={thStyle}>Inft.</th><th style={thStyle}>Adult</th><th style={thStyle}>Inft.</th>
                  <th style={thStyle}>Adult</th><th style={thStyle}>Inft.</th>
                  <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                  <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                  <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                  <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                </tr>
              </thead>
              <tbody>
                {rampData.map((r, i) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{r.date}</td>
                    <td style={tdStyle}>{r.checkIn}</td>
                    <td style={tdStyle}>{r.acReg}</td>
                    <td style={tdStyle}>{r.acType}</td>
                    <td style={tdStyle}>Island Aviations Services</td>
                    <td style={tdStyle}>{r.fltNo}</td>
                    <td style={tdStyle}>{r.eta}</td>
                    <td style={tdStyle}>{r.ata}</td>
                    <td style={tdStyle}>{r.route?.split('/')[0] || 'MLE'}</td>
                    <td style={tdStyle}>{r.route?.split('/')[1] || 'FND'}</td>
                    <td style={tdStyle}>{r.route?.split('/')[2] || 'MLE'}</td>
                    <td style={tdStyle}>{r.fltNo.replace('2', '3')}</td>
                    <td style={tdStyle}>{r.atd}</td>
                    <td style={tdStyle}>2</td>
                    <td style={tdStyle}>{r.paxInAdult || 0}</td>
                    <td style={tdStyle}>{r.paxInInf || 0}</td>
                    <td style={tdStyle}>{r.paxOutAdult || 0}</td>
                    <td style={tdStyle}>{r.paxOutInf || 0}</td>
                    <td style={tdStyle}>{r.paxTransAdult || 0}</td>
                    <td style={tdStyle}>{r.paxTransInf || 0}</td>
                    <td style={tdStyle}>{r.mailIn || 0}</td>
                    <td style={tdStyle}>{r.mailOut || 0}</td>
                    <td style={tdStyle}>{r.mailTrans || 0}</td>
                    <td style={tdStyle}>{r.cargoIn || 0}</td>
                    <td style={tdStyle}>{r.cargoOut || 0}</td>
                    <td style={tdStyle}>{r.cargoTrans || 0}</td>
                    <td style={tdStyle}>{r.otherIn || 0}</td>
                    <td style={tdStyle}>{r.otherOut || 0}</td>
                    <td style={tdStyle}>{r.otherTrans || 0}</td>
                    <td style={tdStyle}>{r.bagIn || 0}</td>
                    <td style={tdStyle}>{r.bagOut || 0}</td>
                    <td style={tdStyle}>{r.bagTrans || 0}</td>
                    <td style={tdStyle}>{r.checkedBy}</td>
                    <td style={tdStyle}>{r.remarks || 'NIL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <ExcelHeader title="FUNADHOO AIRPORT" subtitle="Statistics Report" />
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th><th style={thStyle}>Operator</th><th style={thStyle}>Type of Aircraft</th>
                  <th style={thStyle}>No. of Mvts</th><th style={thStyle}>Pax In (Ad)</th><th style={thStyle}>Pax In (Inf)</th>
                  <th style={thStyle}>Pax Out (Ad)</th><th style={thStyle}>Pax Out (Inf)</th>
                  <th style={thStyle}>Cargo In (kg)</th><th style={thStyle}>Cargo Out (kg)</th>
                  <th style={thStyle}>Mail In (kg)</th><th style={thStyle}>Mail Out (kg)</th>
                </tr>
              </thead>
              <tbody>
                {rampData.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.date}</td>
                    <td style={tdStyle}>MALDIVIAN</td>
                    <td style={tdStyle}>{r.acType}</td>
                    <td style={tdStyle}>2</td>
                    <td style={tdStyle}>{r.paxInAdult || 0}</td>
                    <td style={tdStyle}>{r.paxInInf || 0}</td>
                    <td style={tdStyle}>{r.paxOutAdult || 0}</td>
                    <td style={tdStyle}>{r.paxOutInf || 0}</td>
                    <td style={tdStyle}>{r.cargoIn || 0}</td>
                    <td style={tdStyle}>{r.cargoOut || 0}</td>
                    <td style={tdStyle}>{r.mailIn || 0}</td>
                    <td style={tdStyle}>{r.mailOut || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'traffic' && (
          <div>
            <ExcelHeader title="TRAFFIC MONTHLY REPORT (FUNADHOO AIRPORT)" subtitle="2026" />
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>S. No.</th><th style={thStyle}>Owner or Operator</th><th style={thStyle}>Type of Aircraft</th>
                  <th style={thStyle}>No. of Movements</th><th style={thStyle} colSpan={2}>PAX IN</th><th style={thStyle} colSpan={2}>PAX OUT</th>
                  <th style={thStyle} colSpan={2}>MAIL (Kgs)</th><th style={thStyle} colSpan={2}>CARGO (Kgs)</th>
                </tr>
                <tr>
                  <th style={thStyle} colSpan={4}></th>
                  <th style={thStyle}>Adult</th><th style={thStyle}>Infant</th><th style={thStyle}>Adult</th><th style={thStyle}>Infant</th>
                  <th style={thStyle}>IN</th><th style={thStyle}>OUT</th><th style={thStyle}>IN</th><th style={thStyle}>OUT</th>
                </tr>
              </thead>
              <tbody>
                {['DASH8-B', 'DASH8-C', 'ATR-72', 'ATR-42'].map(type => {
                  const flights = rampData.filter(r => r.acType?.includes(type) || (type === 'ATR-72' && r.acType?.includes('ATR-72')));
                  return (
                    <tr key={type}>
                      <td style={tdStyle}>1</td><td style={tdStyle}>Maldivian</td><td style={tdStyle}>{type}</td>
                      <td style={tdStyle}>{flights.length * 2}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxInAdult || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxInInf || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxOutAdult || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxOutInf || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.mailIn || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.mailOut || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.cargoIn || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.cargoOut || 0), 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'wildlife' && (
          <div>
             <ExcelHeader title="WILDLIFE TREND ANALYSIS" subtitle="Bird Sightings & Risk Summary" />
             <table style={tableStyle}>
              <thead>
                <tr><th style={thStyle}>Date</th><th style={thStyle}>Ref No</th><th style={thStyle}>Species Logged</th><th style={thStyle}>Highest Risk Level</th><th style={thStyle}>Observer</th></tr>
              </thead>
              <tbody>
                {birdData.map(b => {
                  let highest = 'LOW RISK';
                  b.rows.forEach((r: any) => {
                    if (r.zones && r.zones.reduce((a:any, c:any)=>a+c,0) > 5) highest = 'HIGH RISK';
                  });
                  return (
                    <tr key={b.id}>
                      <td style={tdStyle}>{b.date}</td>
                      <td style={tdStyle}>{b.refNo}</td>
                      <td style={tdStyle}>{b.rows.length} species</td>
                      <td style={tdStyle}><strong>{highest}</strong></td>
                      <td style={tdStyle}>{b.observer}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'fod' && (
          <div>
             <ExcelHeader title="FOD COLLECTION LOG" subtitle="Foreign Object Debris Report" />
             <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Date</th><th style={thStyle}>Amount (grams)</th><th style={thStyle}>Remarks</th><th style={thStyle}>Logged By</th></tr></thead>
              <tbody>
                {fodData.map(f => (
                  <tr key={f.id}>
                    <td style={tdStyle}>{f.date}</td>
                    <td style={tdStyle}><strong>{f.grams}g</strong></td>
                    <td style={tdStyle}>{f.remarks}</td>
                    <td style={tdStyle}>{f.loggedBy.split('@')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'lights' && (
          <div>
             <ExcelHeader title="RUNWAY LIGHTS INSPECTION" subtitle="Fault & Maintenance Report" />
             <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No specific light fault records exist yet. This will pull data once logged in the Ops Board.</div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ReportsPage;