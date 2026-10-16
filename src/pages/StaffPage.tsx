import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// ===== COMPLETE FND STAFF MASTER LIST =====
// Import skips any SN that already exists in the database.
// Administration is NOT a roster department — those staff don't appear in the duty roster.
const FND_ALL_STAFF = [
  // ---------- Ground Operations ----------
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

  // ---------- Maintenance ----------
  { sn: 'SN-0042', name: 'Aiminath Moosa', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0049', name: 'Mohamed Zaki', position: 'Maintenance Agent', department: 'Maintenance' },
  { sn: 'SN-0480', name: 'Mohamed Ibrahim', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0481', name: 'Zimla Ayyoob', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-0484', name: 'Abdul Ghanee Mohamed', position: 'Assistant Manager', department: 'Maintenance' },
  { sn: 'SN-0980', name: 'Ismail Kameel', position: 'Maintenance Agent', department: 'Maintenance' },
  { sn: 'SN-1007', name: 'Muna Abdhul Qafoor', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-1008', name: 'Aiminath Maha', position: 'Cleaning & Gardening', department: 'Maintenance' },
  { sn: 'SN-1009', name: 'Hassan Naafis', position: 'Cleaning & Gardening', department: 'Maintenance' },

  // ---------- Security ----------
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

  // ---------- Fire & Rescue ----------
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
  { sn: 'SN-0967', name: 'Hassan Malaz', position: 'Assistant Safety Officer', department: 'Fire & Rescue' },

  // ---------- Administration (NO ROSTER — office staff) ----------
  { sn: 'SN-0753', name: 'Mohamed Maayal', position: 'Airport Manager', department: 'Administration' },
  { sn: 'SN-0985', name: 'Aishath Nabaa', position: 'Assistant Administrative Officer', department: 'Administration' },
];

// Roster departments (3 operational + Fire & Rescue). Administration is separate — no roster.
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration'];

const DESIGNATIONS = [
  'Airport Manager',
  'Manager',
  'Assistant Manager',
  'Assistant Safety Officer',
  'Senior Airport Officer',
  'Operations Officer',
  'Assistant Operations Officer',
  'Assistant Security Officer',
  'Assistant Administrative Officer',
  'Leading Fireman',
  'Senior Fire Fighter',
  'Fire Fighter',
  'Junior Firefighter',
  'Firefighter Trainee',
  'Airport Hand',
  'Security Agent',
  'Maintenance Agent',
  'Cleaning & Gardening',
];

function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const [sn, setSn] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [department, setDepartment] = useState<string>('Ground Operations');
  const [position, setPosition] = useState<string>('');
  const [isSMT, setIsSMT] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'staff'), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStaff(data);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setSn('');
    setName('');
    setEmail('');
    setPhone('');
    setDepartment('Ground Operations');
    setPosition('');
    setIsSMT(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Name and Email are required');
      return;
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, 'staff', editingId), {
          sn, name, email, phone, department, position, isSMT,
        });
        alert('Staff updated successfully!');
      } else {
        await addDoc(collection(db, 'staff'), {
          sn, name, email, phone, department, position, isSMT,
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        alert('Staff added successfully!');
      }
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setSn(s.sn || '');
    setName(s.name || '');
    setEmail(s.email || '');
    setPhone(s.phone || '');
    setDepartment(s.department || 'Ground Operations');
    setPosition(s.position || '');
    setIsSMT(!!s.isSMT);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    await deleteDoc(doc(db, 'staff', id));
  };

  const handleCancelForm = () => {
    resetForm();
    setShowForm(false);
  };

  const handleImportAll = async () => {
    const missing = FND_ALL_STAFF.filter((m) => !staff.some((s) => s.sn === m.sn));

    if (missing.length === 0) {
      alert(
        `✅ All ${FND_ALL_STAFF.length} staff members from the master list are already in the system.\n\n` +
        `No new records to add.`
      );
      return;
    }

    const byDept: { [key: string]: number } = {};
    missing.forEach((m) => {
      byDept[m.department] = (byDept[m.department] || 0) + 1;
    });
    const breakdown = Object.entries(byDept)
      .map(([dept, count]) => `  • ${dept}: ${count}`)
      .join('\n');

    const ok = window.confirm(
      `This will add ${missing.length} new staff member(s) from the master FND list.\n\n` +
      `Breakdown by department:\n${breakdown}\n\n` +
      `Existing staff (matched by SN) will be skipped.\n\n` +
      `Continue?`
    );
    if (!ok) return;

    setImporting(true);
    let added = 0;
    let failed = 0;
    try {
      for (const member of missing) {
        try {
          await addDoc(collection(db, 'staff'), {
            sn: member.sn,
            name: member.name,
            email: `${member.sn.toLowerCase()}@funadhooairport.com`,
            phone: '',
            department: member.department,
            position: member.position,
            isSMT: false,
            status: 'active',
            createdAt: new Date().toISOString(),
          });
          added++;
        } catch (err) {
          failed++;
        }
      }
      alert(
        `✅ Imported ${added} staff member(s).` +
        (failed > 0 ? `\n⚠ ${failed} record(s) failed.` : '')
      );
    } catch (error: any) {
      alert('Import failed: ' + error.message);
    }
    setImporting(false);
  };

  const visibleStaff = staff
    .filter((s) => {
      if (selectedDept === 'all') return true;
      if (selectedDept === 'SMT') return s.isSMT === true;
      return s.department === selectedDept;
    })
    .sort((a, b) => (a.sn || '').localeCompare(b.sn || ''));

  return (
    <div className="page-content">
      <datalist id="designation-options">
        {DESIGNATIONS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <div className="staff-header">
        <h2>
          Staff Management
          <span style={{ fontSize: '13px', marginLeft: '10px', color: '#64748b', fontWeight: 500 }}>
            ({selectedDept === 'all' ? 'All Departments' : selectedDept})
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="export-btn jpg-btn"
            onClick={handleImportAll}
            disabled={importing}
          >
            {importing ? 'Importing...' : '📥 Import All FND Staff'}
          </button>
          <button
            className="add-staff-btn"
            onClick={() => (showForm ? handleCancelForm() : setShowForm(true))}
          >
            {showForm ? 'Cancel' : '+ Add Staff'}
          </button>
        </div>
      </div>

      <div className="dept-tabs">
        <button
          className={selectedDept === 'all' ? 'dept-tab active' : 'dept-tab'}
          onClick={() => setSelectedDept('all')}
        >
          All Departments
        </button>
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            className={selectedDept === d ? 'dept-tab active' : 'dept-tab'}
            onClick={() => setSelectedDept(d)}
          >
            {d}
          </button>
        ))}
        <button
          className={selectedDept === 'SMT' ? 'dept-tab active' : 'dept-tab'}
          onClick={() => setSelectedDept('SMT')}
          style={{
            borderColor: '#f59e0b',
            color: selectedDept === 'SMT' ? '#fff' : '#92400e',
            backgroundColor: selectedDept === 'SMT' ? '#f59e0b' : '#fef3c7',
          }}
        >
          ⭐ SMT Members
        </button>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            {editingId ? '✏️ Edit Staff Member' : '➕ Add New Staff Member'}
          </div>
          <input
            placeholder="SN Number (e.g. SN-0439)"
            value={sn}
            onChange={(e) => setSn(e.target.value)}
          />
          <input
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            list="designation-options"
            placeholder="Designation (type or pick from list)"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />

          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <label
            style={{
              gridColumn: 'span 2',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              color: '#92400e',
              fontSize: '14px',
            }}
          >
            <input
              type="checkbox"
              checked={isSMT}
              onChange={(e) => setIsSMT(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            ⭐ Mark as SMT (Senior Management Team) member
          </label>

          <button type="submit">
            {editingId ? '💾 Save Changes' : 'Save Staff Member'}
          </button>
        </form>
      )}

      <div className="staff-list">
        {visibleStaff.length === 0 ? (
          <div className="empty-state">
            <p>
              No staff members found for{' '}
              <strong>{selectedDept === 'all' ? 'All Departments' : selectedDept}</strong>.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SN</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th>Department</th>
                <th>SMT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((s) => (
                <tr key={s.id}>
                  <td>{s.sn || '—'}</td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.email}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.position || '—'}</td>
                  <td>{s.department}</td>
                  <td style={{ textAlign: 'center', fontSize: '16px' }}>
                    {s.isSMT ? '⭐' : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(s)}
                      style={{ marginRight: '6px' }}
                    >
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(s.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default StaffPage;