import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import RampReportsPage from './RampReportsPage'; // Import the reports page
import '../styles/RampCheck.css';

const DEFAULT_AC_TYPES = ['ATR-42/600', 'ATR-72/600', 'A320', 'A321', 'B737-800', 'DASH-8/300', 'DASH-8/200'];
const DEFAULT_ROUTE_CODES = ['MLE', 'FND', 'HRF', 'NMF', 'HAQ'];

const INITIAL_FORM = {
  acType: '', fltNo: 'Q2-', ata: '', sta: '', date: '', eta: '', atd: '',
  chocksStart: '', chocksStop: '', paxOffStart: '', paxOffStop: '', paxOnStart: '', paxOnStop: '',
  cleanStart: '', cleanStop: '', bagOnStart: '', bagOnStop: '', bagOffStart: '', bagOffStop: '',
  boarding: '', doorStart: '', doorStop: '', startup: '', checkIn: '', route: '', acReg: '8Q-',
  paxInAdult: '', paxInInf: '', paxInLocal: '', paxInForeign: '', paxInTotal: '',
  paxOutAdult: '', paxOutInf: '', paxOutLocal: '', paxOutForeign: '', paxOutTotal: '',
  paxTransAdult: '', paxTransInf: '', paxTransTotal: '',
  cargoIn: '', cargoOut: '', cargoTrans: '', mailIn: '', mailOut: '', mailTrans: '',
  bagIn: '', bagOut: '', bagTrans: '', otherIn: '', otherOut: '', otherTrans: '',
  specialLoad: '', comments: '', delayTime: '', medicalEmergency: ''
};

