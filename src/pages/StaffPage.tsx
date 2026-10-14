import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

// The default FND Ground Operations staff list
const FND_STAFF = [
  { sn: 'SN-0439', name: 'Hassan Sujaau' },
  { sn: 'SN-0729', name: 'Mohamed Fuadh' },
  { sn: 'SN-0754', name: 'Ali Shameem' },
  { sn: 'SN-0037', name: 'Adam Faisal' },
  { sn: 'SN-0038', name: 'Adam Skakir' },
  { sn: 'SN-0758', name: 'Mohamed Adam' },
  { sn: 'SN-0733', name: 'Thoriq Mohamed' },
  { sn: 'SN-0725', name: 'Ahmed Aseel' },
  { sn: 'SN-0730', name: 'Mohamed Nadheem' },
  { sn: 'SN-1173', name: 'Mohamed Sameeh' },
];

function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [seeding, setSeeding] = useState(false);
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

  const handleAddStaff = async (e: any) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Name and Email are required');
      return;
    }
    try {
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
      setSn('');
      setName('');
      setEmail('');
      setPhone('');
      setPosition('');
      setShowForm(false);
      alert('Staff added successfully!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    await deleteDoc(doc(db, 'staff', id));
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
        // Skip if already exists (by SN)
        const exists = staff.some((s) => s.sn === member.sn);
        if (exists) continue;

        await addDoc(collection(db, 'staff'), {
          sn: member.sn,
          name: member.name,
          email: `${member.sn.toLowerCase()}@funadhooairport.com`,
          phone: '',
          department: 'Operations',
          position: 'Ground Operations',
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
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Staff'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleAddStaff}>
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
            placeholder="Position (e.g. Security Officer)"
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
          <button type="submit">Save Staff Member</button>
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
                <th>Department</th>
                <th>Position</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.sn || '—'}</td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.email}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.department}</td>
                  <td>{s.position || '—'}</td>
                  <td>
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