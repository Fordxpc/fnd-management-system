import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const TABS = ['Custom Generator', 'DFIS', 'Wildlife', 'FOD', 'Statistics', 'Traffic', 'RWY Lights'];

// Exact pastel colors from your screenshot
const ROW_COLORS = ['#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3'];

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

  const filterByDate = useCallback((item: any) => {
    const d = item.date || item.createdAt?.split('T')[0];
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }, [dateFrom, dateTo]);

  const parseRoute = (routeStr: string) => {
    if (!routeStr) return { from: '', via: '', to: '' };
    const parts = routeStr.split('/');
    if (parts.length === 3) return { from: parts[0], via: parts[1], to: parts[2] };
    if (parts.length === 2) return { from: parts[0], via: '', to: parts[1] };
    return { from: parts[0], via: '', to: '' };
  };

  const filteredRamp = useMemo(() => rampReports.filter(filterByDate).reverse(), [rampReports, filterByDate]);

  // --- STATISTICS TAB DATA PROCESSING ---
  const statsData = useMemo(() => {
    const grouped: Record<string, { paxIn: number, paxOut: number, cargoIn: number, cargoOut: number }> = {};
    
    filteredRamp.forEach(r => {
      const month = (r.date || '').substring(0, 7);
      if (!month) return;
      if (!grouped[month]) grouped[month] = { paxIn: 0, paxOut: 0, cargoIn: 0, cargoOut: 0 };
      
      grouped[month].paxIn += Number(r.paxInTotal) || 0;
      grouped[month].paxOut += Number(r.paxOutTotal) || 0;
      
      const parseKg = (val: string) => {
        if (!val) return 0;
        const parts = String(val).split('/');
        return Number(parts[1]) || 0;
      };
      
      grouped[month].cargoIn += parseKg(r.cargoIn);
      grouped[month].cargoOut += parseKg(r.cargoOut);
    });

    return Object.entries(grouped).map(([month, data]) => ({ month, ...data })).sort((a,b) => a.month.localeCompare(b.month));
  }, [filteredRamp]);

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
          
          {/* 1. DFIS TAB - WITH COLORS RESTORED */}
          {activeTab === 'DFIS' && (
            <div className="dfis-print-table">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src="/racl-logo.png" alt="RACL" style={{ height: '50px', marginBottom: '8px' }} />
                <h2 style={{ margin: 0, fontSize: '18px', textTransform: 'uppercase' }}>AIRCRAFT TURNAROUND LOG</h2>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Funadhoo Airport</h3>
              </div>

              <table className="mini-table" style={{ fontSize: '11px', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
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
                    <th>Flight No.</th><th>ETA</th><th>ATA</th>
                    <th>From</th><th>Via</th><th>To</th>
                    <th>Flight No.</th><th>Time (DI)</th>
                    <th>Adult</th><th>Inft</th><th>Total</th>
                    <th>Adult</th><th>Inft</th><th>Total</th>
                    <th>Adult</th><th>Inft</th><th>Total</th>
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                    <th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRamp.map((r, index) => {
                    const routeParts = parseRoute(r.route);
                    const bgColor = ROW_COLORS[index % ROW_COLORS.length]; // Apply pastel colors
                    
                    return (
                      <tr key={r.id} style={{ backgroundColor: bgColor }}>
                        <td>{index + 1}</td>
                        <td>{r.date}</td>
                        <td>{r.checkIn || '—'}</td>
                        <td>{r.acReg || '—'}</td>
                        <td>{r.acType || '—'}</td>
                        <td>Island Aviation Services</td>
                        
                        <td>{r.fltNo || '—'}</td>
                        <td>{r.eta || '—'}</td>
                        <td>{r.ata || '—'}</td>
                        
                        <td>{routeParts.from}</td>
                        <td>{routeParts.via}</td>
                        <td>{routeParts.to}</td>
                        
                        <td>{r.fltNo ? r.fltNo.replace('Q2', 'Q3') : '—'}</td>
                        <td>{r.atd || r.sta || '—'}</td>
                        
                        <td>{r.paxInAdult || '0'}</td>
                        <td>{r.paxInInf || '0'}</td>
                        <td>{r.paxInTotal || '0'}</td>
                        
                        <td>{r.paxOutAdult || '0'}</td>
                        <td>{r.paxOutInf || '0'}</td>
                        <td>{r.paxOutTotal || '0'}</td>
                        
                        <td>{r.paxTransAdult || '0'}</td>
                        <td>{r.paxTransInf || '0'}</td>
                        <td>{r.paxTransTotal || '0'}</td>
                        
                        <td>{r.mailIn || '0 / 0'}</td>
                        <td>{r.mailOut || '0 / 0'}</td>
                        <td>{r.mailTrans || '0 / 0'}</td>
                        
                        <td>{r.cargoIn || '0 / 0'}</td>
                        <td>{r.cargoOut || '0 / 0'}</td>
                        <td>{r.cargoTrans || '0 / 0'}</td>
                        
                        <td>{r.otherIn || '0 / 0'}</td>
                        <td>{r.otherOut || '0 / 0'}</td>
                        <td>{r.otherTrans || '0 / 0'}</td>
                        
                        <td>{r.bagIn || '0 / 0'}</td>
                        <td>{r.bagOut || '0 / 0'}</td>
                        <td>{r.bagTrans || '0 / 0'}</td>
                        
                        <td style={{ whiteSpace: 'normal', minWidth: '150px' }}>{r.comments || ''}</td>
                      </tr>
                    );
                  })}
                  {filteredRamp.length === 0 && (
                    <tr><td colSpan={32} style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 2. STATISTICS TAB - WITH CHARTS */}
          {activeTab === 'Statistics' && (
            <div style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '20px', color: '#1e293b' }}>Monthly Statistics</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', breakInside: 'avoid' }}>
                  <h4 style={{ textAlign: 'center', marginBottom: '15px' }}>Total PAX</h4>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={statsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="paxIn" name="PAX IN" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="paxOut" name="PAX OUT" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', breakInside: 'avoid' }}>
                  <h4 style={{ textAlign: 'center', marginBottom: '15px' }}>Total Cargo (KG)</h4>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={statsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cargoIn" name="Cargo IN (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cargoOut" name="Cargo OUT (kg)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. TRAFFIC TAB - SUMMARY TABLE */}
          {activeTab === 'Traffic' && (
            <div style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '20px', color: '#1e293b' }}>Flight Traffic Summary</h3>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Flights</th>
                    <th>Total PAX IN</th>
                    <th>Total PAX OUT</th>
                    <th>Total PAX</th>
                  </tr>
                </thead>
                <tbody>
                  {statsData.map(stat => (
                    <tr key={stat.month}>
                      <td><strong>{stat.month}</strong></td>
                      <td style={{ textAlign: 'center' }}>{filteredRamp.filter(r => r.date?.startsWith(stat.month)).length}</td>
                      <td style={{ textAlign: 'center' }}>{stat.paxIn}</td>
                      <td style={{ textAlign: 'center' }}>{stat.paxOut}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{stat.paxIn + stat.paxOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. WILDLIFE TAB */}
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

          {/* 5. FOD TAB */}
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

          {/* Placeholders for remaining tabs */}
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