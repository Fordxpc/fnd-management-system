import React from 'react';
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

  // Task 5a: double-click any time field to insert current time (HH:MM)
  const fillNow = (id: string) => {
    if (!isManager) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    handleChange({ target: { id, value: `${hh}:${mm}` } } as any);
  };

  return (
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
            <div className="header-row"><span className="header-label">FLT.NO :</span><input className="header-value" id="fltNo" type="text" value={formData.fltNo} onChange={handleChange} readOnly={!isManager} /></div>
            <div className="header-row"><span className="header-label">ATA:</span><input className="header-value" id="ata" type="text" value={formData.ata} onChange={handleChange} onDoubleClick={() => fillNow('ata')} readOnly={!isManager} title="Double-click to insert current time" /></div>
            <div className="header-row"><span className="header-label">STA:</span><input className="header-value" id="sta" type="text" value={formData.sta} onChange={handleChange} onDoubleClick={() => fillNow('sta')} readOnly={!isManager} title="Double-click to insert current time" /></div>

            <table className="inner-table" style={{ marginTop: '15px' }}>
              <thead><tr><th colSpan={3}>IN BOUND</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
              <tbody>
                <tr><td>CHOCKS</td>
                  <td><input type="text" id="chocksStart" value={formData.chocksStart} onChange={handleChange} onDoubleClick={() => fillNow('chocksStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="chocksStop" value={formData.chocksStop} onChange={handleChange} onDoubleClick={() => fillNow('chocksStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
                <tr><td>PAX OFF</td>
                  <td><input type="text" id="paxOffStart" value={formData.paxOffStart} onChange={handleChange} onDoubleClick={() => fillNow('paxOffStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="paxOffStop" value={formData.paxOffStop} onChange={handleChange} onDoubleClick={() => fillNow('paxOffStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
                <tr><td>PAX ON</td>
                  <td><input type="text" id="paxOnStart" value={formData.paxOnStart} onChange={handleChange} onDoubleClick={() => fillNow('paxOnStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="paxOnStop" value={formData.paxOnStop} onChange={handleChange} onDoubleClick={() => fillNow('paxOnStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
                <tr><td>CLEANING</td>
                  <td><input type="text" id="cleanStart" value={formData.cleanStart} onChange={handleChange} onDoubleClick={() => fillNow('cleanStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="cleanStop" value={formData.cleanStop} onChange={handleChange} onDoubleClick={() => fillNow('cleanStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div className="header-row"><span className="header-label">DATE :</span><input className="header-value" id="date" type="date" value={formData.date} onChange={handleChange} readOnly={!isManager} /></div>
            <div className="header-row"><span className="header-label">ETA :</span><input className="header-value" id="eta" type="text" value={formData.eta} onChange={handleChange} onDoubleClick={() => fillNow('eta')} readOnly={!isManager} title="Double-click to insert current time" /></div>
            <div className="header-row"><span className="header-label">ATD :</span><input className="header-value" id="atd" type="text" value={formData.atd} onChange={handleChange} onDoubleClick={() => fillNow('atd')} readOnly={!isManager} title="Double-click to insert current time" /></div>

            <table className="inner-table" style={{ marginTop: '15px' }}>
              <thead><tr><th colSpan={3}>OUT BOUND / SERVICES</th></tr><tr><th style={{ textAlign: 'left', paddingLeft: '8px' }}></th><th>START</th><th>STOP</th></tr></thead>
              <tbody>
                <tr><td>BAGGAGE ON</td>
                  <td><input type="text" id="bagOnStart" value={formData.bagOnStart} onChange={handleChange} onDoubleClick={() => fillNow('bagOnStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="bagOnStop" value={formData.bagOnStop} onChange={handleChange} onDoubleClick={() => fillNow('bagOnStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
                <tr><td>BAGGAGE OFF</td>
                  <td><input type="text" id="bagOffStart" value={formData.bagOffStart} onChange={handleChange} onDoubleClick={() => fillNow('bagOffStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="bagOffStop" value={formData.bagOffStop} onChange={handleChange} onDoubleClick={() => fillNow('bagOffStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
                <tr><td>BOARDING</td><td colSpan={2}><input type="text" id="boarding" value={formData.boarding} onChange={handleChange} onDoubleClick={() => fillNow('boarding')} readOnly={!isManager} title="Double-click to insert current time" /></td></tr>
                <tr><td>DOOR</td>
                  <td><input type="text" id="doorStart" value={formData.doorStart} onChange={handleChange} onDoubleClick={() => fillNow('doorStart')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                  <td><input type="text" id="doorStop" value={formData.doorStop} onChange={handleChange} onDoubleClick={() => fillNow('doorStop')} readOnly={!isManager} title="Double-click to insert current time" /></td>
                </tr>
                <tr><td>START- UP</td><td colSpan={2}><input type="text" id="startup" value={formData.startup} onChange={handleChange} onDoubleClick={() => fillNow('startup')} readOnly={!isManager} title="Double-click to insert current time" /></td></tr>
              </tbody>
            </table>

            <table className="inner-table info-table" style={{ marginTop: '15px' }}>
              <tbody>
                <tr><td>CHECK-IN</td><td><input type="text" id="checkIn" value={formData.checkIn} onChange={handleChange} onDoubleClick={() => fillNow('checkIn')} readOnly={!isManager} title="Double-click to insert current time" /></td></tr>
                <tr><td>ROUTE</td><td>
                  <div className="route-wrapper">
                    <input type="text" id="route" style={{ flex: 1 }} value={formData.route} onChange={handleChange} readOnly={!isManager} />
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
  );
}