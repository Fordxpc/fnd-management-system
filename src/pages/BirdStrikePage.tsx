import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const CATEGORIES = ['Accident', 'Incident', 'Procedural', 'Failure', 'Hazard'];
const OCCURRENCE_TYPES = ['Collision/strike', 'Damage to aircraft', 'Loss of control', 'Runway Excursion', 'Runway Incursion', 'Fire/explosion/fumes', 'Occupational Injury', 'Vehicle/Equipment Collision', 'Injuries to persons', 'Physical surface deficiency', 'Surface marking deficiency', 'Jet Blast/Propeller Wash', 'Physical obstruction', 'Power Failure', 'Spillage/leakage', 'Equipment/installation deficiency', 'Adverse Weather Condition', 'Aircraft Loading', 'Vehicle/Equipment Breakdown', 'Public protection deficiency', 'Apron management deficiency', 'Bird Strike', 'Near Strike'];
const PLACES = ['Runway', 'Taxiway', 'Apron', 'Service Road', 'Hangar', 'Terminal Building', 'Vehicle Shed', 'Fire station', 'Baggage Make-up Area (BMA)', 'Baggage Breakdown Area (BBA)'];

export default function BirdStrikePage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState({
    reportNo: '', date: new Date().toISOString().split('T')[0], time: '',
    reporterName: '', contactNo: '', organization: '', email: '',
    category: '', occurrenceType: '', birdSize: 'Small', place: '',
    metConditions: '', explanation: '', correctiveAction: '', submittedBy: profile?.name || '', designation: profile?.position || '',
    photoBase64: ''
  });

  const [people, setPeople] = useState([{ name: '', nid: '', org: '', contact: '' }]);
  const [aircraft, setAircraft] = useState({ regNo: '', name: '', owner: '', type: '', flightNo: '' });

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch('/birdstrikes');
      setRecords(data);
      setLoading(false);
    } catch (err: any) { toast.error(err.message); setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePhoto = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm(prev => ({ ...prev, photoBase64: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await apiFetch('/birdstrikes', { 
        method: 'POST', 
        body: JSON.stringify({ ...form, peopleInvolved: people, aircraftInfo: aircraft }) 
      });
      toast.success('Birdstrike report submitted!');
      setShowForm(false);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>🚨 Safety Occurrence Report (Birdstrike)</h2>
        <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Report'}</button>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          
          {/* PAGE 1 */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Reporter's Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input placeholder="Full Name *" value={form.reporterName} onChange={e => setForm({...form, reporterName: e.target.value})} required />
              <input placeholder="Contact No" value={form.contactNo} onChange={e => setForm({...form, contactNo: e.target.value})} />
              <input placeholder="Organization / Airport" value={form.organization} onChange={e => setForm({...form, organization: e.target.value})} />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>

            <h3 style={{ margin: '20px 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Categories of Occurrence</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <label key={c} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="radio" name="category" value={c} checked={form.category === c} onChange={e => setForm({...form, category: e.target.value})} />
                  {c}
                </label>
              ))}
            </div>

            <h3 style={{ margin: '20px 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Type of Safety Occurrence</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {OCCURRENCE_TYPES.map(t => (
                <label key={t} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <input type="radio" name="type" value={t} checked={form.occurrenceType === t} onChange={e => setForm({...form, occurrenceType: e.target.value})} />
                  {t}
                </label>
              ))}
            </div>

            {form.occurrenceType.includes('Strike') && (
              <div style={{ marginTop: '12px', background: '#fef2f2', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <strong style={{ color: '#991b1b', fontSize: '13px' }}>Bird Size:</strong>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  {['Small', 'Medium', 'Large'].map(s => (
                    <label key={s} style={{ fontSize: '12px' }}><input type="radio" name="birdSize" value={s} checked={form.birdSize === s} onChange={e => setForm({...form, birdSize: e.target.value})} /> {s}</label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
              <div><label>Date *</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required /></div>
              <div><label>Time *</label><input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} required /></div>
            </div>
          </div>

          {/* PAGE 2 */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Place of Occurrence</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {PLACES.map(p => (
                <label key={p} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="radio" name="place" value={p} checked={form.place === p} onChange={e => setForm({...form, place: e.target.value})} />
                  {p}
                </label>
              ))}
            </div>

            <h3 style={{ margin: '20px 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Meteorological Conditions</h3>
            <textarea rows={3} placeholder="Describe weather conditions at time of occurrence..." value={form.metConditions} onChange={e => setForm({...form, metConditions: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />

            <h3 style={{ margin: '20px 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>People Involved</h3>
            {people.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input placeholder="Name" value={p.name} onChange={e => { const n = [...people]; n[i].name = e.target.value; setPeople(n); }} />
                <input placeholder="NID" value={p.nid} onChange={e => { const n = [...people]; n[i].nid = e.target.value; setPeople(n); }} />
                <input placeholder="Organization" value={p.org} onChange={e => { const n = [...people]; n[i].org = e.target.value; setPeople(n); }} />
                <input placeholder="Contact" value={p.contact} onChange={e => { const n = [...people]; n[i].contact = e.target.value; setPeople(n); }} />
              </div>
            ))}
            <button type="button" onClick={() => setPeople([...people, { name: '', nid: '', org: '', contact: '' }])} style={{ background: '#e2e8f0', color: '#1e293b', padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px' }}>+ Add Person</button>

            <h3 style={{ margin: '20px 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Involved Aircraft / Equipment</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input placeholder="Aircraft Registration (e.g. 8Q-XXX)" value={aircraft.regNo} onChange={e => setAircraft({...aircraft, regNo: e.target.value})} />
              <input placeholder="Aircraft Type (e.g. ATR-72)" value={aircraft.type} onChange={e => setAircraft({...aircraft, type: e.target.value})} />
              <input placeholder="Owner / Operator" value={aircraft.owner} onChange={e => setAircraft({...aircraft, owner: e.target.value})} />
              <input placeholder="Flight No (e.g. Q2-123)" value={aircraft.flightNo} onChange={e => setAircraft({...aircraft, flightNo: e.target.value})} />
            </div>
          </div>

          {/* PAGE 3 */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>Explanation & Actions</h3>
            <textarea rows={4} placeholder="Explain the safety occurrence, damage, and actions taken to mitigate..." value={form.explanation} onChange={e => setForm({...form, explanation: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '12px' }} />
            
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Graphical Description (Photo)</label>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'block', marginBottom: '12px' }} />
            
            <textarea rows={3} placeholder="Suggested Corrective Action..." value={form.correctiveAction} onChange={e => setForm({...form, correctiveAction: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '12px' }} />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label>Submitted By</label><input value={form.submittedBy} onChange={e => setForm({...form, submittedBy: e.target.value})} /></div>
              <div><label>Designation</label><input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} /></div>
            </div>
          </div>

          <button type="submit" style={{ background: '#dc2626', color: 'white', padding: '12px', fontSize: '16px', fontWeight: 'bold' }}>Submit Occurrence Report</button>
        </form>
      )}

      <div className="staff-list">
        <table>
          <thead><tr><th>Date / Time</th><th>Type</th><th>Place</th><th>Reported By</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td>{r.date} <br/><span style={{fontSize:'11px', color:'#64748b'}}>{r.time}</span></td>
                <td><strong style={{color: r.occurrenceType.includes('Strike') ? '#dc2626' : '#1e293b'}}>{r.occurrenceType}</strong></td>
                <td>{r.place}</td>
                <td>{r.reporterName}</td>
                <td><button className="delete-btn" onClick={() => setDeleteTarget(r.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Report?" message="Are you sure?" confirmText="Delete" isDanger={true} onConfirm={async () => {
          if (!deleteTarget) return;
          await apiFetch(`/birdstrikes/${deleteTarget}`, { method: 'DELETE' });
          fetchData(); setDeleteTarget(null);
      }} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}