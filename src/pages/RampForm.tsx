import React, { useState, useMemo } from 'react';
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

interface SplitInputProps {
  prefix: string;
  label: string;
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isManager: boolean;
}

function SplitInput({ prefix, label, formData, handleChange, isManager }: SplitInputProps) {
  const inputStyle: React.CSSProperties = {
    width: '45%', padding: '4px', border: '1px solid #cbd5e1',
    borderRadius: '4px', textAlign: 'center', fontSize: '13px', height: '28px',
  };

  const renderPair = (suffix: 'In' | 'Out' | 'Trans') => (
    <td>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        <input
          type="text" inputMode="numeric" pattern="[0-9]*" id={`${prefix}${suffix}Pcs`}
          value={formData[`${prefix}${suffix}Pcs`] || ''} onChange={handleChange}
          readOnly={!isManager} autoComplete="off" style={inputStyle}
        />
        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>/</span>
        <input
          type="text" inputMode="numeric" pattern="[0-9]*" id={`${prefix}${suffix}Kg`}
          value={formData[`${prefix}${suffix}Kg`] || ''} onChange={handleChange}
          readOnly={!isManager} autoComplete="off" style={inputStyle}
        />
      </div>
    </td>
  );

  return (
    <table className="inner-table">
      <thead>
        <tr><th colSpan={3}>{label}</th></tr>
        <tr><th>In(pcs/kg)</th><th>Out(pcs/kg)</th><th>Trans(pcs/kg)</th></tr>
      </thead>
      <tbody>
        <tr>
          {renderPair('In')}
          {renderPair('Out')}
          {renderPair('Trans')}
        </tr>
      </tbody>
    </table>
  );
}

export default function RampForm({ formData, handleChange, isManager, acTypes, routeCodes, handleAddAcType, handleAddRoute, appendRoute, isViewOnlyMode = false }: RampFormProps) {
  const [keypadTarget, setKeypadTarget] = useState<string | null>(null);
  const [keypadValue, setKeypadValue] = useState<string>('');

  const displayData = useMemo(() => {
    const d = { ...formData };
    const prefixes = ['cargo', 'mail', 'bag', 'other'];
    prefixes.forEach(prefix => {
      (['In', 'Out', 'Trans'] as const).forEach(suffix => {
        const pcsKey = `${prefix}${suffix}Pcs`;
        const kgKey = `${prefix}${suffix}Kg`;
        const combinedKey = `${prefix}${suffix}`;
        if ((d[pcsKey] === undefined || d[pcsKey] === '') && (d[kgKey] === undefined || d[kgKey] === '') && d[combinedKey]) {
          const [p, k] = String(d[combinedKey]).split('/');
          d[pcsKey] = p || '';
          d[kgKey] = k || '';
        }
      });
    });
    return d;
  }, [formData]);

  const handleTimeClick = (id: string) => {
    if (!isManager) return;
    const currentValue = formData[id] || '';
    setKeypadValue(currentValue.replace(/[^0-9]/g, '')); // Strip colon
    setKeypadTarget(id);
  };

  const handleKeypadPress = (key: string) => {
    if (key === 'C') setKeypadValue('');
    else if (key === '⌫') setKeypadValue(prev => prev.slice(0, -1));
    else if (key === 'OK') {
      let formatted = keypadValue;
      if (formatted.length > 0) {
        if (formatted.length <= 2) formatted = formatted.padStart(2, '0') + ':00';
        else formatted = formatted.slice(0, formatted.length - 2).padStart(2, '0') + ':' + formatted.slice(-2);
      }
      handleChange({ target: { id: keypadTarget, value: formatted } } as any);
      setKeypadTarget(null);
    } else {
      if (keypadValue.length < 4) setKeypadValue(prev => prev + key);
    }
  };

  const preventKeyboard = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.blur();
  };

  const formattedPreview = useMemo(() => {
    let f = keypadValue;
    if (f.length === 0) return '--:--';
    if (f.length === 1) return `0${f}:--`;
    if (f.length === 2) return `${f}:--`;
    if (f.length === 3) return `${f.slice(0, 2)}:${f.slice(2)}0`;
    return `${f.slice(0, 2)}:${f.slice(2)}`;
  }, [keypadValue]);

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
            
            <SplitInput prefix="cargo" label="CARGO" formData={displayData} handleChange={handleChange} isManager={isManager} />
            <SplitInput prefix="mail" label="MAIL" formData={displayData} handleChange={handleChange} isManager={isManager} />
            <SplitInput prefix="bag" label="BAGGAGE" formData={displayData} handleChange={handleChange} isManager={isManager} />
            <SplitInput prefix="other" label="OTHERS" formData={displayData} handleChange={handleChange} isManager={isManager} />

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

      {/* IN-APP NUMERIC KEYPAD MODAL */}
      {keypadTarget && (
        <div className="modal-backdrop" onClick={() => setKeypadTarget(null)} style={{ zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '320px', padding: '24px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#1e293b', fontSize: '18px' }}>Enter Time (24h)</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Type digits to set the time.
            </p>
            
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', letterSpacing: '2px', marginBottom: '24px', background: '#f1f5f9', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1' }}>
              {formattedPreview}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => (
                <button key={k} onClick={() => handleKeypadPress(k)} style={{ padding: '16px', fontSize: '24px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', cursor: 'pointer', transition: 'background 0.1s' }}>{k}</button>
              ))}
              <button onClick={() => handleKeypadPress('C')} style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', background: '#fee2e2', border: 'none', borderRadius: '8px', color: '#dc2626', cursor: 'pointer' }}>C</button>
              <button onClick={() => handleKeypadPress('0')} style={{ padding: '16px', fontSize: '24px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', cursor: 'pointer' }}>0</button>
              <button onClick={() => handleKeypadPress('⌫')} style={{ padding: '16px', fontSize: '20px', fontWeight: 'bold', background: '#fef3c7', border: 'none', borderRadius: '8px', color: '#d97706', cursor: 'pointer' }}>⌫</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setKeypadTarget(null)} style={{ flex: 1, padding: '16px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleKeypadPress('OK')} style={{ flex: 2, padding: '16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>Set Time</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}