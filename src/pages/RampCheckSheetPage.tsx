import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import RampReportsPage from './RampReportsPage';
import RampForm from './RampForm';
import { ConfirmDialog, PromptDialog } from '../components/Dialogs';
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
  cargoInPcs: '', cargoInKg: '', cargoOutPcs: '', cargoOutKg: '', cargoTransPcs: '', cargoTransKg: '',
  mailInPcs: '', mailInKg: '', mailOutPcs: '', mailOutKg: '', mailTransPcs: '', mailTransKg: '',
  bagInPcs: '', bagInKg: '', bagOutPcs: '', bagOutKg: '', bagTransPcs: '', bagTransKg: '',
  otherInPcs: '', otherInKg: '', otherOutPcs: '', otherOutKg: '', otherTransPcs: '', otherTransKg: '',
  cargoIn: '', cargoOut: '', cargoTrans: '', mailIn: '', mailOut: '', mailTrans: '',
  bagIn: '', bagOut: '', bagTrans: '', otherIn: '', otherOut: '', otherTrans: '',
  specialLoad: '', comments: '', delayTime: '', medicalEmergency: ''
};

function RampCheckSheetPage() {
  const { profile, user } = useAuth();
  
  // 🚨 RBAC LOGIC
  const role = String(profile?.role || "").toLowerCase();
  const isFullAccess = ["developer", "manager", "owner", "admin"].includes(role);
  const isSmt = role === "smt" || profile?.isSmt === true || profile?.isSMT === true;
  const canView = isFullAccess || isSmt || profile?.specialOpsAccess === true || profile?.rampsheetViewAccess === true || profile?.rampsheetEditAccess === true;
  const canEdit = isFullAccess || profile?.specialOpsAccess === true || profile?.rampsheetEditAccess === true;

  // ---- All hooks first (rules of hooks) ----
  const [activeSubTab, setActiveSubTab] = useState<'form' | 'reports'>('form');
  const [formData, setFormData] = useState<Record<string, string>>(INITIAL_FORM);
  const [acTypes, setAcTypes] = useState<string[]>([]);
  const [routeCodes, setRouteCodes] = useState<string[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [scheduledFlights, setScheduledFlights] = useState<any[]>([]);

  const typingTimer = useRef<any>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearLiveConfirm, setShowClearLiveConfirm] = useState(false);
  const [promptAction, setPromptAction] = useState<'acType' | 'routeCode' | null>(null);

  useEffect(() => {
    const savedAc = JSON.parse(localStorage.getItem('acTypes') || '[]');
    setAcTypes([...new Set([...DEFAULT_AC_TYPES, ...savedAc])]);

    const savedRoutes = JSON.parse(localStorage.getItem('routeCodes') || '[]');
    setRouteCodes([...new Set([...DEFAULT_ROUTE_CODES, ...savedRoutes])]);
  }, []);

  useEffect(() => {
    apiFetch('/flights').then(data => setScheduledFlights(Array.isArray(data) ? data : [])).catch(() => setScheduledFlights([]));
  }, []);

  useEffect(() => {
    if (!canEdit || !formData.date || !formData.fltNo) return;
    const normalizeFlight = (value: string) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    const match = scheduledFlights.find(flight => flight.date === formData.date && normalizeFlight(flight.flightNo) === normalizeFlight(formData.fltNo));
    if (!match) return;
    setFormData(current => ({
      ...current,
      acType: current.acType || match.aircraft || '',
      route: current.route || match.route || '',
      checkIn: current.checkIn || match.checkInTime || '',
      sta: current.sta || match.arrivalTime || '',
      eta: current.eta || match.eta || '',
      ata: current.ata || match.ata || '',
      atd: current.atd || match.atd || '',
      paxOutAdult: current.paxOutAdult || (match.paxAdults ? String(match.paxAdults) : ''),
      paxOutInf: current.paxOutInf || (match.paxInfants ? String(match.paxInfants) : ''),
      paxOutTotal: current.paxOutTotal || (Number(match.paxAdults) + Number(match.paxInfants) ? String((Number(match.paxAdults) || 0) + (Number(match.paxInfants) || 0)) : ''),
    }));
  }, [canEdit, formData.date, formData.fltNo, scheduledFlights]);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await apiFetch('/ramp/draft');
        if (draft && Object.keys(draft).length > 0) {
          setFormData(prev => ({ ...prev, ...draft }));
        }
      } catch (err) { console.error("Failed to load draft", err); }
    };
    if (canEdit) loadDraft();
  }, [canEdit]);

  // ---- Early return AFTER all hooks ----
  if (!canView) {
    return (
      <div className="page-content ramp-workspace-page">
        <div className="empty-state">
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Flight Operation sheet.</p>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!canEdit) return;
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

      const prefixes = ['cargo', 'mail', 'bag', 'other'];
      prefixes.forEach(prefix => {
        if (id.startsWith(`${prefix}InPcs`) || id.startsWith(`${prefix}InKg`)) updated[`${prefix}In`] = `${updated[`${prefix}InPcs`] || ''}/${updated[`${prefix}InKg`] || ''}`;
        if (id.startsWith(`${prefix}OutPcs`) || id.startsWith(`${prefix}OutKg`)) updated[`${prefix}Out`] = `${updated[`${prefix}OutPcs`] || ''}/${updated[`${prefix}OutKg`] || ''}`;
        if (id.startsWith(`${prefix}TransPcs`) || id.startsWith(`${prefix}TransKg`)) updated[`${prefix}Trans`] = `${updated[`${prefix}TransPcs`] || ''}/${updated[`${prefix}TransKg`] || ''}`;
      });

      return updated;
    });

    setDraftStatus('saving');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setFormData(current => {
        void apiFetch('/ramp/draft', { method: 'POST', body: JSON.stringify(current) })
          .then(() => setDraftStatus('saved'))
          .catch((err) => { console.error("Draft save failed", err); setDraftStatus('error'); toast.error('Draft autosave failed'); });
        return current;
      });
      typingTimer.current = null;
    }, 800);
  };

  const handleAddAcType = () => setPromptAction('acType');
  const handleAddRoute = () => setPromptAction('routeCode');

  const executePrompt = (val: string) => {
    if (!val.trim()) return;
    const uppercaseVal = val.trim().toUpperCase();

    if (promptAction === 'acType') {
      const updated = [...new Set([...acTypes, uppercaseVal])];
      setAcTypes(updated);
      localStorage.setItem('acTypes', JSON.stringify(updated));
      setFormData(prev => ({ ...prev, acType: uppercaseVal }));
    } else if (promptAction === 'routeCode') {
      const updated = [...new Set([...routeCodes, uppercaseVal])];
      setRouteCodes(updated);
      localStorage.setItem('routeCodes', JSON.stringify(updated));
    }
    setPromptAction(null);
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
    if (!canEdit || saving) return;
    if (!formData.date || formData.fltNo.length < 3 || formData.acReg.length < 3) {
      toast.error('Date, flight number and aircraft registration are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...formData } as any;

      payload.checkedBy = user?.email || formData.checkedBy || formData.observer || 'System';

      if (currentDocId) {
        await apiFetch(`/ramp/reports/${currentDocId}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Record updated!');
      } else {
        const res = await apiFetch('/ramp/reports', { method: 'POST', body: JSON.stringify(payload) });
        setCurrentDocId(res.id);
        toast.success('Record saved!');
      }

    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleReset = () => setShowClearConfirm(true);

  const clearLivePage = async () => {
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = null; }
    try {
      await apiFetch('/ramp/draft', { method: 'POST', body: JSON.stringify({}) });
      setDraftStatus('saved');
      toast.success('Live page cleared');
      setShowClearLiveConfirm(false);
    } catch (err: any) {
      toast.error(err.message || 'Unable to clear the live page');
    }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-ramp');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-ramp'), 1000);
  };

  const copyLiveLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + '/live'); toast.success('Live View link copied'); }
    catch { toast.error('Unable to copy the live link'); }
  };

  const handleEditReport = (report: any) => {
    if (!canEdit) return;
    const { id, createdAt: _c, updatedAt: _u, ...rest } = report;
    
    const parsedReport = { ...rest };
    const prefixes = ['cargo', 'mail', 'bag', 'other'];
    prefixes.forEach(prefix => {
      if (parsedReport[`${prefix}In`] && !parsedReport[`${prefix}InPcs`]) {
        const [p, k] = parsedReport[`${prefix}In`].split('/');
        parsedReport[`${prefix}InPcs`] = p || '';
        parsedReport[`${prefix}InKg`] = k || '';
      }
      if (parsedReport[`${prefix}Out`] && !parsedReport[`${prefix}OutPcs`]) {
        const [p, k] = parsedReport[`${prefix}Out`].split('/');
        parsedReport[`${prefix}OutPcs`] = p || '';
        parsedReport[`${prefix}OutKg`] = k || '';
      }
      if (parsedReport[`${prefix}Trans`] && !parsedReport[`${prefix}TransPcs`]) {
        const [p, k] = parsedReport[`${prefix}Trans`].split('/');
        parsedReport[`${prefix}TransPcs`] = p || '';
        parsedReport[`${prefix}TransKg`] = k || '';
      }
    });

    setFormData({ ...INITIAL_FORM, ...parsedReport });
    setCurrentDocId(id);
    setActiveSubTab('form');
    toast.success(`Report ${report.fltNo || ''} loaded for editing. Make changes and click Save Record.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-content ramp-workspace-page">
      <div className="staff-header no-print ramp-workspace-header">
        <h2>✈️ Flight Operation</h2>
        <div className="ramp-workspace-header__actions">
          {canEdit && <span className={`ramp-draft-status ${draftStatus}`}>{draftStatus === 'saving' ? 'Saving draft…' : draftStatus === 'error' ? 'Draft not saved' : 'Draft saved'}</span>}
          {currentDocId && (
            <span style={{ fontSize: '12px', background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: '6px', fontWeight: 700 }}>
              ✏️ Editing existing report — click <strong>Clear Form</strong> to start fresh
            </span>
          )}
          <button className="quick-btn" style={{ background: '#8b5cf6', color: 'white' }} onClick={copyLiveLink}>🔗 Copy Live Link</button>
          {canEdit && <button className="quick-btn ramp-clear-live-btn" onClick={() => setShowClearLiveConfirm(true)}>Clear Live Page</button>}
        </div>
      </div>

      <div className="ops-tabs no-print">
        <button className={`ops-tab-btn ${activeSubTab === 'form' ? 'active' : ''}`} onClick={() => setActiveSubTab('form')}>
          📝 Ramp Supervisor Check Sheet
        </button>
        <button className={`ops-tab-btn ${activeSubTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveSubTab('reports')}>
          📁 Saved Reports
        </button>
      </div>

      {activeSubTab === 'form' && (
        <div>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {canEdit && (
              <>
                <button className="quick-btn" disabled={saving} style={{ background: '#2563eb', color: 'white' }} onClick={handleSave}>{saving ? 'Saving…' : '💾 Save Record'}</button>
                <button className="quick-btn" style={{ background: '#dcfce7', color: '#166534' }} onClick={handlePrint}>🖨️ Print / PDF</button>
                <button className="quick-btn" style={{ background: '#fee2e2', color: '#991b1b' }} onClick={handleReset}>🗑️ Clear Form</button>
              </>
            )}
          </div>

          <div className="ramp-container">
            <RampForm
              formData={formData}
              handleChange={handleChange}
              isManager={canEdit}
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
        <RampReportsPage onEdit={canEdit ? handleEditReport : undefined} />
      )}

      <ConfirmDialog 
        isOpen={showClearConfirm}
        title="Clear Form?"
        message="Are you sure you want to clear the form? Unsaved data will be lost."
        confirmText="Clear Form"
        isDanger={true}
        onConfirm={() => {
          if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = null; }
          setFormData(INITIAL_FORM);
          setCurrentDocId(null);
          apiFetch('/ramp/draft', { method: 'POST', body: JSON.stringify({}) });
          toast.success('Form cleared');
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showClearLiveConfirm}
        title="Clear Live Page?"
        message="This removes the current data from the public live page. The Ramp Sheet form and saved record will remain unchanged."
        confirmText="Clear Live Page"
        isDanger={true}
        onConfirm={() => void clearLivePage()}
        onCancel={() => setShowClearLiveConfirm(false)}
      />

      <PromptDialog 
        isOpen={!!promptAction}
        title={promptAction === 'acType' ? "Add A/C Type" : "Add Route Code"}
        message={promptAction === 'acType' ? "Enter new A/C Type (e.g. B737-800)" : "Enter new Airport Code (e.g. MLE)"}
        placeholder="Type here..."
        onSubmit={executePrompt}
        onCancel={() => setPromptAction(null)}
      />
    </div>
  );
}

export default RampCheckSheetPage;