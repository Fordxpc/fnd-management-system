import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

const TABS = ['Custom Generator', 'DFIS', 'Wildlife', 'FOD', 'Statistics', 'Traffic', 'RWY Lights'];

const AIRCRAFT_COLORS: Record<string, string> = {
  'ATR-72/600': '#fef3c7', 
  'ATR-42/600': '#dcfce7', 
  'DASH-8/300': '#dbeafe', 
  'DH-8/300': '#dbeafe',
  'DASH-8/200': '#f3e8ff', 
  'DH-8/200': '#f3e8ff',
};

const MONTHS = [
  { val: '01', name: 'January' }, { val: '02', name: 'February' }, { val: '03', name: 'March' },
  { val: '04', name: 'April' }, { val: '05', name: 'May' }, { val: '06', name: 'June' },
  { val: '07', name: 'July' }, { val: '08', name: 'August' }, { val: '09', name: 'September' },
  { val: '10', name: 'October' }, { val: '11', name: 'November' }, { val: '12', name: 'December' }
];

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('DFIS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [zoom, setZoom] = useState(1);

  const [loading, setLoading] = useState(true);
  const [rampReports, setRampReports] = useState<any[]>([]);
  const [wildlifeReports, setWildlifeReports] = useState<any[]>([]);
  const [fodReports, setFodReports] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  const fetchAllData = useCallback(async () => {
    try {
      const [ramp, wildlife, fod, staff] = await Promise.allSettled([
        apiFetch('/ramp/reports'), apiFetch('/wildlife'), apiFetch('/fod'), apiFetch('/staff')
      ]);
      if (ramp.status === 'fulfilled') setRampReports(ramp.value);
      if (wildlife.status === 'fulfilled') setWildlifeReports(wildlife.value);
      if (fod.status === 'fulfilled') setFodReports(fod.value);
      if (staff.status === 'fulfilled') setStaffList(staff.value);
      setLoading(false);
    } catch (err: any) { toast.error('Failed to load data: ' + err.message); setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handlePrint = () => {
    document.body.classList.add('printing-report');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-report'), 1000);
  };

  const handleSaveReport = async () => {
    try {
      await apiFetch('/reports/save-monthly', {
        method: 'POST',
        body: JSON.stringify({ month: selectedMonth || 'ALL', dateFrom, dateTo, type: activeTab })
      });
      toast.success(`${activeTab} report saved to database!`);
    } catch (err: any) {
      toast.error('Failed to save report. Ensure backend endpoint exists.');
    }
  };

  const handleClearFilter = () => { setDateFrom(''); setDateTo(''); setSelectedMonth(''); };

  const filterByDate = useCallback((item: any) => {
    const d = item.date || item.createdAt?.split('T')[0];
    if (!d) return true;
    if (selectedMonth && !d.startsWith(`2026-${selectedMonth}`)) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }, [dateFrom, dateTo, selectedMonth]);

  const getStaffName = (email: string) => {
    if (!email) return '—';
    const s = staffList.find(st => (st.email || '').toLowerCase() === email.toLowerCase());
    return s ? s.name : email.split('@')[0];
  };

  const parseRoute = (routeStr: string) => {
    if (!routeStr) return { from: '', transit: '', to: '' };
    const cleanStr = routeStr.trim().toUpperCase();
    const parts = cleanStr.split(/[\/\-\s]+/).filter(Boolean);
    
    if (parts.length >= 3) {
      const from = parts[0];
      const to = parts[parts.length - 1];
      const transit = parts.slice(1, parts.length - 1).join('/');
      return { from, transit, to };
    }
    if (parts.length === 2) return { from: parts[0], transit: '', to: parts[1] };
    if (parts.length === 1) return { from: parts[0], transit: '', to: '' };
    return { from: cleanStr, transit: '', to: '' };
  };

  const isAirAmbulance = (record: any) => {
    const text = `${record.comments || ''} ${record.medicalEmergency || ''}`.toUpperCase();
    return text.includes('AMBULANCE') || text.includes('MEDICAL');
  };

  const getKg = (val: string) => {
    if (!val) return 0;
    const parts = String(val).split('/');
    return Number(parts[1]) || 0;
  };

  const filteredRamp = useMemo(() => {
    return rampReports.filter(filterByDate).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [rampReports, filterByDate]);

  const nonAirAmbulanceRamp = useMemo(() => {
    return filteredRamp.filter(r => !isAirAmbulance(r));
  }, [filteredRamp]);

  const dfisTotals = useMemo(() => {
    let paxInAdult = 0, paxInInf = 0, paxInLocal = 0, paxInForeign = 0, paxInTotal = 0;
    let paxOutAdult = 0, paxOutInf = 0, paxOutLocal = 0, paxOutForeign = 0, paxOutTotal = 0;
    let paxTransAdult = 0, paxTransInf = 0;
    let mailIn = 0, mailOut = 0, mailTrans = 0, cargoIn = 0, cargoOut = 0, cargoTrans = 0;
    let otherIn = 0, otherOut = 0, otherTrans = 0, bagIn = 0, bagOut = 0, bagTrans = 0, mvmnts = 0;

    filteredRamp.forEach(r => {
      paxInAdult += Number(r.paxInAdult) || 0; paxInInf += Number(r.paxInInf) || 0;
      paxInLocal += Number(r.paxInLocal) || 0; paxInForeign += Number(r.paxInForeign) || 0;
      paxInTotal += Number(r.paxInTotal) || 0;
      paxOutAdult += Number(r.paxOutAdult) || 0; paxOutInf += Number(r.paxOutInf) || 0;
      paxOutLocal += Number(r.paxOutLocal) || 0; paxOutForeign += Number(r.paxOutForeign) || 0;
      paxOutTotal += Number(r.paxOutTotal) || 0;
      paxTransAdult += Number(r.paxTransAdult) || 0; paxTransInf += Number(r.paxTransInf) || 0;
      mailIn += getKg(r.mailIn); mailOut += getKg(r.mailOut); mailTrans += getKg(r.mailTrans);
      cargoIn += getKg(r.cargoIn); cargoOut += getKg(r.cargoOut); cargoTrans += getKg(r.cargoTrans);
      otherIn += getKg(r.otherIn); otherOut += getKg(r.otherOut); otherTrans += getKg(r.otherTrans);
      bagIn += getKg(r.bagIn); bagOut += getKg(r.bagOut); bagTrans += getKg(r.bagTrans);
      mvmnts += 2;
    });

    return { paxInAdult, paxInInf, paxInLocal, paxInForeign, paxInTotal, paxOutAdult, paxOutInf, paxOutLocal, paxOutForeign, paxOutTotal, paxTransAdult, paxTransInf, mailIn, mailOut, mailTrans, cargoIn, cargoOut, cargoTrans, otherIn, otherOut, otherTrans, bagIn, bagOut, bagTrans, mvmnts };
  }, [filteredRamp]);

  const statsData = useMemo(() => {
    return nonAirAmbulanceRamp.map(r => ({
      date: r.date, operator: 'MALDIVIAN', aircraft: r.acType, mvmts: 2,
      paxInAdult: Number(r.paxInAdult) || 0, paxInInf: Number(r.paxInInf) || 0,
      paxOutAdult: Number(r.paxOutAdult) || 0, paxOutInf: Number(r.paxOutInf) || 0,
      cargoIn: getKg(r.cargoIn), cargoOut: getKg(r.cargoOut), mailIn: getKg(r.mailIn), mailOut: getKg(r.mailOut),
    }));
  }, [nonAirAmbulanceRamp]);

  const statsTotals = useMemo(() => {
    return statsData.reduce((acc, curr) => ({
      mvmts: acc.mvmts + curr.mvmts, paxInAdult: acc.paxInAdult + curr.paxInAdult, paxInInf: acc.paxInInf + curr.paxInInf,
      paxOutAdult: acc.paxOutAdult + curr.paxOutAdult, paxOutInf: acc.paxOutInf + curr.paxOutInf,
      cargoIn: acc.cargoIn + curr.cargoIn, cargoOut: acc.cargoOut + curr.cargoOut,
      mailIn: acc.mailIn + curr.mailIn, mailOut: acc.mailOut + curr.mailOut,
    }), { mvmts: 0, paxInAdult: 0, paxInInf: 0, paxOutAdult: 0, paxOutInf: 0, cargoIn: 0, cargoOut: 0, mailIn: 0, mailOut: 0 });
  }, [statsData]);

  const trafficData = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    nonAirAmbulanceRamp.forEach(r => {
      const month = (r.date || '').substring(0, 7);
      if (!month) return;
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(r);
    });

    const result = Object.entries(grouped).map(([month, records]) => {
      const types = ['DASH-8/200', 'DH-8/200', 'DASH-8/300', 'DH-8/300', 'ATR-72/600', 'ATR-42/600'];
      const rows = types.map(type => {
        const filtered = records.filter(r => r.acType === type);
        return {
          type, mvmts: filtered.length * 2,
          paxInAdult: filtered.reduce((sum, r) => sum + (Number(r.paxInAdult) || 0), 0),
          paxInInf: filtered.reduce((sum, r) => sum + (Number(r.paxInInf) || 0), 0),
          paxOutAdult: filtered.reduce((sum, r) => sum + (Number(r.paxOutAdult) || 0), 0),
          paxOutInf: filtered.reduce((sum, r) => sum + (Number(r.paxOutInf) || 0), 0),
          mailIn: filtered.reduce((sum, r) => sum + getKg(r.mailIn), 0),
          mailOut: filtered.reduce((sum, r) => sum + getKg(r.mailOut), 0),
          cargoIn: filtered.reduce((sum, r) => sum + getKg(r.cargoIn), 0),
          cargoOut: filtered.reduce((sum, r) => sum + getKg(r.cargoOut), 0),
        };
      }).filter(r => r.mvmts > 0);
      return { month, rows };
    }).sort((a, b) => b.month.localeCompare(a.month));
    return result;
  }, [nonAirAmbulanceRamp]);

  const thStyle = { textAlign: 'center' as const, verticalAlign: 'middle' as const, fontSize: '5.5px', padding: '2px 1px', lineHeight: '1.1' };
  const tdStyle = { textAlign: 'center' as const, verticalAlign: 'middle' as const, fontSize: '5.5px', padding: '1px' };

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>📊 Operations Reports</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            <option value="1">100%</option>
            <option value="0.75">75%</option>
            <option value="0.5">50%</option>
          </select>
          <button className="add-staff-btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={handleSaveReport}>💾 Save Report</button>
          <button className="add-staff-btn" style={{ background: '#16a34a', color: 'white' }} onClick={handlePrint}>🖨️ Print / PDF</button>
        </div>
      </div>

      <div className="dash-card no-print" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <strong>Filter:</strong>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            <option value="">All Months</option>
            {MONTHS.map(m => <option key={m.val} value={m.val}>{m.name}</option>)}
          </select>
          <span style={{ color: '#94a3b8' }}>|</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
          <span>to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
          <button className="quick-btn" onClick={handleClearFilter} style={{ background: '#f1f5f9', color: '#475569' }}>Clear Filter</button>
        </div>
      </div>

      <div className="ops-tabs no-print" style={{ marginBottom: '24px' }}>
        {TABS.map(tab => (
          <button key={tab} className={`ops-tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'DFIS' ? '📋 DFIS' : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">Loading report data...</div>
      ) : (
        <div className="dash-card" style={{ overflowX: 'auto', zoom: zoom }}>
          
          {activeTab === 'DFIS' && (
            <div className="dfis-print-table">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src="/racl-logo.png" alt="RACL" style={{ height: '50px', marginBottom: '8px' }} />
                <h2 style={{ margin: 0, fontSize: '18px', textTransform: 'uppercase' }}>AIRCRAFT TURNAROUND LOG</h2>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Funadhoo Airport</h3>
              </div>

              <table className="mini-table" style={{ fontSize: '10px', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th rowSpan={2} style={thStyle}>S.No.</th>
                    <th rowSpan={2} style={thStyle}>Date</th>
                    <th rowSpan={2} style={thStyle}>CHECK-IN<br/>Started</th>
                    <th colSpan={2} style={thStyle}>Reg.</th>
                    <th rowSpan={2} style={thStyle}>Type of<br/>Aircraft</th>
                    <th rowSpan={2} style={thStyle}>Owner<br/>or<br/>Operator</th>
                    <th colSpan={3} style={thStyle}>Arrivals</th>
                    <th colSpan={3} style={thStyle}>Route</th>
                    <th colSpan={2} style={thStyle}>Departures</th>
                    <th rowSpan={2} style={thStyle}>Mvmnts</th>
                    <th colSpan={5} style={thStyle}>PAX IN</th>
                    <th colSpan={5} style={thStyle}>PAX OUT</th>
                    <th colSpan={2} style={thStyle}>TRANSIT</th>
                    <th colSpan={3} style={thStyle}>MAIL</th>
                    <th colSpan={3} style={thStyle}>CARGO</th>
                    <th colSpan={3} style={thStyle}>OTHERS</th>
                    <th colSpan={3} style={thStyle}>BAGGAGE</th>
                    <th rowSpan={2} style={thStyle}>Data Collected by</th>
                    <th rowSpan={2} style={thStyle}>Remarks</th>
                  </tr>
                  <tr>
                    <th style={thStyle}>Prefix</th><th style={thStyle}>Suffix</th>
                    <th style={thStyle}>Flight No.</th><th style={thStyle}>ETA</th><th style={thStyle}>ATA</th>
                    <th style={thStyle}>From</th><th style={thStyle}>Transit</th><th style={thStyle}>To</th>
                    <th style={thStyle}>Flight No.</th><th style={thStyle}>Time (DT)</th>
                    <th style={thStyle}>Adult</th><th style={thStyle}>Inft.</th><th style={thStyle}>Local</th><th style={thStyle}>Foreign</th><th style={thStyle}>Total</th>
                    <th style={thStyle}>Adult</th><th style={thStyle}>Inft.</th><th style={thStyle}>Local</th><th style={thStyle}>Foreign</th><th style={thStyle}>Total</th>
                    <th style={thStyle}>Adult</th><th style={thStyle}>Inft.</th>
                    <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                    <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                    <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                    <th style={thStyle}>In(kg)</th><th style={thStyle}>Out(kg)</th><th style={thStyle}>Tran(kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRamp.map((r, index) => {
                    const routeParts = parseRoute(r.route);
                    const acRegParts = (r.acReg || '8Q-').split('-');
                    const isAmbulance = isAirAmbulance(r);
                    const bgColor = AIRCRAFT_COLORS[r.acType] || '#fff';
                    
                    return (
                      <tr 
                        key={r.id} 
                        style={{ 
                          backgroundColor: bgColor,
                          color: isAmbulance ? '#dc2626' : 'inherit',
                          fontWeight: isAmbulance ? 700 : 400
                        }}
                      >
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{r.date}</td>
                        <td style={tdStyle}>{r.checkIn || '-'}</td>
                        <td style={tdStyle}>{acRegParts[0]}</td>
                        <td style={tdStyle}>{acRegParts[1] || ''}</td>
                        <td style={tdStyle}>{r.acType}</td>
                        <td style={tdStyle}>Island Aviations Services</td>
                        
                        <td style={tdStyle}>{r.fltNo || '-'}</td>
                        <td style={tdStyle}>{r.eta || '-'}</td>
                        <td style={tdStyle}>{r.ata || '-'}</td>
                        
                        <td style={tdStyle}>{routeParts.from}</td>
                        <td style={tdStyle}>{routeParts.transit}</td>
                        <td style={tdStyle}>{routeParts.to}</td>
                        
                        <td style={tdStyle}>{r.fltNo ? String(r.fltNo).replace('Q2', 'Q3') : '-'}</td>
                        <td style={tdStyle}>{r.atd || r.sta || '-'}</td>
                        <td style={tdStyle}>2</td>
                        
                        <td style={tdStyle}>{r.paxInAdult || '0'}</td>
                        <td style={tdStyle}>{r.paxInInf || '0'}</td>
                        <td style={tdStyle}>{r.paxInLocal || '0'}</td>
                        <td style={tdStyle}>{r.paxInForeign || '0'}</td>
                        <td style={tdStyle}>{r.paxInTotal || '0'}</td>
                        
                        <td style={tdStyle}>{r.paxOutAdult || '0'}</td>
                        <td style={tdStyle}>{r.paxOutInf || '0'}</td>
                        <td style={tdStyle}>{r.paxOutLocal || '0'}</td>
                        <td style={tdStyle}>{r.paxOutForeign || '0'}</td>
                        <td style={tdStyle}>{r.paxOutTotal || '0'}</td>
                        
                        <td style={tdStyle}>{r.paxTransAdult || '0'}</td>
                        <td style={tdStyle}>{r.paxTransInf || '0'}</td>
                        
                        <td style={tdStyle}>{r.mailIn || '0'}</td>
                        <td style={tdStyle}>{r.mailOut || '0'}</td>
                        <td style={tdStyle}>{r.mailTrans || '0'}</td>
                        
                        <td style={tdStyle}>{r.cargoIn || '0'}</td>
                        <td style={tdStyle}>{r.cargoOut || '0'}</td>
                        <td style={tdStyle}>{r.cargoTrans || '0'}</td>
                        
                        <td style={tdStyle}>{r.otherIn || '0'}</td>
                        <td style={tdStyle}>{r.otherOut || '0'}</td>
                        <td style={tdStyle}>{r.otherTrans || '0'}</td>
                        
                        <td style={tdStyle}>{r.bagIn || '0'}</td>
                        <td style={tdStyle}>{r.bagOut || '0'}</td>
                        <td style={tdStyle}>{r.bagTrans || '0'}</td>
                        
                        <td style={tdStyle}>{getStaffName(r.checkedBy) || '-'}</td>
                        
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {r.comments || r.medicalEmergency || 'NIL'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRamp.length > 0 && (
                    <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 700 }}>
                      <td colSpan={15} style={{ textAlign: 'right', fontSize: '5.5px', padding: '1px' }}>Total:</td>
                      <td style={tdStyle}>{dfisTotals.mvmnts}</td>
                      <td style={tdStyle}>{dfisTotals.paxInAdult}</td>
                      <td style={tdStyle}>{dfisTotals.paxInInf}</td>
                      <td style={tdStyle}>{dfisTotals.paxInLocal}</td>
                      <td style={tdStyle}>{dfisTotals.paxInForeign}</td>
                      <td style={tdStyle}>{dfisTotals.paxInTotal}</td>
                      <td style={tdStyle}>{dfisTotals.paxOutAdult}</td>
                      <td style={tdStyle}>{dfisTotals.paxOutInf}</td>
                      <td style={tdStyle}>{dfisTotals.paxOutLocal}</td>
                      <td style={tdStyle}>{dfisTotals.paxOutForeign}</td>
                      <td style={tdStyle}>{dfisTotals.paxOutTotal}</td>
                      <td style={tdStyle}>{dfisTotals.paxTransAdult}</td>
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
                      <td style={tdStyle}>{dfisTotals.bagIn}</td>
                      <td style={tdStyle}>{dfisTotals.bagOut}</td>
                      <td style={tdStyle}>{dfisTotals.bagTrans}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Statistics' && (
            <div style={{ padding: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>FUNADHOO AIRPORT</h2>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Statistics Report</h3>
              </div>

              <table className="mini-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Date</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Operator</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Type of Aircraft</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>No. of Mvts</th>
                    <th colSpan={2} style={{ textAlign: 'center' }}>Pax In</th>
                    <th colSpan={2} style={{ textAlign: 'center' }}>Pax Out</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Cargo In (kg)</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Cargo Out (kg)</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Mail In (kg)</th>
                    <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Mail Out (kg)</th>
                  </tr>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Adult</th><th style={{ textAlign: 'center' }}>Infant</th>
                    <th style={{ textAlign: 'center' }}>Adult</th><th style={{ textAlign: 'center' }}>Infant</th>
                  </tr>
                </thead>
                <tbody>
                  {statsData.map((r, idx) => {
                    const bgColor = AIRCRAFT_COLORS[r.aircraft] || '#fff';
                    return (
                      <tr key={idx} style={{ backgroundColor: bgColor }}>
                        <td style={{ textAlign: 'center' }}>{r.date}</td>
                        <td style={{ textAlign: 'center' }}>{r.operator}</td>
                        <td style={{ textAlign: 'center' }}>{r.aircraft}</td>
                        <td style={{ textAlign: 'center' }}>{r.mvmts}</td>
                        <td style={{ textAlign: 'center' }}>{r.paxInAdult}</td>
                        <td style={{ textAlign: 'center' }}>{r.paxInInf}</td>
                        <td style={{ textAlign: 'center' }}>{r.paxOutAdult}</td>
                        <td style={{ textAlign: 'center' }}>{r.paxOutInf}</td>
                        <td style={{ textAlign: 'center' }}>{r.cargoIn}</td>
                        <td style={{ textAlign: 'center' }}>{r.cargoOut}</td>
                        <td style={{ textAlign: 'center' }}>{r.mailIn}</td>
                        <td style={{ textAlign: 'center' }}>{r.mailOut}</td>
                      </tr>
                    );
                  })}
                  {statsData.length > 0 && (
                    <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                      <td colSpan={3} style={{ textAlign: 'right' }}>Total:</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.mvmts}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.paxInAdult}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.paxInInf}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.paxOutAdult}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.paxOutInf}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.cargoIn}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.cargoOut}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.mailIn}</td>
                      <td style={{ textAlign: 'center' }}>{statsTotals.mailOut}</td>
                    </tr>
                  )}
                  {statsData.length === 0 && (
                    <tr><td colSpan={12} style={{ textAlign: 'center' }}>No statistics found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Traffic' && (
            <div style={{ padding: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>TRAFFIC MONTHLY REPORT</h2>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Funadhoo Airport</h3>
              </div>

              {trafficData.map((monthData, mIdx) => (
                <div key={mIdx} style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#1e293b' }}>{monthData.month}</h4>
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>S. No.</th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Owner or Operator</th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Type of Aircraft</th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>No. of Movements</th>
                        <th colSpan={2} style={{ textAlign: 'center' }}>PAX IN</th>
                        <th colSpan={2} style={{ textAlign: 'center' }}>PAX OUT</th>
                        <th colSpan={2} style={{ textAlign: 'center' }}>MAIL (Kgs)</th>
                        <th colSpan={2} style={{ textAlign: 'center' }}>CARGO (Kgs)</th>
                      </tr>
                      <tr>
                        <th style={{ textAlign: 'center' }}>Adult</th><th style={{ textAlign: 'center' }}>Infant</th>
                        <th style={{ textAlign: 'center' }}>Adult</th><th style={{ textAlign: 'center' }}>Infant</th>
                        <th style={{ textAlign: 'center' }}>IN</th><th style={{ textAlign: 'center' }}>OUT</th>
                        <th style={{ textAlign: 'center' }}>IN</th><th style={{ textAlign: 'center' }}>OUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthData.rows.map((row: any, rIdx: number) => {
                        const bgColor = AIRCRAFT_COLORS[row.type] || '#fff';
                        return (
                          <tr key={rIdx} style={{ backgroundColor: bgColor }}>
                            <td style={{ textAlign: 'center' }}>{rIdx + 1}</td>
                            <td style={{ textAlign: 'center' }}>Maldivian</td>
                            <td style={{ textAlign: 'center' }}>{row.type}</td>
                            <td style={{ textAlign: 'center' }}>{row.mvmts}</td>
                            <td style={{ textAlign: 'center' }}>{row.paxInAdult}</td>
                            <td style={{ textAlign: 'center' }}>{row.paxInInf}</td>
                            <td style={{ textAlign: 'center' }}>{row.paxOutAdult}</td>
                            <td style={{ textAlign: 'center' }}>{row.paxOutInf}</td>
                            <td style={{ textAlign: 'center' }}>{row.mailIn}</td>
                            <td style={{ textAlign: 'center' }}>{row.mailOut}</td>
                            <td style={{ textAlign: 'center' }}>{row.cargoIn}</td>
                            <td style={{ textAlign: 'center' }}>{row.cargoOut}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan={3} style={{ textAlign: 'right' }}>Total:</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.mvmts, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.paxInAdult, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.paxInInf, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.paxOutAdult, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.paxOutInf, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.mailIn, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.mailOut, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.cargoIn, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{monthData.rows.reduce((s: number, r: any) => s + r.cargoOut, 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
              {trafficData.length === 0 && (
                <div className="empty-state">No traffic data found for this period.</div>
              )}
            </div>
          )}

          {activeTab === 'Wildlife' && (
            <table className="mini-table">
              <thead><tr><th>Date</th><th>Ref No</th><th>Observer</th><th>Temp</th><th>Wind</th><th>Cloud</th><th>Species Count</th></tr></thead>
              <tbody>
                {wildlifeReports.filter(filterByDate).map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td><td>{r.refNo}</td><td>{r.observer}</td><td>{r.temp}°C</td><td>{r.wind}</td><td>{r.cloud}%</td><td>{r.rows?.length || 0}</td>
                  </tr>
                ))}
                {wildlifeReports.filter(filterByDate).length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>No records found.</td></tr>}
              </tbody>
            </table>
          )}

          {activeTab === 'FOD' && (
            <table className="mini-table">
              <thead><tr><th>Date</th><th>Grams</th><th>Remarks</th><th>Logged By</th></tr></thead>
              <tbody>
                {fodReports.filter(filterByDate).map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td><td style={{ color: '#dc2626', fontWeight: 700 }}>{r.grams}g</td><td>{r.remarks}</td><td>{r.loggedBy}</td>
                  </tr>
                ))}
                {fodReports.filter(filterByDate).length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center' }}>No records found.</td></tr>}
              </tbody>
            </table>
          )}

          {['Custom Generator', 'RWY Lights'].includes(activeTab) && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <p>Content for <strong>{activeTab}</strong> will appear here.</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default ReportsPage;