import React, { useState } from 'react';
import '../styles/RampCheck.css';

interface RampFormProps {
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isManager: boolean;
  acTypes: string[];
  routeCodes: string[];
  handleAddAcType: () => void;
  handleAddRoute: () => void;
  appendRoute: (code: string) => void;
  isViewOnlyMode?: boolean;
}

export default function RampForm({ formData, handleChange, isManager, acTypes, routeCodes, handleAddAcType, handleAddRoute, appendRoute, isViewOnlyMode = false }: RampFormProps) {

  // State to hold which field is waiting for confirmation
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // State to hold the editable time in the popup
  const [tempTime, setTempTime] = useState<string>('');

  const executeFillNow = () => {
    if (!confirmId || !tempTime) return;
    
    // Trigger the actual change with the edited time
    handleChange({ target: { id: confirmId, value: tempTime } } as any);
    
    // Close the popup
    setConfirmId(null);
  };

  const handleTimeClick = (id: string) => {
    if (!isManager) return;
    
    // Get current time and pre-fill the input
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTempTime(`${hh}:${mm}`);
    
    // Open the popup
    setConfirmId(id);
  };

  return (
    <>
      <div className={`ramp-sheet ${isViewOnlyMode ? 'view-only' : ''}`}>
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
                  {isManager && !isViewOnlyMode && <button type="button" className="btn-plus" onClick={handleAddAcType}>➕</button>}
                </div>
                <datalist id="acTypeOptions">{acTypes.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="header-row"><span className="header-label">FLT.NO :</span><input className="header-value" id="fltNo" type="text" value={formData.fltNo} onChange={handleChange} autoComplete="off" readOnly={!isManager} /></div>
              <div className="header-row"><span className="header-label">ATA:</span><input className="header-value" id="ata" type="text" value={formData.ata} onChange={handleChange} onClick={() => handleTimeClick('ata')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>
              <div className="header-row"><span className="header-label">STA:</span><input className="header-value" id="sta" type="text" value={formData.sta} onChange={handleChange} onClick={() => handleTimeClick('sta')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>

              <table className="inner-table" style={{ marginTop: '15px' }}>
                <thead><tr><th colSpan={3}>IN BOUND</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                <tbody>
                  <tr><td>CHOCKS</td>
                    <td><input type="text" id="chocksStart" value={formData.chocksStart} onChange={handleChange} onClick={() => handleTimeClick('chocksStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="chocksStop" value={formData.chocksStop} onChange={handleChange} onClick={() => handleTimeClick('chocksStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>PAX OFF</td>
                    <td><input type="text" id="paxOffStart" value={formData.paxOffStart} onChange={handleChange} onClick={() => handleTimeClick('paxOffStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="paxOffStop" value={formData.paxOffStop} onChange={handleChange} onClick={() => handleTimeClick('paxOffStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>PAX ON</td>
                    <td><input type="text" id="paxOnStart" value={formData.paxOnStart} onChange={handleChange} onClick={() => handleTimeClick('paxOnStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="paxOnStop" value={formData.paxOnStop} onChange={handleChange} onClick={() => handleTimeClick('paxOnStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>CLEANING</td>
                    <td><input type="text" id="cleanStart" value={formData.cleanStart} onChange={handleChange} onClick={() => handleTimeClick('cleanStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="cleanStop" value={formData.cleanStop} onChange={handleChange} onClick={() => handleTimeClick('cleanStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="header-row"><span className="header-label">DATE :</span><input className="header-value" id="date" type="date" value={formData.date} onChange={handleChange} readOnly={!isManager} /></div>
              <div className="header-row"><span className="header-label">ETA :</span><input className="header-value" id="eta" type="text" value={formData.eta} onChange={handleChange} onClick={() => handleTimeClick('eta')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>
              <div className="header-row"><span className="header-label">ATD :</span><input className="header-value" id="atd" type="text" value={formData.atd} onChange={handleChange} onClick={() => handleTimeClick('atd')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>

              <table className="inner-table" style={{ marginTop: '15px' }}>
                <thead><tr><th colSpan={3}>OUT BOUND / SERVICES</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                <tbody>
                  <tr><td>BAGGAGE ON</td>
                    <td><input type="text" id="bagOnStart" value={formData.bagOnStart} onChange={handleChange} onClick={() => handleTimeClick('bagOnStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="bagOnStop" value={formData.bagOnStop} onChange={handleChange} onClick={() => handleTimeClick('bagOnStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>BAGGAGE OFF</td>
                    <td><input type="text" id="bagOffStart" value={formData.bagOffStart} onChange={handleChange} onClick={() => handleTimeClick('bagOffStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="bagOffStop" value={formData.bagOffStop} onChange={handleChange} onClick={() => handleTimeClick('bagOffStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>BOARDING</td><td colSpan={2}><input type="text" id="boarding" value={formData.boarding} onChange={handleChange} onClick={() => handleTimeClick('boarding')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td></tr>
                  <tr><td>DOOR</td>
                    <td><input type="text" id="doorStart" value={formData.doorStart} onChange={handleChange} onClick={() => handleTimeClick('doorStart')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="doorStop" value={formData.doorStop} onChange={handleChange} onClick={() => handleTimeClick('doorStop')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>START- UP</td><td colSpan={2}><input type="text" id="startup" value={formData.startup} onChange={handleChange} onClick={() => handleTimeClick('startup')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td></tr>
                </tbody>
              </table>

              <table className="inner-table info-table" style={{ marginTop: '15px' }}>
                <tbody>
                  <tr><td>CHECK-IN</td><td><input type="text" id="checkIn" value={formData.checkIn} onChange={handleChange} onClick={() => handleTimeClick('checkIn')} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td></tr>
                  <tr><td>ROUTE</td><td>
                    <div className="route-wrapper">
                      <input type="text" id="route" style={{ flex: 1 }} value={formData.route} onChange={handleChange} autoComplete="off" readOnly={!isManager} />
                      {isManager && !isViewOnlyMode && (
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
                  <tr><td>A/C REG</td><td><input type="text" id="acReg" value={formData.acReg} onChange={handleChange} autoComplete="off" readOnly={!isManager} /></td></tr>
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

      {/* Custom Time Confirmation Popup */}
      {confirmId && (
        <div className="modal-backdrop" onClick={() => setConfirmId(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '350px', padding: '30px 20px' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '20px' }}>Set Time</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
              Edit the time below if needed.
            </p>
            
            <input 
              type="time" 
              value={tempTime} 
              onChange={(e) => setTempTime(e.target.value)} 
              style={{ 
                fontSize: '24px', 
                padding: '10px', 
                textAlign: 'center', 
                borderRadius: '8px', 
                border: '2px solid #cbd5e1',
                width: '160px',
                margin: '0 auto 24px auto',
                display: 'block',
                color: '#1e293b',
                backgroundColor: '#ffffff',
                colorScheme: 'light'
              }} 
            />

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <button 
                onClick={() => setConfirmId(null)} 
                style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(220, 38, 38, 0.2)' }}
                title="Cancel"
              >
                ✕
              </button>
              <button 
                onClick={executeFillNow} 
                style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(22, 163, 74, 0.2)' }}
                title="Confirm"
              >
                ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}