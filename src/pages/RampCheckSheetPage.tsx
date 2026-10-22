import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import RampReportsPage from './RampReportsPage';
import RampForm from './RampForm';
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

  useEffect(() => {
    const savedAc = JSON.parse(localStorage.getItem('acTypes') || '[]');
    setAcTypes([...new Set([...DEFAULT_AC_TYPES, ...savedAc])]);

    const savedRoutes = JSON.parse(localStorage.getItem('routeCodes') || '[]');
    setRouteCodes([...new Set([...DEFAULT_ROUTE_CODES, ...savedRoutes])]);
  }, []);

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
      const { id: _id, ...rest } = formData as any;

      if (currentDocId) {
        await setDoc(doc(db, 'ramp_inspections', currentDocId), {
          ...rest,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        toast.success('Record updated!');
      } else {
        const ref = await addDoc(collection(db, 'ramp_inspections'), {
          ...rest,
          createdAt: new Date().toISOString(),
        });
        setCurrentDocId(ref.id);
        toast.success('Record saved!');
      }
      // REMOVED: await setDoc(doc(db, 'ramp_live_draft', 'current'), {}); 
      // Draft stays live for external parties.
    } catch (err: any) { toast.error(err.message); }
  };

  const handleReset = () => {
    if (!isManager) return;
    setFormData(INITIAL_FORM);
    setCurrentDocId(null);
    // Clears live draft only when explicitly resetting to new record
    setDoc(doc(db, 'ramp_live_draft', 'current'), {});
    toast.success('Form cleared');
  };

  const handlePrint = () => {
    window.print();
  };

  const copyLiveLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/live');
    toast.success('Live View link copied! Share this with external parties.');
  };

  const handleEditReport = (report: any) => {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = report;
    setFormData({ ...INITIAL_FORM, ...rest });
    setCurrentDocId(id);
    setActiveSubTab('form');
    toast.success(`Report ${report.fltNo || ''} loaded for editing. Make changes and click Save Record.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>✈️ Flight Operation</h2>
        {currentDocId && (
          <span style={{ fontSize: '12px', background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: '6px', fontWeight: 700 }}>
            ✏️ Editing existing report — click <strong>New Record</strong> to start fresh
          </span>
        )}
      </div>

      <div className="ops-tabs no-print">
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

      {activeSubTab === 'form' && (
        <div>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {isManager && (
              <>
                <button className="quick-btn" style={{ background: '#2563eb', color: 'white' }} onClick={handleSave}>💾 Save Record</button>
                <button className="quick-btn" style={{ background: '#dcfce7', color: '#166534' }} onClick={handlePrint}>🖨️ Print / PDF</button>
                <button className="quick-btn" style={{ background: '#f1f5f9', color: '#334155' }} onClick={handleReset}>➕ New Record</button>
                <button className="quick-btn" style={{ background: '#8b5cf6', color: 'white' }} onClick={copyLiveLink}>🔗 Copy Live Link</button>
              </>
            )}
            {!isManager && <span style={{ color: '#dc2626', fontWeight: 600, alignSelf: 'center' }}>🔒 View Only (Live Sync)</span>}
          </div>

          <div className="ramp-container">
            <RampForm
              formData={formData}
              handleChange={handleChange}
              isManager={isManager}
              acTypes={acTypes}
              routeCodes={routeCodes}
              handleAddAcType={handleAddAcType}
              handleAddRoute={handleAddRoute}
              appendRoute={appendRoute}
            />
          </div>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <RampReportsPage onEdit={handleEditReport} />
      )}
    </div>
  );
}

export default RampCheckSheetPage;