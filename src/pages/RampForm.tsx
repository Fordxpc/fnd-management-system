import React, { useState, useMemo } from 'react';
import '../styles/RampCheck.css';

const FALLBACK_AC_TYPES = ['ATR-42/600', 'ATR-72/600', 'A320', 'A321', 'B737-800', 'DASH-8/300', 'DASH-8/200'];

interface RampFormProps {
  formData: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
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
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  isManager: boolean;
  onOpenKeypad: (id: string, type: 'numeric' | 'alpha' | 'time') => void;
}

function SplitInput({ prefix, label, formData, handleChange, isManager, onOpenKeypad }: SplitInputProps) {
  const inputStyle: React.CSSProperties = {
    width: '45%', padding: '4px', border: '1px solid #cbd5e1',
    borderRadius: '4px', textAlign: 'center', fontSize: '13px', height: '28px',
    cursor: isManager ? 'pointer' : 'default'
  };

  const renderPair = (suffix: 'In' | 'Out' | 'Trans') => (
    <td>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        <input
          type="text" id={`${prefix}${suffix}Pcs`}
          value={formData[`${prefix}${suffix}Pcs`] || ''} readOnly
          onClick={() => isManager && onOpenKeypad(`${prefix}${suffix}Pcs`, 'numeric')}
          style={inputStyle}
        />
        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>/</span>
        <input
          type="text" id={`${prefix}${suffix}Kg`}
          value={formData[`${prefix}${suffix}Kg`] || ''} readOnly
          onClick={() => isManager && onOpenKeypad(`${prefix}${suffix}Kg`, 'numeric')}
          style={inputStyle}
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
  
  const availableAcTypes = acTypes && acTypes.length > 0 ? acTypes : FALLBACK_AC_TYPES;

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tempHour, setTempHour] = useState<string>('00');
  const [tempMin, setTempMin] = useState<string>('00');

  const [keypadTarget, setKeypadTarget] = useState<string | null>(null);
  const [keypadType, setKeypadType] = useState<'numeric' | 'alpha' | 'time'>('numeric');
  const [keypadValue, setKeypadValue] = useState('');

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

  const openKeypad = (id: string, type: 'numeric' | 'alpha' | 'time') => {
    if (!isManager) return;
    setKeypadTarget(id);
    setKeypadType(type);
    const currentVal = formData[id] || '';
    setKeypadValue(type === 'time' ? currentVal.replace(/[^0-9]/g, '') : currentVal);
  };

  const handleKeypadPress = (key: string) => {
    if (key === 'OK') {
      let finalVal = keypadValue;
      if (keypadType === 'time') {
        if (finalVal.length === 4) finalVal = finalVal.slice(0, 2) + ':' + finalVal.slice(2);
        else if (finalVal.length === 3) finalVal = '0' + finalVal.slice(0, 1) + ':' + finalVal.slice(1);
        else if (finalVal.length === 2) finalVal = finalVal + ':00';
        else if (finalVal.length === 1) finalVal = '0' + finalVal + ':00';
      }
      handleChange({ target: { id: keypadTarget, value: finalVal } } as any);
      setKeypadTarget(null);
    } else if (key === 'C') {
      setKeypadValue('');
    } else if (key === 'X' || key === '⌫') {
      setKeypadValue(prev => prev.slice(0, -1));
    } else {
      if (keypadType === 'numeric' && keypadValue.length >= 6) return;
      if (keypadType === 'time' && keypadValue.length >= 4) return;
      setKeypadValue(prev => prev + key);
    }
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
                  <select
                    className="header-value"
                    id="acType"
                    value={formData.acType || ''}
                    onChange={handleChange}
                    disabled={!isManager}
                    style={{
                      borderBottom: '1px solid #000', background: 'transparent',
                      padding: '2px 4px', fontSize: '12px', fontFamily: 'inherit',
                      color: '#000', width: '100%', outline: 'none',
                      cursor: isManager ? 'pointer' : 'default', appearance: 'menulist', 
                    }}
                  >
                    <option value="">-- Select --</option>
                    {availableAcTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {isManager && !isViewOnlyMode && <button type="button" className="btn-plus" onClick={handleAddAcType}>➕</button>}
                </div>
              </div>
              
              <div className="header-row">
                <span className="header-label">FLT.NO :</span>
                <input className="header-value" id="fltNo" type="text" value={formData.fltNo} readOnly onClick={() => openKeypad('fltNo', 'alpha')} style={{ cursor: isManager ? 'pointer' : 'default', borderBottom: '1px solid #000' }} />
              </div>
              
              <div className="header-row">
                <span className="header-label">ATA:</span>
                <input className="header-value" id="ata" type="text" value={formData.ata} readOnly onClick={() => handleTimeClick('ata')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default', borderBottom: '1px solid #000' }} />
              </div>
              
              <div className="header-row">
                <span className="header-label">STA:</span>
                <input className="header-value" id="sta" type="text" value={formData.sta} readOnly onClick={() => openKeypad('sta', 'time')} style={{ cursor: isManager ? 'pointer' : 'default', borderBottom: '1px solid #000' }} />
              </div>

              <table className="inner-table" style={{ marginTop: '15px' }}>
                <thead><tr><th colSpan={3}>IN BOUND</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                <tbody>
                  <tr><td>CHOCKS</td>
                    <td><input type="text" id="chocksStart" value={formData.chocksStart} readOnly onClick={() => handleTimeClick('chocksStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="chocksStop" value={formData.chocksStop} readOnly onClick={() => handleTimeClick('chocksStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>PAX OFF</td>
                    <td><input type="text" id="paxOffStart" value={formData.paxOffStart} readOnly onClick={() => handleTimeClick('paxOffStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="paxOffStop" value={formData.paxOffStop} readOnly onClick={() => handleTimeClick('paxOffStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>PAX ON</td>
                    <td><input type="text" id="paxOnStart" value={formData.paxOnStart} readOnly onClick={() => handleTimeClick('paxOnStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="paxOnStop" value={formData.paxOnStop} readOnly onClick={() => handleTimeClick('paxOnStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>CLEANING</td>
                    <td><input type="text" id="cleanStart" value={formData.cleanStart} readOnly onClick={() => handleTimeClick('cleanStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="cleanStop" value={formData.cleanStop} readOnly onClick={() => handleTimeClick('cleanStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="header-row"><span className="header-label">DATE :</span><input className="header-value" id="date" type="date" value={formData.date} onChange={handleChange} readOnly={!isManager} /></div>
              
              <div className="header-row">
                <span className="header-label">ETA :</span>
                <input className="header-value" id="eta" type="text" value={formData.eta} readOnly onClick={() => openKeypad('eta', 'time')} style={{ cursor: isManager ? 'pointer' : 'default', borderBottom: '1px solid #000' }} />
              </div>
              
              <div className="header-row">
                <span className="header-label">ATD :</span>
                <input className="header-value" id="atd" type="text" value={formData.atd} readOnly onClick={() => handleTimeClick('atd')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default', borderBottom: '1px solid #000' }} />
              </div>

              <table className="inner-table" style={{ marginTop: '15px' }}>
                <thead><tr><th colSpan={3}>OUT BOUND / SERVICES</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
                <tbody>
                  <tr><td>BAGGAGE ON</td>
                    <td><input type="text" id="bagOnStart" value={formData.bagOnStart} readOnly onClick={() => handleTimeClick('bagOnStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="bagOnStop" value={formData.bagOnStop} readOnly onClick={() => handleTimeClick('bagOnStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>BAGGAGE OFF</td>
                    <td><input type="text" id="bagOffStart" value={formData.bagOffStart} readOnly onClick={() => handleTimeClick('bagOffStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="bagOffStop" value={formData.bagOffStop} readOnly onClick={() => handleTimeClick('bagOffStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>BOARDING</td><td colSpan={2}><input type="text" id="boarding" value={formData.boarding} readOnly onClick={() => handleTimeClick('boarding')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td></tr>
                  <tr><td>DOOR</td>
                    <td><input type="text" id="doorStart" value={formData.doorStart} readOnly onClick={() => handleTimeClick('doorStart')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                    <td><input type="text" id="doorStop" value={formData.doorStop} readOnly onClick={() => handleTimeClick('doorStop')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>START- UP</td><td colSpan={2}><input type="text" id="startup" value={formData.startup} readOnly onClick={() => handleTimeClick('startup')} onFocus={preventKeyboard} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td></tr>
                </tbody>
              </table>

              <table className="inner-table info-table" style={{ marginTop: '15px' }}>
                <tbody>
                  <tr>
                    <td>CHECK-IN</td>
                    <td><input type="text" id="checkIn" value={formData.checkIn} readOnly onClick={() => openKeypad('checkIn', 'time')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                  </tr>
                  <tr><td>ROUTE</td><td>
                    <div className="route-wrapper">
                      <input type="text" id="route" style={{ flex: 1, cursor: isManager ? 'pointer' : 'default' }} value={formData.route} readOnly onClick={() => openKeypad('route', 'alpha')} />
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
                  <tr><td>A/C REG</td><td><input type="text" id="acReg" value={formData.acReg} readOnly onClick={() => openKeypad('acReg', 'alpha')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bottom-section">
            <table className="inner-table">
              <thead><tr><th colSpan={5}>PAX IN</th></tr><tr><th>Adult</th><th>Inft</th><th>Local</th><th>Foreign</th><th>Total</th></tr></thead>
              <tbody><tr>
                <td><input type="text" id="paxInAdult" value={formData.paxInAdult} readOnly onClick={() => openKeypad('paxInAdult', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxInInf" value={formData.paxInInf} readOnly onClick={() => openKeypad('paxInInf', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxInLocal" value={formData.paxInLocal} readOnly /></td>
                <td><input type="text" id="paxInForeign" value={formData.paxInForeign} readOnly onClick={() => openKeypad('paxInForeign', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxInTotal" value={formData.paxInTotal} readOnly /></td>
              </tr></tbody>
            </table>
            <table className="inner-table">
              <thead><tr><th colSpan={5}>PAX OUT</th></tr><tr><th>Adult</th><th>Inft</th><th>Local</th><th>Foreign</th><th>Total</th></tr></thead>
              <tbody><tr>
                <td><input type="text" id="paxOutAdult" value={formData.paxOutAdult} readOnly onClick={() => openKeypad('paxOutAdult', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxOutInf" value={formData.paxOutInf} readOnly onClick={() => openKeypad('paxOutInf', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxOutLocal" value={formData.paxOutLocal} readOnly /></td>
                <td><input type="text" id="paxOutForeign" value={formData.paxOutForeign} readOnly onClick={() => openKeypad('paxOutForeign', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxOutTotal" value={formData.paxOutTotal} readOnly /></td>
              </tr></tbody>
            </table>
          </div>

          <div className="bottom-section-2">
            <table className="inner-table">
              <thead><tr><th colSpan={3}>PAX TRANS</th></tr><tr><th>Adult</th><th>Inft</th><th>Total</th></tr></thead>
              <tbody><tr>
                <td><input type="text" id="paxTransAdult" value={formData.paxTransAdult} readOnly onClick={() => openKeypad('paxTransAdult', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxTransInf" value={formData.paxTransInf} readOnly onClick={() => openKeypad('paxTransInf', 'numeric')} style={{ cursor: isManager ? 'pointer' : 'default' }} /></td>
                <td><input type="text" id="paxTransTotal" value={formData.paxTransTotal} readOnly /></td>
              </tr></tbody>
            </table>
            
            <SplitInput prefix="cargo" label="CARGO" formData={displayData} handleChange={handleChange} isManager={isManager} onOpenKeypad={openKeypad} />
            <SplitInput prefix="mail" label="MAIL" formData={displayData} handleChange={handleChange} isManager={isManager} onOpenKeypad={openKeypad} />
            <SplitInput prefix="bag" label="BAGGAGE" formData={displayData} handleChange={handleChange} isManager={isManager} onOpenKeypad={openKeypad} />
            <SplitInput prefix="other" label="OTHERS" formData={displayData} handleChange={handleChange} isManager={isManager} onOpenKeypad={openKeypad} />

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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '0 auto 24px auto' }}>
              <select value={tempHour} onChange={(e) => setTempHour(e.target.value)} style={{ padding: '10px', fontSize: '24px', borderRadius: '8px', border: '2px solid #cbd5e1', color: '#1e293b', backgroundColor: '#ffffff', fontWeight: 'bold' }}>
                {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>)}
              </select>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>:</span>
              <select value={tempMin} onChange={(e) => setTempMin(e.target.value)} style={{ padding: '10px', fontSize: '24px', borderRadius: '8px', border: '2px solid #cbd5e1', color: '#1e293b', backgroundColor: '#ffffff', fontWeight: 'bold' }}>
                {Array.from({ length: 60 }).map((_, i) => <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>)}
              </select>
            </div>
            <button onClick={handleClearField} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, fontSize: '14px', textDecoration: 'underline', cursor: 'pointer', marginBottom: '20px' }}>Clear this field</button>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <button onClick={() => setConfirmId(null)} style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <button onClick={executeFillNow} style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
            </div>
          </div>
        </div>
      )}

      {keypadTarget && (
        <div className="modal-backdrop" onClick={() => setKeypadTarget(null)} style={{ zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '400px', padding: '24px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#1e293b', fontSize: '18px' }}>
              {keypadType === 'time' ? 'Enter Time (24h)' : 'Enter Value'}
            </h3>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', letterSpacing: '1px', marginBottom: '20px', background: '#f1f5f9', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-all' }}>
              {keypadValue || <span style={{ color: '#cbd5e1' }}>Type...</span>}
            </div>

            {keypadType === 'alpha' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  {['Q','W','E','R','T','Y','U','I','O','P'].map(k => <button key={k} onClick={() => handleKeypadPress(k)} style={{ padding: '12px 8px', fontSize: '16px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', cursor: 'pointer', flex: 1 }}>{k}</button>)}
                </div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  {['A','S','D','F','G','H','J','K','L'].map(k => <button key={k} onClick={() => handleKeypadPress(k)} style={{ padding: '12px 8px', fontSize: '16px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', cursor: 'pointer', flex: 1 }}>{k}</button>)}
                </div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  {['Z','X','C','V','B','N','M','-','/'].map(k => <button key={k} onClick={() => handleKeypadPress(k)} style={{ padding: '12px 8px', fontSize: '16px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', cursor: 'pointer', flex: 1 }}>{k}</button>)}
                </div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  {['1','2','3','4','5','6','7','8','9','0'].map(k => <button key={k} onClick={() => handleKeypadPress(k)} style={{ padding: '12px 8px', fontSize: '16px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', cursor: 'pointer', flex: 1 }}>{k}</button>)}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={() => handleKeypadPress('C')} style={{ flex: 1, padding: '16px', fontSize: '18px', fontWeight: 'bold', background: '#fee2e2', border: 'none', borderRadius: '8px', color: '#dc2626', cursor: 'pointer' }}>Clear (C)</button>
                  <button onClick={() => handleKeypadPress('X')} style={{ flex: 1, padding: '16px', fontSize: '18px', fontWeight: 'bold', background: '#fef3c7', border: 'none', borderRadius: '8px', color: '#d97706', cursor: 'pointer' }}>Backspace (X)</button>
                </div>
              </div>
            )}

            {(keypadType === 'numeric' || keypadType === 'time') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => (
                  <button key={k} onClick={() => handleKeypadPress(k)} style={{ padding: '16px', fontSize: '24px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', cursor: 'pointer' }}>{k}</button>
                ))}
                <button onClick={() => handleKeypadPress('C')} style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', background: '#fee2e2', border: 'none', borderRadius: '8px', color: '#dc2626', cursor: 'pointer' }}>C</button>
                <button onClick={() => handleKeypadPress('0')} style={{ padding: '16px', fontSize: '24px', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', cursor: 'pointer' }}>0</button>
                <button onClick={() => handleKeypadPress('X')} style={{ padding: '16px', fontSize: '20px', fontWeight: 'bold', background: '#fef3c7', border: 'none', borderRadius: '8px', color: '#d97706', cursor: 'pointer' }}>X</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setKeypadTarget(null)} style={{ flex: 1, padding: '16px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleKeypadPress('OK')} style={{ flex: 2, padding: '16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>Set Value</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}