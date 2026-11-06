import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const FND_ALL_STAFF = [
  { sn: 'SN-0037', name: 'Adam Faisal', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-0038', name: 'Adam Shakir', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-0439', name: 'Hassan Shujaau', position: 'Senior Airport Officer', department: 'Ground Operations' },
  { sn: 'SN-0725', name: 'Ahmed Aseel', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-0729', name: 'Mohamed Fuadhu', position: 'Operations Officer', department: 'Ground Operations' },
  { sn: 'SN-0730', name: 'Mohamed Nadheem', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-0733', name: 'Thoriq Mohamed', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-0754', name: 'Ali Shameem', position: 'Assistant Operations Officer', department: 'Ground Operations' },
  { sn: 'SN-0757', name: 'Mohamed Adam', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-1173', name: 'Mohamed Sameeh', position: 'Airport Hand', department: 'Ground Operations' },
  { sn: 'SN-0042', name: 'Aiminath Moosa', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0049', name: 'Mohamed Zaki', position: 'Maintenance Agent', department: 'Maintenance' },
  { sn: 'SN-0480', name: 'Mohamed Ibrahim', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0481', name: 'Zimla Ayyoob', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0484', name: 'Abdul Ghanee Mohamed', position: 'Assistant Manager', department: 'Maintenance' },
  { sn: 'SN-0980', name: 'Ismail Kameel', position: 'Maintenance Agent', department: 'Maintenance' },
  { sn: 'SN-1007', name: 'Muna Abdhul Qafoor', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-1008', name: 'Aiminath Maha', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-1009', name: 'Hassan Naafis', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0034', name: 'Abdulla Adam', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0035', name: 'Abdulla Aslam', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0036', name: 'Abdulla Mohamed', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0044', name: 'Hassan Abdul Rahman', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0437', name: 'Aminath Shehereeza', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0726', name: 'Mohamed Karam', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0727', name: 'Ahmed Jinah', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0728', name: 'Ibrahim Khalaf Ahmed', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0731', name: 'Aishath Maiha Adam', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0732', name: 'Aishath Sahana', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0755', name: 'Adam Maaidh', position: 'Security Agent', department: 'Security' },
  { sn: 'SN-0995', name: 'Mohamed Vishal', position: 'Assistant Security Officer', department: 'Security' },
  { sn: 'SN-0039', name: 'Adam Yaeesh', position: 'Leading Fireman', department: 'Fire & Rescue' },
  { sn: 'SN-0040', name: 'Ahmed Raushaan', position: 'Leading Fireman', department: 'Fire & Rescue' },
  { sn: 'SN-0041', name: 'Ali Navshad', position: 'Leading Fireman', department: 'Fire & Rescue' },
  { sn: 'SN-0047', name: 'Ismail Nifaaz Adam', position: 'Junior Firefighter', department: 'Fire & Rescue' },
  { sn: 'SN-0048', name: 'Maazin Hassan', position: 'Junior Firefighter', department: 'Fire & Rescue' },
  { sn: 'SN-0434', name: 'Ismail Shafeeq', position: 'Junior Firefighter', department: 'Fire & Rescue' },
  { sn: 'SN-0435', name: 'Ahmed Naahee', position: 'Junior Firefighter', department: 'Fire & Rescue' },
  { sn: 'SN-0959', name: 'Vishan Mohamed', position: 'Firefighter Trainee', department: 'Fire & Rescue' },
  { sn: 'SN-0960', name: 'Ahmed Ilham', position: 'Firefighter Trainee', department: 'Fire & Rescue' },
  { sn: 'SN-0961', name: 'Mohamed Hisham', position: 'Firefighter Trainee', department: 'Fire & Rescue' },
  { sn: 'SN-0967', name: 'Hassan Malaz', position: 'Assistant Safety Officer', department: 'Safety' },
  { sn: 'SN-0753', name: 'Mohamed Maayal', position: 'Airport Manager', department: 'Administration' },
  { sn: 'SN-0985', name: 'Aishath Nabaa', position: 'Assistant Administrative Officer', department: 'Administration' },
];

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration','Safety'];
const DESIGNATIONS = ['Airport Manager', 'Assistant Manager', 'Assistant Safety Officer', 'Senior Airport Officer', 'Operations Officer', 'Assistant Operations Officer', 'Assistant Security Officer', 'Assistant Administrative Officer', 'Leading Fireman', 'Junior Firefighter', 'Firefighter Trainee', 'Airport Hand', 'Security Agent', 'Maintenance Agent', 'Cleaning & Gardening'];
const SENSITIVE_INFO_ROLES = ['developer'];

function StaffPage() {
  const { profile, user } = useAuth();
  const isDev = profile?.role === 'developer';
  const isManager = ['manager','admin','owner'].includes(profile?.role || '');
  const canSeeSensitive = SENSITIVE_INFO_ROLES.includes(profile?.role || '');
  const canViewFinancials = isDev || isManager;

  const [staff, setStaff] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showFinancials, setShowFinancials] = useState<boolean>(false);
  const [showRegister, setShowRegister] = useState<boolean>(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string, sn: string } | null>(null);

  const [sn, setSn] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [personalEmail, setPersonalEmail] = useState<string>('');
  const [nid, setNid] = useState<string>('');
  const [joinDate, setJoinDate] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [department, setDepartment] = useState<string>('Ground Operations');
  const [position, setPosition] = useState<string>('');
  const [isSmt, setIsSMT] = useState<boolean>(false);
  const [balanceVisible, setBalanceVisible] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [basicSalary, setBasicSalary] = useState<string>('');
  const [dailyAllowance, setDailyAllowance] = useState<string>('');
  const [holidayAllowanceRate, setHolidayAllowanceRate] = useState<string>('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [createUserAccount, setCreateUserAccount] = useState<boolean>(true);

  const fetchStaff = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const data = await apiFetch('/staff');
      const records = Array.isArray(data) ? data : [];
      setStaff(records);
      const mine = records.find((member: any) => (member.email || '').toLowerCase() === (user?.email || '').toLowerCase());
      setMyStaff(mine || null);
      setLoadError('');
    } catch (err: any) {
      setLoadError(err.message || 'Staff records could not be loaded.');
      if (!quiet) toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { const initialLoad = window.setTimeout(() => void fetchStaff(true), 0); const interval = window.setInterval(() => void fetchStaff(true), 10000); return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); }; }, [fetchStaff]);

  const resetForm = () => {
    setSn(''); setName(''); setEmail(''); setPersonalEmail(''); setNid(''); setJoinDate(''); setPhone(''); setGender(''); setDepartment('Ground Operations'); setPosition('');
    setIsSMT(false); setBalanceVisible(false); setNotes(''); setBasicSalary(''); setDailyAllowance(''); setHolidayAllowanceRate(''); setPhotoBase64('');
    setCreateUserAccount(true); setEditingId(null);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!name || ((!editingId || isDev || isManager) && !email)) { toast.error('Name and Email are required'); return; }
    const payload: any = !isDev && !isManager && editingId
      ? { name, position, phone, gender, photoBase64 }
      : { sn, name, email, photoBase64, personalEmail, nid, joinDate, phone, gender, department, position, isSMT: isSmt, balanceVisible };
    if (canViewFinancials) {
      payload.basicSalary = Number(basicSalary) || 0;
      payload.dailyAllowance = Number(dailyAllowance) || 0;
      payload.holidayAllowanceRate = Number(holidayAllowanceRate) || 0;
    }
    if (canSeeSensitive) payload.notes = notes;

    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/staff/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Staff member updated!');
      } else {
        await apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Staff added!');
      }
      if (!editingId && createUserAccount) {
        await apiFetch('/user-presets', { method: 'POST', body: JSON.stringify({ email, role: isSmt ? 'smt' : 'staff', department, createdBy: profile?.email || '' }) });
        toast.success('Login account pre-registered!');
      }
      fetchStaff(); resetForm(); setShowForm(false);
    } catch (error: any) { toast.error('Error: ' + error.message); }
    finally { setSaving(false); }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id); setSn(s.sn || ''); setName(s.name || ''); setEmail(s.email || ''); setPersonalEmail(s.personalEmail || ''); setNid(s.nid || ''); setJoinDate(s.joinDate || ''); setPhone(s.phone || ''); setGender(s.gender || ''); setDepartment(s.department || 'Ground Operations'); setPosition(s.position || ''); setIsSMT(s.isSmt === true || s.isSMT === true); setBalanceVisible(!!s.balanceVisible); setNotes(s.notes || ''); setBasicSalary(s.basicSalary ? String(s.basicSalary) : ''); setDailyAllowance(s.dailyAllowance ? String(s.dailyAllowance) : ''); setHolidayAllowanceRate(s.holidayAllowanceRate ? String(s.holidayAllowanceRate) : ''); setPhotoBase64(s.photoBase64 || ''); setCreateUserAccount(false); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      toast.error('Profile photo must be a JPG, PNG or WebP image');
      return;
    }
    if (file.size > 650 * 1024) {
      toast.error('Photo must be 650 KB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error('The selected photo could not be read');
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:image/') || result.length > 900_000) {
        toast.error('The selected photo could not be prepared. Choose a smaller image.');
        return;
      }
      setPhotoBase64(result);
      toast.success('Profile photo ready to save');
    };
    reader.readAsDataURL(file);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await apiFetch(`/staff/${deleteTarget.id}`, { method: 'DELETE' }); toast.success('Staff deleted.'); fetchStaff(); setDeleteTarget(null); } 
    catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleImportAll = async () => {
    const missing = FND_ALL_STAFF.filter((m) => !staff.some((s) => s.sn === m.sn));
    if (missing.length === 0) { toast.info(`All staff are already in the system.`); return; }
    setImporting(true); let added = 0;
    try {
      for (const member of missing) {
        const payload = { sn: member.sn, name: member.name, email: `${member.sn.toLowerCase()}@funadhooairport.com`, department: member.department, position: member.position, isSMT: false, balanceVisible: false };
        await apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
        await apiFetch('/user-presets', { method: 'POST', body: JSON.stringify({ email: payload.email, role: 'staff', department: payload.department }) });
        added++;
      }
      toast.success(`Imported ${added} staff member(s).`); fetchStaff();
    } catch (error: any) { toast.error('Import failed: ' + error.message); }
    setImporting(false);
  };

  // Role-based staff controls