function RampCheckSheetPage() {
  const { profile } = useAuth();
  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  
  const [activeSubTab, setActiveSubTab] = useState<'form' | 'reports'>('form');
  const [formData, setFormData] = useState<Record<string, string>>(INITIAL_FORM);
  const [acTypes, setAcTypes] = useState<string[]>([]);
  const [routeCodes, setRouteCodes] = useState<string[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  const typingTimer = useRef<any>(null);

  // Load Dropdowns
  useEffect(() => {
    const savedAc = JSON.parse(localStorage.getItem('acTypes') || '[]');
    setAcTypes([...new Set([...DEFAULT_AC_TYPES, ...savedAc])]);

    const savedRoutes = JSON.parse(localStorage.getItem('routeCodes') || '[]');
    setRouteCodes([...new Set([...DEFAULT_ROUTE_CODES, ...savedRoutes])]);
  }, []);

  // Live Sync Listener
  useEffect(() => {
    const liveDoc = doc(db, 'ramp_live_draft', 'current');
    const unsub = onSnapshot(liveDoc, (docSnap) => {
      if (docSnap.exists() && !isManager) {
        setFormData(prev => ({ ...prev, ...docSnap.data() }));
      } else if (docSnap.exists() && isManager) {
        if (!typingTimer.current) {
          setFormData(prev => ({ ...prev, ...docSnap.data() }));
        }
      }
    });
    return () => unsub();
  }, [isManager]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isManager) return;
    const { id, value } = e.target;
    let finalValue = value;

    if (id === 'fltNo' && !finalValue.startsWith('Q2-')) finalValue = 'Q2-' + finalValue.replace(/^Q2-?/i, '');
    if (id === 'acReg' && !finalValue.startsWith('8Q-')) finalValue = '8Q-' + finalValue.replace(/^8Q-?/i, '');

    setFormData(prev => {
      const updated = { ...prev, [id]: finalValue };
      
      if (id.includes('paxIn')) {
        const a = parseInt(updated.paxInAdult) || 0;
        const i = parseInt(updated.paxInInf) || 0;
        const f = parseInt(updated.paxInForeign) || 0;
        updated.paxInTotal = String(a + i);
        updated.paxInLocal = String((a + i) - f);
      }
      if (id.includes('paxOut')) {
        const a = parseInt(updated.paxOutAdult) || 0;
        const i = parseInt(updated.paxOutInf) || 0;
        const f = parseInt(updated.paxOutForeign) || 0;
        updated.paxOutTotal = String(a + i);
        updated.paxOutLocal = String((a + i) - f);
      }
      if (id.includes('paxTrans')) {
        const a = parseInt(updated.paxTransAdult) || 0;
        const i = parseInt(updated.paxTransInf) || 0;
        updated.paxTransTotal = String(a + i);
      }
      return updated;
    });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'ramp_live_draft', 'current'), { ...formData, [id]: finalValue }, { merge: true });
      } catch (err) { console.error(err); }
      typingTimer.current = null;
    }, 800);
  };

  const handleAddAcType = () => {
    const newType = prompt('Enter new A/C Type:');
    if (newType) {
      const t = newType.trim().toUpperCase();
      const updated = [...new Set([...acTypes, t])];
      setAcTypes(updated);
      localStorage.setItem('acTypes', JSON.stringify(updated));
      setFormData(prev => ({ ...prev, acType: t }));
    }
  };

  const handleAddRoute = () => {
    const newCode = prompt('Enter Airport Code:');
    if (newCode) {
      const c = newCode.trim().toUpperCase();
      const updated = [...new Set([...routeCodes, c])];
      setRouteCodes(updated);
      localStorage.setItem('routeCodes', JSON.stringify(updated));
    }
  };

  const appendRoute = (code: string) => {
    if (!code) return;
    setFormData(prev => {
      let current = prev.route || '';
      if (current && !current.endsWith('/')) current += '/';
      return { ...prev, route: current + code + '/' };
    });
  };

  const handleSave = async () => {
    if (!isManager) return;
    try {
      const payload = { ...formData, createdAt: new Date().toISOString() };
      if (currentDocId) {
        await setDoc(doc(db, 'ramp_inspections', currentDocId), payload);
        toast.success('Record updated!');
      } else {
        const ref = await addDoc(collection(db, 'ramp_inspections'), payload);
        setCurrentDocId(ref.id);
        toast.success('Record saved!');
      }
      await setDoc(doc(db, 'ramp_live_draft', 'current'), {}); 
    } catch (err: any) { toast.error(err.message); }
  };

  const handleReset = () => {
    if (!isManager) return;
    setFormData(INITIAL_FORM);
    setCurrentDocId(null);
    setDoc(doc(db, 'ramp_live_draft', 'current'), {});
    toast.success('Form cleared');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>✈️ Flight Operation</h2>
      </div>

      {/* Sub Tabs */}
      <div className="ops-tabs">
        <button 
          className={`ops-tab-btn ${activeSubTab === 'form' ? 'active' : ''}`} 
          onClick={() => setActiveSubTab('form')}
        >
          📝 Ramp Supervisor Check Sheet
        </button>
        <button 
          className={`ops-tab-btn ${activeSubTab === 'reports' ? 'active' : ''}`} 
          onClick={() => setActiveSubTab('reports')}
        >
          📁 Saved Reports
        </button>
      </div>

      {/* TAB 1: FILLABLE SHEET */}
      {activeSubTab === 'form' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
            {isManager && (
              <>
                <button className="quick-btn" style={{ background: '#2563eb', color: 'white' }} onClick={handleSave}>💾 Save Record</button>
                <button className="quick-btn" style={{ background: '#dcfce7', color: '#166534' }} onClick={handlePrint}>🖨️ Print / PDF</button>
                <button className="quick-btn" style={{ background: '#f1f5f9', color: '#334155' }} onClick={handleReset}>➕ New Record</button>
              </>
            )}
            {!isManager && <span style={{ color: '#dc2626', fontWeight: 600, alignSelf: 'center' }}>🔒 View Only (Live Sync)</span>}
          </div>

          <div className="ramp-container">
            <div className="ramp-sheet">
              <div className="flight-form">
                <div className="company-header">
                  <img src="/racl-logo.png" alt="RACL Logo" />
                  <div className="company-title">Regional Airports Company Limited</div>
                  <div className="company-subtitle">Funadhoo Airport</div>
                  <div className="company-unit-text">Ramp Services Unit</div>
                  <div className="company-unit-text">Air Traffic Control and Safety Management Section</div>
                </div>
                <div className="title">FLIGHT OPERATION INFORMATION</div>

                <div className="main-grid">
                  <div>
                    <div className="header-row">
                      <span className="header-label">A/C TYPE:</span>
                      <div className="ac-type-wrapper">
                        <input className="header-value" id="acType" type="text" list="acTypeOptions" value={formData.acType} onChange={handleChange} readOnly={!isManager} />
                        {isManager && <button type="button" className="btn-plus" onClick={handleAddAcType}>➕</button>}
                      </div>
                      <datalist id="acTypeOptions">{acTypes.map(t => <option key={t} value={t} />)}</datalist>
                    </div>
                    <div className="header-row"><span className="header-label">FLT.NO :</span><input className="header-value" id="fltNo" type="text" value={formData.fltNo} onChange={handleChange} readOnly={!isManager} /></div>
                    <div className="header-row"><span className="header-label">ATA:</span><input className="header-value" id="ata" type="text" value={formData.ata} onChange={handleChange} readOnly={!isManager} /></div>
                    <div className="header-row"><span className="header-label">STA:</span><input className="header-value" id="sta" type="text" value={formData.sta} onChange={handleChange} readOnly={!isManager} /></div>

                    <table className="inner-table" style={{ marginTop: '15px' }}>
                      <thead><tr><th colSpan={3}>IN BOUND</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                      <tbody>
                        <tr><td>CHOCKS</td><td><input type="text" id="chocksStart" value={formData.chocksStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="chocksStop" value={formData.chocksStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>PAX OFF</td><td><input type="text" id="paxOffStart" value={formData.paxOffStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="paxOffStop" value={formData.paxOffStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>PAX ON</td><td><input type="text" id="paxOnStart" value={formData.paxOnStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="paxOnStop" value={formData.paxOnStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>CLEANING</td><td><input type="text" id="cleanStart" value={formData.cleanStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="cleanStop" value={formData.cleanStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="header-row"><span className="header-label">DATE :</span><input className="header-value" id="date" type="date" value={formData.date} onChange={handleChange} readOnly={!isManager} /></div>
                    <div className="header-row"><span className="header-label">ETA :</span><input className="header-value" id="eta" type="text" value={formData.eta} onChange={handleChange} readOnly={!isManager} /></div>
                    <div className="header-row"><span className="header-label">ATD :</span><input className="header-value" id="atd" type="text" value={formData.atd} onChange={handleChange} readOnly={!isManager} /></div>

                    <table className="inner-table" style={{ marginTop: '15px' }}>
                      <thead><tr><th colSpan={3}>OUT BOUND / SERVICES</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                      <tbody>
                        <tr><td>BAGGAGE ON</td><td><input type="text" id="bagOnStart" value={formData.bagOnStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="bagOnStop" value={formData.bagOnStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>BAGGAGE OFF</td><td><input type="text" id="bagOffStart" value={formData.bagOffStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="bagOffStop" value={formData.bagOffStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>BOARDING</td><td colSpan={2}><input type="text" id="boarding" value={formData.boarding} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>DOOR</td><td><input type="text" id="doorStart" value={formData.doorStart} onChange={handleChange} readOnly={!isManager} /></td><td><input type="text" id="doorStop" value={formData.doorStop} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>START- UP</td><td colSpan={2}><input type="text" id="startup" value={formData.startup} onChange={handleChange} readOnly={!isManager} /></td></tr>
                      </tbody>
                    </table>

                    <table className="inner-table info-table" style={{ marginTop: '15px' }}>
                      <tbody>
                        <tr><td>CHECK-IN</td><td><input type="text" id="checkIn" value={formData.checkIn} onChange={handleChange} readOnly={!isManager} /></td></tr>
                        <tr><td>ROUTE</td><td>
                          <div className="route-wrapper">
                            <input type="text" id="route" style={{ flex: 1 }} value={formData.route} onChange={handleChange} readOnly={!isManager} />
                            {isManager && (
                              <>
                                <select className="route-select" onChange={(e) => appendRoute(e.target.value)} value="">
                                  <option value="">Add...</option>
                                  {routeCodes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button type="button" className="btn-plus" onClick={handleAddRoute}>➕</button>
                              </>
                            )}
                          </div>
                        </td></tr>
                        <tr><td>A/C REG</td><td><input type="text" id="acReg" value={formData.acReg} onChange={handleChange} readOnly={!isManager} /></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bottom-section">
                  <table className="inner-table">
                    <thead><tr><th colSpan={5}>PAX IN</th></tr><tr><th>Adult</th><th>Inft</th><th>Local</th><th>Foreign</th><th>Total</th></tr></thead>
                    <tbody><tr>
                      <td><input type="number" id="paxInAdult" value={formData.paxInAdult} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxInInf" value={formData.paxInInf} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxInLocal" value={formData.paxInLocal} readOnly /></td>
                      <td><input type="number" id="paxInForeign" value={formData.paxInForeign} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxInTotal" value={formData.paxInTotal} readOnly /></td>
                    </tr></tbody>
                  </table>
                  <table className="inner-table">
                    <thead><tr><th colSpan={5}>PAX OUT</th></tr><tr><th>Adult</th><th>Inft</th><th>Local</th><th>Foreign</th><th>Total</th></tr></thead>
                    <tbody><tr>
                      <td><input type="number" id="paxOutAdult" value={formData.paxOutAdult} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxOutInf" value={formData.paxOutInf} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxOutLocal" value={formData.paxOutLocal} readOnly /></td>
                      <td><input type="number" id="paxOutForeign" value={formData.paxOutForeign} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxOutTotal" value={formData.paxOutTotal} readOnly /></td>
                    </tr></tbody>
                  </table>
                </div>

                <div className="bottom-section-2">
                  <table className="inner-table">
                    <thead><tr><th colSpan={3}>PAX TRANS</th></tr><tr><th>Adult</th><th>Inft</th><th>Total</th></tr></thead>
                    <tbody><tr>
                      <td><input type="number" id="paxTransAdult" value={formData.paxTransAdult} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxTransInf" value={formData.paxTransInf} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="number" id="paxTransTotal" value={formData.paxTransTotal} readOnly /></td>
                    </tr></tbody>
                  </table>
                  <table className="inner-table">
                    <thead><tr><th colSpan={3}>CARGO</th></tr><tr><th>In(kg)</th><th>Out(kg)</th><th>Trans(kg)</th></tr></thead>
                    <tbody><tr>
                      <td><input type="text" id="cargoIn" value={formData.cargoIn} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="cargoOut" value={formData.cargoOut} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="cargoTrans" value={formData.cargoTrans} onChange={handleChange} readOnly={!isManager} /></td>
                    </tr></tbody>
                  </table>
                  <table className="inner-table">
                    <thead><tr><th colSpan={3}>MAIL</th></tr><tr><th>In(kg)</th><th>Out(kg)</th><th>Trans(kg)</th></tr></thead>
                    <tbody><tr>
                      <td><input type="text" id="mailIn" value={formData.mailIn} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="mailOut" value={formData.mailOut} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="mailTrans" value={formData.mailTrans} onChange={handleChange} readOnly={!isManager} /></td>
                    </tr></tbody>
                  </table>
                  <table className="inner-table">
                    <thead><tr><th colSpan={3}>BAGGAGE</th></tr><tr><th>In(kg)</th><th>Out(kg)</th><th>Trans(kg)</th></tr></thead>
                    <tbody><tr>
                      <td><input type="text" id="bagIn" value={formData.bagIn} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="bagOut" value={formData.bagOut} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="bagTrans" value={formData.bagTrans} onChange={handleChange} readOnly={!isManager} /></td>
                    </tr></tbody>
                  </table>
                  <table className="inner-table">
                    <thead><tr><th colSpan={3}>OTHERS</th></tr><tr><th>In(kg)</th><th>Out(kg)</th><th>Trans(kg)</th></tr></thead>
                    <tbody><tr>
                      <td><input type="text" id="otherIn" value={formData.otherIn} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="otherOut" value={formData.otherOut} onChange={handleChange} readOnly={!isManager} /></td>
                      <td><input type="text" id="otherTrans" value={formData.otherTrans} onChange={handleChange} readOnly={!isManager} /></td>
                    </tr></tbody>
                  </table>
                  <table className="inner-table">
                    <thead><tr><th colSpan={3}>SPECIAL INSTRUCTIONS</th></tr></thead>
                    <tbody><tr>
                      <td colSpan={3} style={{ padding: 0 }}>
                        <textarea id="specialLoad" className="special-load-textarea" placeholder="Write details..." value={formData.specialLoad} onChange={handleChange} readOnly={!isManager} />
                      </td>
                    </tr></tbody>
                  </table>
                </div>

                <div className="footer-section">
                  <div className="footer-box">
                    <label>Supervisor's Comments</label>
                    <textarea id="comments" value={formData.comments} onChange={handleChange} readOnly={!isManager} />
                  </div>
                  <div className="footer-box">
                    <label>Delay Time:</label>
                    <textarea id="delayTime" value={formData.delayTime} onChange={handleChange} readOnly={!isManager} />
                  </div>
                  <div className="footer-box">
                    <label>Medical Emergency</label>
                    <textarea id="medicalEmergency" value={formData.medicalEmergency} onChange={handleChange} readOnly={!isManager} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SAVED REPORTS */}
      {activeSubTab === 'reports' && (
        <RampReportsPage />
      )}
    </div>
  );
}

export default RampCheckSheetPage;