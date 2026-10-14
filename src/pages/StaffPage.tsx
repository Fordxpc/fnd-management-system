import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// The default FND Ground Operations staff list with positions
const FND_STAFF = [
  { sn: 'SN-0439', name: 'Hassan Sujaau', position: 'Senior Airport Officer' },
  { sn: 'SN-0729', name: 'Mohamed Fuadh', position: 'Operations Officer' },
  { sn: 'SN-0754', name: 'Ali Shameem', position: 'Assistant Operations Officer' },
  { sn: 'SN-0037', name: 'Adam Faisal', position: 'Airport Hand' },
  { sn: 'SN-0038', name: 'Adam Skakir', position: 'Airport Hand' },
  { sn: 'SN-0758', name: 'Mohamed Adam', position: 'Airport Hand' },
  { sn: 'SN-0733', name: 'Thoriq Mohamed', position: 'Airport Hand' },
  { sn: 'SN-0725', name: 'Ahmed Aseel', position: 'Airport Hand' },
  { sn: 'SN-0730', name: 'Mohamed Nadheem', position: 'Airport Hand' },
  { sn: 'SN-1173', name: 'Mohamed Sameeh', position: 'Airport Hand' },
];

function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sn, setSn] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [position, setPosition] = useState('');

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
    setDepartment('Operations');
    setPosition('');
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
        // Update existing
        await updateDoc(doc(db, 'staff', editingId), {
          sn,
          name,
          email,
          phone,
          department,
          position,
        });
        alert('Staff updated successfully!');
      } else {
        // Add new
        await addDoc(collection(db, 'staff'), {
          sn,
          name,
          email,
          phone,
          department,
          position,
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
    setDepartment(s.department || 'Operations');
    setPosition(s.position || '');
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

  const handleImportFNDStaff = async () => {
    if (!window.confirm(
      `This will add ${FND_STAFF.length} FND Ground Operations staff members to the database.\n\n` +
      `Their email addresses will be placeholders — you can edit them later.\n\n` +
      `Continue?`
    )) return;

    setSeeding(true);
    let added = 0;
    try {
      for (const member of FND_STAFF) {
        const exists = staff.some((s) => s.sn === member.sn);
        if (exists) continue;

        await addDoc(collection(db, 'staff'), {
          sn: member.sn,
          name: member.name,
          email: `${member.sn.toLowerCase()}@funadhooairport.com`,
          phone: '',
          department: 'Operations',
          position: member.position,
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        added++;
      }
      alert(`Successfully imported ${added} staff members!`);
    } catch (error: any) {
      alert('Import failed: ' + error.message);
    }
    setSeeding(false);
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Staff Management</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {staff.length === 0 && (
            <button
              className="export-btn jpg-btn"
              onClick={handleImportFNDStaff}
              disabled={seeding}
            >
              {seeding ? 'Importing...' : '📥 Import FND Ground Ops Staff'}
            </button>
          )}
          <button
            className="add-staff-btn"
            onClick={() => (showForm ? handleCancelForm() : setShowForm(true))}
          >
            {showForm ? 'Cancel' : '+ Add Staff'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: '600', color: '#1e293b' }}>
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
            placeholder="Position (e.g. Airport Hand)"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option>Operations</option>
            <option>Security</option>
            <option>Maintenance</option>
            <option>Administration</option>
            <option>Fire & Rescue</option>
          </select>
          <button type="submit">
            {editingId ? '💾 Save Changes' : 'Save Staff Member'}
          </button>
        </form>
      )}

      <div className="staff-list">
        {staff.length === 0 ? (
          <div className="empty-state">
            <p>No staff members yet. Click <strong>"📥 Import FND Ground Ops Staff"</strong> to load your team, or <strong>"+ Add Staff"</strong> to add one manually.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SN</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Position</th>
                <th>Department</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff
                .slice()
                .sort((a, b) => (a.sn || '').localeCompare(b.sn || ''))
                .map((s) => (
                  <tr key={s.id}>
                    <td>{s.sn || '—'}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.email}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.position || '—'}</td>
                    <td>{s.department}</td>
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