const myDept = myStaff?.department || profile?.department;
  const isDeptIncharge = myStaff?.isIncharge === true || profile?.isIncharge === true;
  const canEditStaff = (targetDept: string, target: any = {}) => {
    if (isDev || isManager) return true;
    if (!isDeptIncharge || targetDept !== myDept || target.isSmt === true || target.isSMT === true) return false;
    return !['developer','manager','admin','owner','smt'].includes(String(target.role || '').toLowerCase());
  };

  const canAddStaff = isDev || isManager;

  const visibleStaff = staff.filter((s) => {
    const matchesDepartment = selectedDept === 'all' || (selectedDept === 'SMT' ? (s.isSmt === true || s.isSMT === true) : s.department === selectedDept);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [s.sn, s.name, s.position, s.department, s.email].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesDepartment && matchesSearch;
  }).sort((a, b) => (a.sn || '').localeCompare(b.sn || ''));

  const departmentCount = new Set(staff.map((member) => member.department).filter(Boolean)).size;
  const smtCount = staff.filter((member) => member.isSmt === true || member.isSMT === true).length;

  if (loading) return <div className="page-content"><p>Loading data...</p></div>;

  return (
    <div className="page-content staff-management-page">
      <datalist id="designation-options">{DESIGNATIONS.map((d) => (<option key={d} value={d} />))}</datalist>

      <header className="staff-management-hero">
        <div>
          <span className="staff-management-kicker">People and access</span>
          <h2>Staff Management</h2>
          <p>Maintain personnel records, departmental assignments, and account readiness from one workspace.</p>
        </div>
        <div className="staff-management-hero__actions">
          <button type="button" className="staff-management-secondary" onClick={() => void fetchStaff()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {canViewFinancials && <button type="button" className="staff-management-secondary" onClick={() => setShowFinancials(!showFinancials)}>{showFinancials ? 'Hide financials' : 'Show financials'}</button>}
          {staff.length === 0 && canAddStaff && <button type="button" className="staff-management-secondary" onClick={handleImportAll} disabled={importing}>{importing ? 'Importing…' : 'Import FND staff'}</button>}
          {canAddStaff && <button type="button" className="staff-management-primary" onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }}>{showForm ? 'Close form' : 'Add staff member'}</button>}
        </div>
      </header>

      {loadError && <div className="staff-management-alert" role="alert"><strong>Staff information may be out of date.</strong><span>{loadError}</span></div>}

      <section className="staff-management-summary" aria-label="Staff summary">
        <div><span>Total workforce</span><strong>{staff.length}</strong><small>staff records</small></div>
        <div><span>Departments</span><strong>{departmentCount}</strong><small>active teams</small></div>
        <div><span>SMT members</span><strong>{smtCount}</strong><small>leadership records</small></div>
        <div><span>Current view</span><strong>{visibleStaff.length}</strong><small>matching records</small></div>
      </section>

      <section className="staff-management-controls">
        <label className="staff-management-search"><span>Search staff</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, SN, designation or email…" /></label>
        <div className="staff-management-filter-label"><span>Department</span><strong>{selectedDept === 'all' ? 'All departments' : selectedDept}</strong></div>
      </section>

      <nav className="staff-management-tabs" aria-label="Department filter">
        <button type="button" className={selectedDept === 'all' ? 'active' : ''} onClick={() => setSelectedDept('all')}>All <span>{staff.length}</span></button>
        {DEPARTMENTS.map((item) => <button type="button" key={item} className={selectedDept === item ? 'active' : ''} onClick={() => setSelectedDept(item)}>{item} <span>{staff.filter((member) => member.department === item).length}</span></button>)}
        <button type="button" className={selectedDept === 'SMT' ? 'active is-smt' : 'is-smt'} onClick={() => setSelectedDept('SMT')}>SMT <span>{smtCount}</span></button>
      </nav>
      {showForm && (
        <form className="staff-form staff-management-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, marginBottom: '4px' }}>{editingId ? '✏️ Edit Staff Member' : '➕ Add New Staff Member'}</div>
          <div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>👤 Personal Information</div>
          <input placeholder="SN Number (e.g. SN-0439)" value={sn} onChange={(e) => setSn(e.target.value)} disabled={!!editingId && !isDev && !isManager} />
          <input placeholder="Full Name *" value={name} onChange={(e) => setName(e.target.value)} required />
          <label className="staff-photo-upload"><span>{photoBase64 ? <img src={photoBase64} alt="Staff preview" /> : 'PHOTO'}</span><div><strong>Passport-size profile picture</strong><small>JPG or PNG, maximum 650 KB</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} /></div>{photoBase64 && <button type="button" onClick={() => setPhotoBase64('')}>Remove</button>}</label>
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Gender — select...</option><option value="Male">Male</option><option value="Female">Female</option></select>
          <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} title="Join Date" disabled={!!editingId && !isDev && !isManager} />
          <input placeholder="NID (National ID)" value={nid} onChange={(e) => setNid(e.target.value)} disabled={!!editingId && !isDev && !isManager} />
          <input type="email" placeholder="Work Email *" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!editingId && !isDev && !isManager} />
          <input type="email" placeholder="Personal Email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} disabled={!!editingId && !isDev && !isManager} />
          <div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#2563eb', marginTop: '8px' }}>💼 Job Information</div>
          <input list="designation-options" placeholder="Designation (type or pick from list)" value={position} onChange={(e) => setPosition(e.target.value)} />
          <select value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!!editingId && !isDev && !isManager}>{DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}</select>
          {canViewFinancials && <>
            <div className="staff-management-form__section staff-management-form__section--finance">Salary and allowances</div>
            <input type="number" placeholder="Basic Salary (MVR)" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} step="0.01" min="0" />
            <input type="number" placeholder="Daily Allowance (MVR)" value={dailyAllowance} onChange={(e) => setDailyAllowance(e.target.value)} step="0.01" min="0" />
            <input type="number" placeholder="Holiday Allowance Rate (MVR)" value={holidayAllowanceRate} onChange={(e) => setHolidayAllowanceRate(e.target.value)} step="0.01" min="0" />
          </>}
          {canSeeSensitive && (<><div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#dc2626', marginTop: '8px' }}>📝 Internal Notes (developer only)</div><textarea placeholder="Internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ gridColumn: 'span 2', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></>)}
          {(isDev || isManager || !editingId) && <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#92400e' }}><input type="checkbox" checked={isSmt} onChange={(e) => setIsSMT(e.target.checked)} style={{ width: '18px', height: '18px' }} />⭐ Mark as SMT (Senior Management Team) member</label>}
          {(isDev || isManager || !editingId) && <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#eff6ff', border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#1e40af' }}><input type="checkbox" checked={balanceVisible} onChange={(e) => setBalanceVisible(e.target.checked)} style={{ width: '18px', height: '18px' }} />👁 Allow this staff member to view their own leave balance</label>}
          {!editingId && (<label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#dcfce7', border: '1px solid #16a34a', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#166534' }}><input type="checkbox" checked={createUserAccount} onChange={(e) => setCreateUserAccount(e.target.checked)} style={{ width: '18px', height: '18px' }} />🔑 Create User Login (Pre-register email)</label>)}
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save staff member'}</button>
        </form>
      )}

      <div className="long-register-toolbar"><div><strong>Staff register</strong><span>{visibleStaff.length} matching records</span></div><button type="button" onClick={() => setShowRegister(value => !value)}>{showRegister ? 'Minimize' : 'Show list'}</button></div>
      <div className={`staff-list staff-management-list ${showRegister ? '' : 'long-register-collapsed'}`}>
        {visibleStaff.length === 0 ? (
          <div className="empty-state"><p>No staff members found for <strong>{selectedDept === 'all' ? 'All Departments' : selectedDept}</strong>.</p></div>
        ) : (
          <div className="staff-management-table-wrap">
            <table className="staff-management-table">
              <thead>
                <tr><th>SN</th><th>Name</th><th>Designation</th><th>Dept</th><th>Gender</th><th>Join Date</th>{showFinancials && (<><th>Basic Salary</th><th>Daily Allow.</th><th>Holiday Allow.</th></>)}{canSeeSensitive && <th>Notes</th>}<th>SMT</th><th>👁</th><th></th></tr>
              </thead>
              <tbody>
                {visibleStaff.map((s) => {
                  const hasEditPermission = canEditStaff(s.department, s);
                  return (
                    <tr key={s.id}>
                      <td>{s.sn || '—'}</td><td><strong>{s.name}</strong></td><td>{s.position || '—'}</td><td style={{ fontSize: '12px' }}>{s.department}</td><td>{s.gender || '—'}</td><td>{s.joinDate || '—'}</td>
                      {showFinancials && (<><td style={{ textAlign: 'right', fontWeight: 600 }}>{s.basicSalary ? `MVR ${Number(s.basicSalary).toLocaleString()}` : '—'}</td><td style={{ textAlign: 'right' }}>{s.dailyAllowance ? `MVR ${Number(s.dailyAllowance).toLocaleString()}` : '—'}</td><td style={{ textAlign: 'right' }}>{s.holidayAllowanceRate ? `MVR ${Number(s.holidayAllowanceRate).toLocaleString()}` : '—'}</td></>)}
                      {canSeeSensitive && (<td style={{ maxWidth: '200px', fontSize: '12px', color: s.notes ? '#1e293b' : '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-word' }}>{s.notes || '—'}</td>)}
                      <td style={{ textAlign: 'center', fontSize: '16px' }}>{s.isSmt === true || s.isSMT === true ? '⭐' : '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: '16px' }}>{s.balanceVisible ? '👁' : '🚫'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {hasEditPermission && (<><button className="edit-btn" onClick={() => handleEdit(s)} style={{ marginRight: '6px' }}>Edit</button>{canAddStaff && (<button className="delete-btn" onClick={() => setDeleteTarget({ id: s.id, name: s.name, sn: s.sn })}>Delete</button>)}</>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Staff Member?" message={`Are you sure you want to delete ${deleteTarget?.name} (${deleteTarget?.sn || 'No SN'})?`} confirmText="Delete" isDanger={true} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

export default StaffPage;
