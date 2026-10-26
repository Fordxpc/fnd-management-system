import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const ExcelHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div style={{ textAlign: 'center', marginBottom: '16px', fontFamily: 'Arial, sans-serif' }}>
    <img src="/racl-logo.png" alt="RACL" style={{ height: '60px', objectFit: 'contain', marginBottom: '8px' }} />
    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{title}</div>
    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{subtitle}</div>
  </div>
);

const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '10px', fontFamily: 'Arial, sans-serif', textAlign: 'center' as const };
const thStyle = { border: '1px solid #000', padding: '4px', background: '#f1f5f9', fontWeight: 'bold', whiteSpace: 'nowrap' as const };
const tdStyle = { border: '1px solid #000', padding: '4px', whiteSpace: 'nowrap' as const };

// FIXED: Properly matches DASH-8/300 and DASH-8/200
const getAircraftColor = (type: string) => {
  if (!type) return '#ffffff';
  const t = type.toUpperCase();
  if (t.includes('ATR-72')) return '#e0f2fe';
  if (t.includes('ATR-42')) return '#dcfce7';
  if (t.includes('DH-8/300') || t.includes('DASH-8/300') || t.includes('DASH8-C')) return '#fef3c7';
  if (t.includes('DH-8/200') || t.includes('DASH-8/200') || t.includes('DASH8-B')) return '#f3e8ff';
  return '#f8fafc';
};

const AircraftLegend = () => (
  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '12px', height: '12px', background: '#e0f2fe', border: '1px solid #000', display: 'inline-block' }}></span> ATR-72
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '12px', height: '12px', background: '#dcfce7', border: '1px solid #000', display: 'inline-block' }}></span> ATR-42
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '12px', height: '12px', background: '#fef3c7', border: '1px solid #000', display: 'inline-block' }}></span> DH-8/300 (Dash 8-C)
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '12px', height: '12px', background: '#f3e8ff', border: '1px solid #000', display: 'inline-block' }}></span> DH-8/200 (Dash 8-B)
    </div>
  </div>
);

// Helper to extract just the kg part from strings like "2/30" or "30"
const parseKg = (val: any) => {
  if (!val) return 0;
  const str = String(val);
  if (str.includes('/')) {
    const parts = str.split('/');
    return Number(parts[1]) || 0; // Takes the second number (kg)
  }
  return Number(str) || 0; // Fallback if they just typed the kg
};

function ReportsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dfis' | 'wildlife' | 'fod' | 'stats' | 'traffic' | 'lights' | 'custom'>('dfis');
  const [loading, setLoading] = useState(true);
  
  const [rampData, setRampData] = useState<any[]>([]);
  const [fodData, setFodData] = useState<any[]>([]);
  const [birdData, setBirdData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [flightData, setFlightData] = useState<any[]>([]);
  const [lightsData, setLightsData] = useState<any[]>([]);

  const [reportType, setReportType] = useState<'staff' | 'ops' | 'wildlife'>('staff');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiFetch('/ramp/reports'), apiFetch('/fod'), apiFetch('/wildlife'),
        apiFetch('/staff'), apiFetch('/roster'), apiFetch('/flights'),
        apiFetch('/lights')
      ]);

      const getData = (index: number) => {
        if (results[index].status === 'fulfilled') return (results[index] as PromiseFulfilledResult<any>).value;
        return [];
      };

      const rampRes = getData(0); const fodRes = getData(1); const birdRes = getData(2);
      const staffRes = getData(3); const rosterRes = getData(4); const flightsRes = getData(5);
      const lightsRes = getData(6);

      setRampData([...rampRes].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')));
      setFodData([...fodRes].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')));
      setBirdData([...birdRes].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')));
      setLightsData([...lightsRes].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')));
      
      setStaffData(staffRes);
      setRosterData(rosterRes);
      setFlightData(flightsRes);
      setLoading(false);
    } catch (err: any) {
      toast.error('Failed to load reports data: ' + err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  const generateCustomReport = () => {
    if (!startDate || !endDate) { toast.error("Please select Start and End dates"); return; }

    if (reportType === 'staff') {
      if (!selectedStaff) { toast.error("Please select a staff member"); return; }
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
      const totalMvmts = filteredFlights.length * 2; 
      setGeneratedReport({ type: 'ops', totalMvmts, flights: filteredFlights });
    } else if (reportType === 'wildlife') {
      const filteredBirds = birdData.filter(b => b.date >= startDate && b.date <= endDate);
      const speciesCount: { [key: string]: number } = {};
      filteredBirds.forEach(b => {
        b.rows?.forEach((r: any) => {
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

  if (loading) return <div className="page-content"><p>Loading Reports from D1...</p></div>;

  const validFlightsForStats = rampData.filter(r => {
    const c = (r.comments || '').toLowerCase();
    const rem = (r.remarks || '').toLowerCase();
    return !c.includes('air ambulance') && !rem.includes('air ambulance');
  });

  // Calculate Totals for DFIS
  const dfisTotals = rampData.reduce((acc, r) => {
    acc.mvmnts += 2;
    acc.paxInAd += Number(r.paxInAdult || 0);
    acc.paxInInf += Number(r.paxInInf || 0);
    acc.paxOutAd += Number(r.paxOutAdult || 0);
    acc.paxOutInf += Number(r.paxOutInf || 0);
    acc.paxTransAd += Number(r.paxTransAdult || 0);
    acc.paxTransInf += Number(r.paxTransInf || 0);
    acc.mailIn += parseKg(r.mailIn);
    acc.mailOut += parseKg(r.mailOut);
    acc.mailTrans += parseKg(r.mailTrans);
    acc.cargoIn += parseKg(r.cargoIn);
    acc.cargoOut += parseKg(r.cargoOut);
    acc.cargoTrans += parseKg(r.cargoTrans);
    acc.otherIn += parseKg(r.otherIn);
    acc.otherOut += parseKg(r.otherOut);
    acc.otherTrans += parseKg(r.otherTrans);
    
    const inPcs = r.bagInPcs !== undefined ? Number(r.bagInPcs) : Number(r.bagIn?.split('/')[0] || 0);
    const inKg = r.bagInKg !== undefined ? Number(r.bagInKg) : Number(r.bagIn?.split('/')[1] || 0);
    acc.bagInPcs += inPcs; acc.bagInKg += inKg;

    const outPcs = r.bagOutPcs !== undefined ? Number(r.bagOutPcs) : Number(r.bagOut?.split('/')[0] || 0);
    const outKg = r.bagOutKg !== undefined ? Number(r.bagOutKg) : Number(r.bagOut?.split('/')[1] || 0);
    acc.bagOutPcs += outPcs; acc.bagOutKg += outKg;

    const transPcs = r.bagTransPcs !== undefined ? Number(r.bagTransPcs) : Number(r.bagTrans?.split('/')[0] || 0);
    const transKg = r.bagTransKg !== undefined ? Number(r.bagTransKg) : Number(r.bagTrans?.split('/')[1] || 0);
    acc.bagTransPcs += transPcs; acc.bagTransKg += transKg;

    return acc;
  }, { mvmnts: 0, paxInAd: 0, paxInInf: 0, paxOutAd: 0, paxOutInf: 0, paxTransAd: 0, paxTransInf: 0, mailIn: 0, mailOut: 0, mailTrans: 0, cargoIn: 0, cargoOut: 0, cargoTrans: 0, otherIn: 0, otherOut: 0, otherTrans: 0, bagInPcs: 0, bagInKg: 0, bagOutPcs: 0, bagOutKg: 0, bagTransPcs: 0, bagTransKg: 0 });

  // Calculate Totals for Statistics
  const statsTotals = validFlightsForStats.reduce((acc, r) => {
    acc.mvmts += 2;
    acc.paxInAd += Number(r.paxInAdult || 0);
    acc.paxInInf += Number(r.paxInInf || 0);
    acc.paxOutAd += Number(r.paxOutAdult || 0);
    acc.paxOutInf += Number(r.paxOutInf || 0);
    acc.cargoIn += parseKg(r.cargoIn);
    acc.cargoOut += parseKg(r.cargoOut);
    acc.mailIn += parseKg(r.mailIn);
    acc.mailOut += parseKg(r.mailOut);
    return acc;
  }, { mvmts: 0, paxInAd: 0, paxInInf: 0, paxOutAd: 0, paxOutInf: 0, cargoIn: 0, cargoOut: 0, mailIn: 0, mailOut: 0 });

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
        
        {activeTab === 'custom' && (
          <div>
            <ExcelHeader title="CUSTOM REPORT GENERATOR" subtitle="Select parameters to generate a detailed report" />
            <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Report Type</label>
                <select value={reportType} onChange={(e: any) => { setReportType(e.target.value); setGeneratedReport(null); }} style={{ display: 'block', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px', color: '#1e293b' }}>
                  <option value="staff">👤 Individual Staff</option>
                  <option value="ops">✈️ Operations (Flights)</option>
                  <option value="wildlife">🦅 Wildlife (Species)</option>
                </select>
              </div>
              
              {reportType === 'staff' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Select Staff</label>
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} style={{ display: 'block', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px', color: '#1e293b' }}>
                    <option value="">-- Choose Staff --</option>
                    {staffData.map(s => <option key={s.id} value={s.id}>{s.name} ({s.sn})</option>)}
                  </select>
                </div>
              )}

              {reportType === 'ops' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Aircraft (Optional)</label>
                  <select value={selectedAircraft} onChange={(e) => setSelectedAircraft(e.target.value)} style={{ display: 'block', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px', color: '#1e293b' }}>
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

        {activeTab === 'dfis' && (
          <div>
            <ExcelHeader title="AIRCRAFT TURNAROUND LOG" subtitle="Funadhoo Airport" />
            <AircraftLegend />
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
                  <th style={thStyle}>In(pcs/kg)</th><th style={thStyle}>Out(pcs/kg)</th><th style={thStyle}>Tran(pcs/kg)</th>
                </tr>
              </thead>
              <tbody>
                {rampData.map((r, i) => {
                  const rawEmail = (r.checkedBy || r.observer || '').toLowerCase();
                  const staffMatch = staffData.find((s: any) => (s.email || '').toLowerCase() === rawEmail);
                  const collectorName = staffMatch ? staffMatch.name : (r.checkedBy || r.observer || '—').split('@')[0];

                  return (
                    <tr key={r.id} style={{ backgroundColor: getAircraftColor(r.acType) }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>{r.date}</td>
                      <td style={tdStyle}>{r.checkIn}</td>
                      <td style={tdStyle}>{r.acReg}</td>
                      <td style={tdStyle}><strong>{r.acType}</strong></td>
                      <td style={tdStyle}>Island Aviations Services</td>
                      <td style={tdStyle}>{r.fltNo}</td>
                      <td style={tdStyle}>{r.eta}</td>
                      <td style={tdStyle}>{r.ata}</td>
                      <td style={tdStyle}>{r.route?.split('/')[0] || 'MLE'}</td>
                      <td style={tdStyle}>{r.route?.split('/')[1] || 'FND'}</td>
                      <td style={tdStyle}>{r.route?.split('/')[2] || 'MLE'}</td>
                      <td style={tdStyle}>{r.fltNo?.replace('2', '3')}</td>
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
                      
                      {/* Shows just X/Y without 'pcs' and 'kg' */}
                      <td style={tdStyle}>{r.bagInPcs !== undefined ? `${r.bagInPcs}/${r.bagInKg}` : (r.bagIn || '—')}</td>
                      <td style={tdStyle}>{r.bagOutPcs !== undefined ? `${r.bagOutPcs}/${r.bagOutKg}` : (r.bagOut || '—')}</td>
                      <td style={tdStyle}>{r.bagTransPcs !== undefined ? `${r.bagTransPcs}/${r.bagTransKg}` : (r.bagTrans || '—')}</td>
                      
                      <td style={tdStyle}>{collectorName}</td>
                      <td style={tdStyle}>{r.comments || 'NIL'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                  <td colSpan={14} style={{ ...tdStyle, textAlign: 'right' }}>Grand Totals:</td>
                  <td style={tdStyle}>{dfisTotals.mvmnts}</td>
                  <td style={tdStyle}>{dfisTotals.paxInAd}</td>
                  <td style={tdStyle}>{dfisTotals.paxInInf}</td>
                  <td style={tdStyle}>{dfisTotals.paxOutAd}</td>
                  <td style={tdStyle}>{dfisTotals.paxOutInf}</td>
                  <td style={tdStyle}>{dfisTotals.paxTransAd}</td>
                  <td style={tdStyle}>{dfisTotals.paxTransInf}</td>
                  <td style={tdStyle}>{dfisTotals.mailIn}</td>
                  <td style={tdStyle}>{dfisTotals.mailOut}</td>
                  <td style={tdStyle}>{dfisTotals.mailTrans}</td>
                  <td style={tdStyle}>{dfisTotals.cargoIn}</td>
                  <td style={tdStyle}>{dfisTotals.cargoOut}</td>
                  <td style={tdStyle}>{dfisTotals.cargoTrans}</td>
                  <td style={tdStyle}>{dfisTotals.otherIn}</td>
                  <td style={tdStyle}>{dfisTotals.otherOut}</td>
                  <td style={tdStyle}>{dfisTotals.otherTrans}</td>
                  <td style={tdStyle}>{dfisTotals.bagInPcs}/{dfisTotals.bagInKg}</td>
                  <td style={tdStyle}>{dfisTotals.bagOutPcs}/{dfisTotals.bagOutKg}</td>
                  <td style={tdStyle}>{dfisTotals.bagTransPcs}/{dfisTotals.bagTransKg}</td>
                  <td colSpan={2} style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <ExcelHeader title="FUNADHOO AIRPORT" subtitle="Statistics Report (Excludes Air Ambulance)" />
            <AircraftLegend />
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
                {validFlightsForStats.map(r => (
                  <tr key={r.id} style={{ backgroundColor: getAircraftColor(r.acType) }}>
                    <td style={tdStyle}>{r.date}</td>
                    <td style={tdStyle}>MALDIVIAN</td>
                    <td style={tdStyle}><strong>{r.acType}</strong></td>
                    <td style={tdStyle}>2</td>
                    <td style={tdStyle}>{r.paxInAdult || 0}</td>
                    <td style={tdStyle}>{r.paxInInf || 0}</td>
                    <td style={tdStyle}>{r.paxOutAdult || 0}</td>
                    <td style={tdStyle}>{r.paxOutInf || 0}</td>
                    <td style={tdStyle}>{parseKg(r.cargoIn)}</td>
                    <td style={tdStyle}>{parseKg(r.cargoOut)}</td>
                    <td style={tdStyle}>{parseKg(r.mailIn)}</td>
                    <td style={tdStyle}>{parseKg(r.mailOut)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>Grand Totals:</td>
                  <td style={tdStyle}>{statsTotals.mvmts}</td>
                  <td style={tdStyle}>{statsTotals.paxInAd}</td>
                  <td style={tdStyle}>{statsTotals.paxInInf}</td>
                  <td style={tdStyle}>{statsTotals.paxOutAd}</td>
                  <td style={tdStyle}>{statsTotals.paxOutInf}</td>
                  <td style={tdStyle}>{statsTotals.cargoIn}</td>
                  <td style={tdStyle}>{statsTotals.cargoOut}</td>
                  <td style={tdStyle}>{statsTotals.mailIn}</td>
                  <td style={tdStyle}>{statsTotals.mailOut}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === 'traffic' && (
          <div>
            <ExcelHeader title="TRAFFIC MONTHLY REPORT (FUNADHOO AIRPORT)" subtitle="2026 (Excludes Air Ambulance)" />
            <AircraftLegend />
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
                {['DH-8/200', 'DH-8/300', 'ATR-72', 'ATR-42'].map(type => {
                  const flights = validFlightsForStats.filter(r => {
                    const ac = (r.acType || '').toUpperCase().replace(/\s+/g, '');
                    if (type === 'DH-8/300') return ac.includes('DH-8/300') || ac.includes('DASH-8/300') || ac.includes('DASH8-C');
                    if (type === 'DH-8/200') return ac.includes('DH-8/200') || ac.includes('DASH-8/200') || ac.includes('DASH8-B');
                    if (type === 'ATR-72') return ac.includes('ATR-72');
                    if (type === 'ATR-42') return ac.includes('ATR-42');
                    return false;
                  });
                  
                  return (
                    <tr key={type} style={{ backgroundColor: getAircraftColor(type) }}>
                      <td style={tdStyle}>1</td><td style={tdStyle}>Maldivian</td><td style={tdStyle}><strong>{type}</strong></td>
                      <td style={tdStyle}>{flights.length * 2}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxInAdult || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxInInf || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxOutAdult || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + Number(f.paxOutInf || 0), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + parseKg(f.mailIn), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + parseKg(f.mailOut), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + parseKg(f.cargoIn), 0)}</td>
                      <td style={tdStyle}>{flights.reduce((s, f) => s + parseKg(f.cargoOut), 0)}</td>
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
                  b.rows?.forEach((r: any) => {
                    if (r.zones && r.zones.reduce((a:any, c:any)=>a+c,0) > 5) highest = 'HIGH RISK';
                  });
                  return (
                    <tr key={b.id}>
                      <td style={tdStyle}>{b.date}</td>
                      <td style={tdStyle}>{b.refNo}</td>
                      <td style={tdStyle}>{b.rows?.length || 0} species</td>
                      <td style={tdStyle}><strong>{highest}</strong></td>
                      <td style={tdStyle}>{b.observer}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: 'right' }}>Total Records:</td>
                  <td style={tdStyle}>{birdData.length}</td>
                  <td colSpan={2} style={tdStyle}></td>
                </tr>
              </tfoot>
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
              <tfoot>
                <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                  <td colSpan={1} style={{ ...tdStyle, textAlign: 'right' }}>Total:</td>
                  <td style={tdStyle}>{fodData.reduce((s, f) => s + Number(f.grams || 0), 0)}g</td>
                  <td colSpan={2} style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === 'lights' && (
          <div>
             <ExcelHeader title="RUNWAY LIGHTS INSPECTION" subtitle="Fault & Maintenance Report" />
             <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th><th style={thStyle}>Time</th><th style={thStyle}>Inspector</th><th style={thStyle}>Weather</th>
                  <th style={thStyle}>Edge (A/B)</th><th style={thStyle}>End (01/19)</th><th style={thStyle}>Thresh (01/19)</th>
                  <th style={thStyle}>PAPI 01 (L/B)</th><th style={thStyle}>PAPI 19 (L/B)</th>
                  <th style={thStyle}>Taxi (A/B)</th><th style={thStyle}>Apron</th><th style={thStyle}>ROB</th><th style={thStyle}>Windcone</th>
                  <th style={thStyle}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {lightsData.length === 0 ? (
                  <tr><td colSpan={14} style={{ padding: '20px', textAlign: 'center' }}>No light records found.</td></tr>
                ) : lightsData.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.date}</td>
                    <td style={tdStyle}>{r.time || '—'}</td>
                    <td style={tdStyle}>{r.inspectorName}</td>
                    <td style={tdStyle}>{r.weather || '—'}</td>
                    <td style={tdStyle}>{r.data.edge?.sideA || 0} / {r.data.edge?.sideB || 0}</td>
                    <td style={tdStyle}>{r.data.end?.rwy01 || 0} / {r.data.end?.rwy19 || 0}</td>
                    <td style={tdStyle}>{r.data.threshold?.rwy01 || 0} / {r.data.threshold?.rwy19 || 0}</td>
                    <td style={tdStyle}>{r.data.papi?.rwy01?.count || 0} / {r.data.papi?.rwy01?.brightness || '—'}</td>
                    <td style={tdStyle}>{r.data.papi?.rwy19?.count || 0} / {r.data.papi?.rwy19?.brightness || '—'}</td>
                    <td style={tdStyle}>{r.data.taxi?.boardA || 0} / {r.data.taxi?.boardB || 0}</td>
                    <td style={tdStyle}>{r.data.apron?.masts || 0} x {r.data.apron?.perMast || 0}</td>
                    <td style={tdStyle}><strong>{r.data.rob?.status || 'In Service'}</strong></td>
                    <td style={tdStyle}><strong>{r.data.windcone?.status || 'In Service'}</strong></td>
                    <td style={tdStyle}>{r.remarks || 'NIL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

export default ReportsPage;