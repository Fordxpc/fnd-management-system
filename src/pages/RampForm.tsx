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

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tempHour, setTempHour] = useState<string>('00');
  const [tempMin, setTempMin] = useState<string>('00');

  const executeFillNow = () => {
    if (!confirmId) return;
    const finalTime = `${tempHour}:${tempMin}`;
    handleChange({ target: { id: confirmId, value: finalTime } } as any);
    setConfirmId(null);
  };

  const handleClearField = () => {
    if (!confirmId) return;
    handleChange({ target: { id: confirmId, value: '' } } as any);
    setConfirmId(null);
  };

  const handleTimeClick = (id: string) => {
    if (!isManager) return;
    const now = new Date();
    setTempHour(String(now.getHours()).padStart(2, '0'));
    setTempMin(String(now.getMinutes()).padStart(2, '0'));
    setConfirmId(id);
  };

  const preventKeyboard = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.blur();
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
              <div className="header-row"><span className="header-label">ATA:</span><input className="header-value" id="ata" type="text" value={formData.ata} onChange={handleChange} onClick={() => handleTimeClick('ata')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>
              <div className="header-row"><span className="header-label">STA:</span><input className="header-value" id="sta" type="text" value={formData.sta} onChange={handleChange} onClick={() => handleTimeClick('sta')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>

              <table className="inner-table" style={{ marginTop: '15px' }}>
                <thead><tr><th colSpan={3}>IN BOUND</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                <tbody>
                  <tr><td>CHOCKS</td>
                    <td><input type="text" id="chocksStart" value={formData.chocksStart} onChange={handleChange} onClick={() => handleTimeClick('chocksStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="chocksStop" value={formData.chocksStop} onChange={handleChange} onClick={() => handleTimeClick('chocksStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>PAX OFF</td>
                    <td><input type="text" id="paxOffStart" value={formData.paxOffStart} onChange={handleChange} onClick={() => handleTimeClick('paxOffStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="paxOffStop" value={formData.paxOffStop} onChange={handleChange} onClick={() => handleTimeClick('paxOffStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>PAX ON</td>
                    <td><input type="text" id="paxOnStart" value={formData.paxOnStart} onChange={handleChange} onClick={() => handleTimeClick('paxOnStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="paxOnStop" value={formData.paxOnStop} onChange={handleChange} onClick={() => handleTimeClick('paxOnStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>CLEANING</td>
                    <td><input type="text" id="cleanStart" value={formData.cleanStart} onChange={handleChange} onClick={() => handleTimeClick('cleanStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="cleanStop" value={formData.cleanStop} onChange={handleChange} onClick={() => handleTimeClick('cleanStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="header-row"><span className="header-label">DATE :</span><input className="header-value" id="date" type="date" value={formData.date} onChange={handleChange} readOnly={!isManager} /></div>
              <div className="header-row"><span className="header-label">ETA :</span><input className="header-value" id="eta" type="text" value={formData.eta} onChange={handleChange} onClick={() => handleTimeClick('eta')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>
              <div className="header-row"><span className="header-label">ATD :</span><input className="header-value" id="atd" type="text" value={formData.atd} onChange={handleChange} onClick={() => handleTimeClick('atd')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></div>

              <table className="inner-table" style={{ marginTop: '15px' }}>
                <thead><tr><th colSpan={3}>OUT BOUND / SERVICES</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                <tbody>
                  <tr><td>BAGGAGE ON</td>
                    <td><input type="text" id="bagOnStart" value={formData.bagOnStart} onChange={handleChange} onClick={() => handleTimeClick('bagOnStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="bagOnStop" value={formData.bagOnStop} onChange={handleChange} onClick={() => handleTimeClick('bagOnStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>BAGGAGE OFF</td>
                    <td><input type="text" id="bagOffStart" value={formData.bagOffStart} onChange={handleChange} onClick={() => handleTimeClick('bagOffStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="bagOffStop" value={formData.bagOffStop} onChange={handleChange} onClick={() => handleTimeClick('bagOffStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>BOARDING</td><td colSpan={2}><input type="text" id="boarding" value={formData.boarding} onChange={handleChange} onClick={() => handleTimeClick('boarding')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td></tr>
                  <tr><td>DOOR</td>
                    <td><input type="text" id="doorStart" value={formData.doorStart} onChange={handleChange} onClick={() => handleTimeClick('doorStart')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                    <td><input type="text" id="doorStop" value={formData.doorStop} onChange={handleChange} onClick={() => handleTimeClick('doorStop')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td>
                  </tr>
                  <tr><td>START- UP</td><td colSpan={2}><input type="text" id="startup" value={formData.startup} onChange={handleChange} onClick={() => handleTimeClick('startup')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td></tr>
                </tbody>
              </table>

              <table className="inner-table info-table" style={{ marginTop: '15px' }}>
                <tbody>
                  <tr><td>CHECK-IN</td><td><input type="text" id="checkIn" value={formData.checkIn} onChange={handleChange} onClick={() => handleTimeClick('checkIn')} onFocus={preventKeyboard} autoComplete="off" readOnly={!isManager} title="Click to insert current time" /></td></tr>
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
            
            {/* BAGGAGE TABLE - UPDATED WITH SPLIT INPUTS */}
            <table className="inner-table">
              <thead><tr><th colSpan={3}>BAGGAGE</th></tr><tr><th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th></tr></thead>
              <tbody><tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                    <input type="text" id="bagInPcs" value={formData.bagInPcs || ''} onChange={handleChange} readOnly={!isManager} style={{ width: '40%', padding: '2px', border: '1px solid #ccc', textAlign: 'center' }} />
                    <span style={{ fontWeight: 'bold' }}>/</span>
                    <input type="text" id="bagInKg" value={formData.bagInKg || ''} onChange={handleChange} readOnly={!isManager} style={{ width: '40%', padding: '2px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                    <input type="text" id="bagOutPcs" value={formData.bagOutPcs || ''} onChange={handleChange} readOnly={!isManager} style={{ width: '40%', padding: '2px', border: '1px solid #ccc', textAlign: 'center' }} />
                    <span style={{ fontWeight: 'bold' }}>/</span>
                    <input type="text" id="bagOutKg" value={formData.bagOutKg || ''} onChange={handleChange} readOnly={!isManager} style={{ width: '40%', padding: '2px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                    <input type="text" id="bagTransPcs" value={formData.bagTransPcs || ''} onChange={handleChange} readOnly={!isManager} style={{ width: '40%', padding: '2px', border: '1px solid #ccc', textAlign: 'center' }} />
                    <span style={{ fontWeight: 'bold' }}>/</span>
                    <input type="text" id="bagTransKg" value={formData.bagTransKg || ''} onChange={handleChange} readOnly={!isManager} style={{ width: '40%', padding: '2px', border: '1px solid #ccc', textAlign: 'center' }} />
                  </div>
                </td>
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

      {confirmId && (
        <div className="modal-backdrop" onClick={() => setConfirmId(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '350px', padding: '30px 20px' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '20px' }}>Set Time (24h)</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
              Adjust the time below or clear it.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '0 auto 24px auto' }}>
              <select 
                value={tempHour} 
                onChange={(e) => setTempHour(e.target.value)} 
                style={{ padding: '10px', fontSize: '24px', borderRadius: '8px', border: '2px solid #cbd5e1', color: '#1e293b', backgroundColor: '#ffffff', fontWeight: 'bold' }}
              >
                {Array.from({ length: 24 }).map((_, i) => {
                  const h = String(i).padStart(2, '0');
                  return <option key={h} value={h}>{h}</option>;
                })}
              </select>
              
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>:</span>
              
              <select 
                value={tempMin} 
                onChange={(e) => setTempMin(e.target.value)} 
                style={{ padding: '10px', fontSize: '24px', borderRadius: '8px', border: '2px solid #cbd5e1', color: '#1e293b', backgroundColor: '#ffffff', fontWeight: 'bold' }}
              >
                {Array.from({ length: 60 }).map((_, i) => {
                  const m = String(i).padStart(2, '0');
                  return <option key={m} value={m}>{m}</option>;
                })}
              </select>
            </div>

            <button 
              onClick={handleClearField} 
              style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, fontSize: '14px', textDecoration: 'underline', cursor: 'pointer', marginBottom: '20px', display: 'block', margin: '0 auto 20px auto' }}
            >
              Clear this field
            </button>

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