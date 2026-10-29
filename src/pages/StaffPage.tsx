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
  const { profile } = useAuth();
  const canSeeSensitive = SENSITIVE_INFO_ROLES.includes(profile?.role || '');

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [showFinancials, setShowFinancials] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string, sn: string } | null>(null);

  // Form states
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
  const [isSMT, setIsSMT] = useState<boolean>(false);
  const [isIncharge, setIsIncharge] = useState<boolean>(false); // New State
  const [balanceVisible, setBalanceVisible] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [basicSalary, setBasicSalary] = useState<string>('');
  const [dailyAllowance, setDailyAllowance] = useState<string>('');
  const [holidayAllowanceRate, setHolidayAllowanceRate] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [createUserAccount, setCreateUserAccount] = useState<boolean>(true);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await apiFetch('/staff');
      setStaff(data);
      setLoading(false);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    const interval = setInterval(fetchStaff, 10000);
    return () => clearInterval(interval);
  }, [fetchStaff]);

  const resetForm = () => {
    setSn(''); setName(''); setEmail(''); setPersonalEmail('');
    setNid(''); setJoinDate(''); setPhone(''); setGender('');
    setDepartment('Ground Operations'); setPosition('');
    setIsSMT(false); setIsIncharge(false); setBalanceVisible(false); setNotes('');
    setBasicSalary(''); setDailyAllowance('');
    setHolidayAllowanceRate(''); setBankAccount('');
    setCreateUserAccount(true);
    setEditingId(null);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!name || !email) { toast.error('Name and Email are required'); return; }
    
    const payload: any = {
      sn, name, email, personalEmail, nid, joinDate, phone, gender,
      department, position, isSMT, isIncharge, balanceVisible,
      basicSalary: Number(basicSalary) || 0,
      dailyAllowance: Number(dailyAllowance) || 0,
      holidayAllowanceRate: Number(holidayAllowanceRate) || 0,
      bankAccount,
    };
    if (canSeeSensitive) payload.notes = notes;

    try {
      if (editingId) {
        await apiFetch(`/staff/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Staff member updated successfully!');
      } else {
        await apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Staff added successfully!');
      }

      if (!editingId && createUserAccount) {
        try {
          const userRole = isSMT ? 'smt' : 'staff';
          await apiFetch('/user-presets', {
            method: 'POST',
            body: JSON.stringify({ email, role: userRole, department, createdBy: profile?.email || '' })
          });
          toast.success(`Login account pre-registered as ${userRole.toUpperCase()}!`);
        } catch (userErr: any) {
          toast.error('Staff saved, but failed to create user login.');
        }
      }

      fetchStaff(); resetForm(); setShowForm(false);
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setSn(s.sn || ''); setName(s.name || ''); setEmail(s.email || '');
    setPersonalEmail(s.personalEmail || ''); setNid(s.nid || '');
    setJoinDate(s.joinDate || ''); setPhone(s.phone || ''); setGender(s.gender || '');
    setDepartment(s.department || 'Ground Operations'); setPosition(s.position || '');
    setIsSMT(!!s.isSMT); setIsIncharge(!!s.isIncharge); setBalanceVisible(!!s.balanceVisible);
    setNotes(s.notes || ''); setBasicSalary(s.basicSalary ? String(s.basicSalary) : '');
    setDailyAllowance(s.dailyAllowance ? String(s.dailyAllowance) : '');
    setHolidayAllowanceRate(s.holidayAllowanceRate ? String(s.holidayAllowanceRate) : '');
    setBankAccount(s.bankAccount || '');
    setCreateUserAccount(false); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/staff/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Staff member deleted.'); fetchStaff(); setDeleteTarget(null);
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleImportAll = async () => {
    const missing = FND_ALL_STAFF.filter((m) => !staff.some((s) => s.sn === m.sn));
    if (missing.length === 0) { toast.info(`All staff already in system.`); return; }

    setImporting(true);
    let added = 0;
    try {
      for (const member of missing) {
        const payload = { sn: member.sn, name: member.name, email: `${member.sn.toLowerCase()}@funadhooairport.com`, department: member.department, position: member.position, isSMT: false, isIncharge: false, balanceVisible: false };
        await apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
        await apiFetch('/user-presets', { method: 'POST', body: JSON.stringify({ email: payload.email, role: 'staff', department: payload.department }) });
        added++;
      }
      toast.success(`Imported ${added} staff member(s).`); fetchStaff();
    } catch (error: any) { toast.error('Import failed: ' + error.message); }
    setImporting(false);
  };

  const showImportButton = staff.length === 0;
  const visibleStaff = staff.filter((s) => {
      if (selectedDept === 'all') return true;
      if (selectedDept === 'SMT') return s.isSMT === true;
      return s.department === selectedDept;
    })
    .sort((a, b) => (a.sn || '').localeCompare(b.sn || ''));

  if (loading) return <div className="page-content"><p>Loading data...</p></div>;

  return (
    <div className="page-content">
      <datalist id="designation-options">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>

      <div className="staff-header">
        <h2>Staff Management <span style={{ fontSize: '13px', marginLeft: '10px', color: '#64748b', fontWeight: 500 }}>({selectedDept === 'all' ? 'All Departments' : selectedDept})</span></h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={showFinancials ? 'export-btn pdf-btn' : 'export-btn print-btn'} onClick={() => setShowFinancials(!showFinancials)}>{showFinancials ? '🙈 Hide Financials' : '💰 Show Financials'}</button>
          {showImportButton && <button className="export-btn jpg-btn" onClick={handleImportAll} disabled={importing}>{importing ? 'Importing...' : '📥 Import All FND Staff'}</button>}
          <button className="add-staff-btn" onClick={() => (showForm ? resetForm() : setShowForm(true))}>{showForm ? 'Cancel' : '+ Add Staff'}</button>
        </div>
      </div>

      <div className="dept-tabs">
        <button className={selectedDept === 'all' ? 'dept-tab active' : 'dept-tab'} onClick={() => setSelectedDept('all')}>All Departments</button>
        {DEPARTMENTS.map((d) => <button key={d} className={selectedDept === d ? 'dept-tab active' : 'dept-tab'} onClick={() => setSelectedDept(d)}>{d}</button>)}
        <button className={selectedDept === 'SMT' ? 'dept-tab active' : 'dept-tab'} onClick={() => setSelectedDept('SMT')} style={{ borderColor: '#f59e0b', color: selectedDept === 'SMT' ? '#fff' : '#92400e', backgroundColor: selectedDept === 'SMT' ? '#f59e0b' : '#fef3c7' }}>⭐ SMT Members</button>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>{editingId ? '✏️ Edit Staff Member' : '➕ Add New Staff Member'}</div>

          <div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#2563eb', marginTop: '4px' }}>👤 Personal Information</div>
          <input placeholder="SN Number" value={sn} onChange={(e) => setSn(e.target.value)} />
          <input placeholder="Full Name *" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Gender...</option><option value="Male">Male</option><option value="Female">Female</option></select>
          <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} title="Join Date" />
          <input placeholder="NID" value={nid} onChange={(e) => setNid(e.target.value)} />
          <input type="email" placeholder="Work Email *" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="email" placeholder="Personal Email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} />

          <div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#2563eb', marginTop: '8px' }}>💼 Job Information</div>
          <input list="designation-options" placeholder="Designation" value={position} onChange={(e) => setPosition(e.target.value)} />
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select>

          <div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#16a34a', marginTop: '8px' }}>💰 Salary & Allowances</div>
          <input type="number" placeholder="Basic Salary (MVR)" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} />
          <input type="number" placeholder="Daily Allowance (MVR)" value={dailyAllowance} onChange={(e) => setDailyAllowance(e.target.value)} />
          <input type="number" placeholder="Holiday Allowance Rate (MVR)" value={holidayAllowanceRate} onChange={(e) => setHolidayAllowanceRate(e.target.value)} />
          <input placeholder="Bank Account Number" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />

          {canSeeSensitive && (<><div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 600, color: '#dc2626', marginTop: '8px' }}>📝 Internal Notes</div><textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ gridColumn: 'span 2', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></>)}

          <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#92400e', fontSize: '14px' }}>
            <input type="checkbox" checked={isSMT} onChange={(e) => setIsSMT(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />⭐ Mark as SMT (Senior Management Team) member
          </label>

          {/* NEW: Incharge Checkbox */}
          {isSMT && (
            <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#e0f2fe', border: '1px solid #0284c7', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#0369a1', fontSize: '14px' }}>
              <input type="checkbox" checked={isIncharge} onChange={(e) => setIsIncharge(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />👑 Assign as Department Incharge (Can approve SMT leaves)
            </label>
          )}

          <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#eff6ff', border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#1e40af', fontSize: '14px' }}>
            <input type="checkbox" checked={balanceVisible} onChange={(e) => setBalanceVisible(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />👁 Allow staff to view their leave balance
          </label>

          {!editingId && (
            <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#dcfce7', border: '1px solid #16a34a', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#166534', fontSize: '14px' }}>
              <input type="checkbox" checked={createUserAccount} onChange={(e) => setCreateUserAccount(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />🔑 Create User Login
            </label>
          )}

          <button type="submit">{editingId ? '💾 Save Changes' : 'Save Staff Member'}</button>
        </form>
      )}

      <div className="staff-list">
        {visibleStaff.length === 0 ? (<div className="empty-state"><p>No staff found.</p></div>) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>SN</th><th>Name</th><th>Designation</th><th>Dept</th><th>Gender</th><th>Join Date</th>
                  {showFinancials && (<><th>Basic Salary</th><th>Daily Allow.</th><th>Holiday Allow.</th></>)}
                  {canSeeSensitive && <th>Notes</th>}
                  <th>SMT</th><th>👑</th><th>👁</th><th></th>
                </tr>
              </thead>
              <tbody>
                {visibleStaff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.sn || '—'}</td><td><strong>{s.name}</strong></td><td>{s.position || '—'}</td><td style={{ fontSize: '12px' }}>{s.department}</td><td>{s.gender || '—'}</td><td>{s.joinDate || '—'}</td>
                    {showFinancials && (<><td style={{ textAlign: 'right', fontWeight: 600 }}>{s.basicSalary ? `MVR ${Number(s.basicSalary).toLocaleString()}` : '—'}</td><td style={{ textAlign: 'right' }}>{s.dailyAllowance ? `MVR ${Number(s.dailyAllowance).toLocaleString()}` : '—'}</td><td style={{ textAlign: 'right' }}>{s.holidayAllowanceRate ? `MVR ${Number(s.holidayAllowanceRate).toLocaleString()}` : '—'}</td></>)}
                    {canSeeSensitive && (<td style={{ maxWidth: '200px', fontSize: '12px', color: s.notes ? '#1e293b' : '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-word' }}>{s.notes || '—'}</td>)}
                    <td style={{ textAlign: 'center', fontSize: '16px' }}>{s.isSMT ? '⭐' : '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: '16px' }}>{s.isIncharge ? '👑' : '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: '16px' }}>{s.balanceVisible ? '👁' : '🚫'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="edit-btn" onClick={() => handleEdit(s)} style={{ marginRight: '6px' }}>Edit</button>
                      <button className="delete-btn" onClick={() => setDeleteTarget({ id: s.id, name: s.name, sn: s.sn })}>Delete</button>
                    </td>
                  </tr>
                ))}
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