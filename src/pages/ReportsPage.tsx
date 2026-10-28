import { useState } from 'react';

const TABS = [
  'Custom Generator',
  'DFIS',
  'Wildlife',
  'FOD',
  'Statistics',
  'Traffic',
  'RWY Lights',
];

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('DFIS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // The correct Print function that triggers the CSS Landscape mode
  const handlePrint = () => {
    document.body.classList.add('printing-report');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-report'), 1000);
  };

  const handleClearFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>📊 Operations Reports</h2>
        <button 
          className="add-staff-btn" 
          style={{ background: '#16a34a', color: 'white' }} 
          onClick={handlePrint}
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div className="dash-card no-print" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <strong>Filter by Date:</strong>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)} 
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          <span>to</span>
          <input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)} 
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          <button 
            className="quick-btn" 
            onClick={handleClearFilter}
            style={{ background: '#f1f5f9', color: '#475569' }}
          >
            Clear Filter
          </button>
        </div>
      </div>

      <div className="ops-tabs no-print" style={{ marginBottom: '24px' }}>
        {TABS.map(tab => (
          <button 
            key={tab}
            className={`ops-tab-btn ${activeTab === tab ? 'active' : ''}`} 
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'DFIS' ? '📋 DFIS' : tab}
          </button>
        ))}
      </div>

      {/* 
        This is where your specific table data goes. 
        I have wrapped it in the 'dfis-print-table' class which is what 
        triggers the ultra-small font size (5.5px) for the 35+ column DFIS table.
      */}
      <div className="dash-card" style={{ overflowX: 'auto' }}>
        
        {activeTab === 'DFIS' && (
          <div className="dfis-print-table">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img src="/racl-logo.png" alt="RACL" style={{ height: '50px', marginBottom: '8px' }} />
              <h2 style={{ margin: 0, fontSize: '18px' }}>AIRCRAFT TURNAROUND LOG</h2>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Funadhoo Airport</h3>
            </div>
            
            {/* Replace this dummy table with your actual DFIS mapped table */}
            <table className="mini-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Date</th>
                  <th>CHECK-IN</th>
                  <th>Reg.</th>
                  <th>Type of Aircraft</th>
                  <th>Owner/Operator</th>
                  <th>Arrivals</th>
                  <th>Route</th>
                  <th>Departures</th>
                  <th>PAX IN</th>
                  <th>PAX OUT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>2026-10-27</td>
                  <td>08:05</td>
                  <td>8Q-IAQ</td>
                  <td>DASH-8/300</td>
                  <td>Island Aviation Services</td>
                  <td>Q2-192 (09:15)</td>
                  <td>MLE/NMF/FND</td>
                  <td>Q3-192 (09:44)</td>
                  <td>35</td>
                  <td>38</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab !== 'DFIS' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <p>Content for <strong>{activeTab}</strong> goes here.</p>
            <p style={{ fontSize: '12px' }}>Add your existing table logic for this tab inside this container.</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default ReportsPage;