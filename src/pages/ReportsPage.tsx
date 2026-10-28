import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

const TABS = ['Custom Generator', 'DFIS', 'Wildlife', 'FOD', 'Statistics', 'Traffic', 'RWY Lights'];

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('DFIS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [rampReports, setRampReports] = useState<any[]>([]);
  const [wildlifeReports, setWildlifeReports] = useState<any[]>([]);
  const [fodReports, setFodReports] = useState<any[]>([]);

  const fetchAllData = useCallback(async () => {
    try {
      const [ramp, wildlife, fod] = await Promise.allSettled([
        apiFetch('/ramp/reports'),
        apiFetch('/wildlife'),
        apiFetch('/fod')
      ]);
      
      if (ramp.status === 'fulfilled') setRampReports(ramp.value);
      if (wildlife.status === 'fulfilled') setWildlifeReports(wildlife.value);
      if (fod.status === 'fulfilled') setFodReports(fod.value);
      
      setLoading(false);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    // Poll every 15 seconds to automatically update when a Ramp Sheet is saved
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handlePrint = () => {
    document.body.classList.add('printing-report');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-report'), 1000);
  };

  const handleClearFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const filterByDate = (item: any) => {
    const d = item.date || item.createdAt?.split('T')[0];
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  // Helper to split route (e.g. MLE/FND/MLE) into From, Via, To
  const parseRoute = (routeStr: string) => {
    if (!routeStr) return { from: '', via: '', to: '' };
    const parts = routeStr.split('/');
    if (parts.length === 3) return { from: parts[0], via: parts[1], to: parts[2] };
    if (parts.length === 2) return { from: parts[0], via: '', to: parts[1] };
    return { from: parts[0], via: '', to: '' };
  };

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>📊 Operations Reports</h2>
        <button className="add-staff-btn" style={{ background: '#16a34a', color: 'white' }} onClick={handlePrint}>
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div className="dash-card no-print" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <strong>Filter by Date:</strong>
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
        <div className="dash-card" style={{ overflowX: 'auto' }}>
          
          {/* DFIS TAB (Aircraft Turnaround Log) - Exact Layout from screenshot */}
          {activeTab === 'DFIS' && (
            <div className="dfis-print-table">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src="/racl-logo.png" alt="RACL" style={{ height: '50px', marginBottom: '8px' }} />
                <h2 style={{ margin: 0, fontSize: '18px', textTransform: 'uppercase' }}>AIRCRAFT TURNAROUND LOG</h2>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Funadhoo Airport</h3>
              </div>

              <table className="mini-table" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th rowSpan={2}>S.No.</th>
                    <th rowSpan={2}>Date</th>
                    <th rowSpan={2}>CHECK-IN</th>
                    <th rowSpan={2}>Reg.</th>
                    <th rowSpan={2}>Type of Aircraft</th>
                    <th rowSpan={2}>Owner/Operator</th>
                    <th colSpan={3}>Arrivals</th>
                    <th colSpan={3}>Route</th>
                    <th colSpan={2}>Departures</th>
                    <th colSpan={3}>PAX IN</th>
                    <th colSpan={3}>PAX OUT</th>
                    <th colSpan={3}>TRANSIT</th>
                    <th colSpan={3}>MAIL</th>
                    <th colSpan={3}>CARGO</th>
                    <th colSpan={3}>OTHERS</th>
                    <th colSpan={3}>BAGGAGE</th>
                    <th rowSpan={2}>Comments</th>
                  </tr>
                  <tr>
                    {/* Arrivals */}
                    <th>Flight No.</th><th>ETA</th><th>ATA</th>
                    {/* Route */}
                    <th>From</th><th>Via</th><th>To</th>
                    {/* Departures */}
                    <th>Flight No.</th><th>Time (DI)</th>
                    {/* PAX IN */}
                    <th>Adult</th><th>Inft</th><th>Total</th>
                    {/* PAX OUT */}
                    <th>Adult</th><th>Inft</th><th>Total</th>
                    {/* TRANSIT */}
                    <th>Adult</th><th>Inft</th><th>Total</th>
                    {/* MAIL */}
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                    {/* CARGO */}
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                    {/* OTHERS */}
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                    {/* BAGGAGE */}
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {rampReports.filter(filterByDate).map((r, index) => {
                    const routeParts = parseRoute(r.route);
                    return (
                      <tr key={r.id}>
                        <td>{index + 1}</td>
                        <td>{r.date}</td>
                        <td>{r.checkIn || '—'}</td>
                        <td>{r.acReg || '—'}</td>
                        <td>{r.acType || '—'}</td>
                        <td>Island Aviation Services</td>
                        
                        {/* Arrivals */}
                        <td>{r.fltNo || '—'}</td>
                        <td>{r.eta || '—'}</td>
                        <td>{r.ata || '—'}</td>
                        
                        {/* Route */}
                        <td>{routeParts.from}</td>
                        <td>{routeParts.via}</td>
                        <td>{routeParts.to}</td>
                        
                        {/* Departures */}
                        <td>{r.fltNo ? r.fltNo.replace('Q2', 'Q3') : '—'}</td> {/* Assumption: Outbound flight uses Q3 */}
                        <td>{r.atd || r.sta || '—'}</td>
                        
                        {/* PAX IN */}
                        <td>{r.paxInAdult || '0'}</td>
                        <td>{r.paxInInf || '0'}</td>
                        <td>{r.paxInTotal || '0'}</td>
                        
                        {/* PAX OUT */}
                        <td>{r.paxOutAdult || '0'}</td>
                        <td>{r.paxOutInf || '0'}</td>
                        <td>{r.paxOutTotal || '0'}</td>
                        
                        {/* TRANSIT */}
                        <td>{r.paxTransAdult || '0'}</td>
                        <td>{r.paxTransInf || '0'}</td>
                        <td>{r.paxTransTotal || '0'}</td>
                        
                        {/* MAIL */}
                        <td>{r.mailIn || '0 / 0'}</td>
                        <td>{r.mailOut || '0 / 0'}</td>
                        <td>{r.mailTrans || '0 / 0'}</td>
                        
                        {/* CARGO */}
                        <td>{r.cargoIn || '0 / 0'}</td>
                        <td>{r.cargoOut || '0 / 0'}</td>
                        <td>{r.cargoTrans || '0 / 0'}</td>
                        
                        {/* OTHERS */}
                        <td>{r.otherIn || '0 / 0'}</td>
                        <td>{r.otherOut || '0 / 0'}</td>
                        <td>{r.otherTrans || '0 / 0'}</td>
                        
                        {/* BAGGAGE */}
                        <td>{r.bagIn || '0 / 0'}</td>
                        <td>{r.bagOut || '0 / 0'}</td>
                        <td>{r.bagTrans || '0 / 0'}</td>
                        
                        <td>{r.comments || ''}</td>
                      </tr>
                    );
                  })}
                  {rampReports.filter(filterByDate).length === 0 && (
                    <tr><td colSpan={32} style={{ textAlign: 'center' }}>No records found for this date range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* WILDLIFE TAB */}
          {activeTab === 'Wildlife' && (
            <table className="mini-table">
              <thead>
                <tr><th>Date</th><th>Ref No</th><th>Observer</th><th>Temp</th><th>Wind</th><th>Cloud</th><th>Species Count</th></tr>
              </thead>
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

          {/* FOD TAB */}
          {activeTab === 'FOD' && (
            <table className="mini-table">
              <thead>
                <tr><th>Date</th><th>Grams</th><th>Remarks</th><th>Logged By</th></tr>
              </thead>
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

          {['Custom Generator', 'Statistics', 'Traffic', 'RWY Lights'].includes(activeTab) && (
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