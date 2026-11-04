import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const CATEGORIES = ['Accident', 'Incident', 'Procedural', 'Failure', 'Hazard'];
const OCCURRENCE_TYPES = ['Collision/strike', 'Damage to aircraft', 'Loss of control', 'Runway Excursion', 'Runway Incursion', 'Fire/explosion/fumes', 'Occupational Injury', 'Vehicle/Equipment Collision', 'Injuries to persons', 'Physical surface deficiency', 'Surface marking deficiency', 'Jet Blast/Propeller Wash', 'Physical obstruction', 'Power Failure', 'Spillage/leakage', 'Equipment/installation deficiency', 'Adverse Weather Condition', 'Aircraft Loading', 'Vehicle/Equipment Breakdown', 'Public protection deficiency', 'Apron management deficiency', 'Bird Strike', 'Near Strike'];
const PLACES = ['Runway', 'Taxiway', 'Apron', 'Service Road', 'Hangar', 'Terminal Building', 'Vehicle Shed', 'Fire station', 'Baggage Make-up Area (BMA)', 'Baggage Breakdown Area (BBA)'];
const today = () => new Date().toISOString().slice(0, 10);
const emptyPerson = () => ({ name: '', nid: '', org: '', contact: '' });

export default function BirdStrikePage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [people, setPeople] = useState([emptyPerson()]);
  const [aircraft, setAircraft] = useState({ regNo: '', owner: '', type: '', flightNo: '' });
  const [form, setForm] = useState({
    reportNo: '', date: today(), time: '', reporterName: '', contactNo: '', organization: '', email: '',
    category: '', occurrenceType: '', birdSize: 'Small', place: '', metConditions: '', explanation: '',
    correctiveAction: '', submittedBy: profile?.name || '', designation: profile?.position || '', photoBase64: ''
  });

  const canDelete = ['developer', 'manager', 'admin', 'owner'].includes(profile?.role || '');
  const fetchData = useCallback(async () => {
    try { setRecords(await apiFetch('/birdstrikes')); }
    catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const filtered = useMemo(() => records.filter(record =>
    [record.reportNo, record.occurrenceType, record.place, record.reporterName, record.category]
      .some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))
  ), [records, search]);

  const updatePerson = (index: number, field: string, value: string) => {
    setPeople(current => current.map((person, position) => position === index ? { ...person, [field]: value } : person));
  };
  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Select an image file'); event.target.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be 2 MB or smaller'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(current => ({ ...current, photoBase64: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await apiFetch('/birdstrikes', { method: 'POST', body: JSON.stringify({ ...form, peopleInvolved: people, aircraftInfo: aircraft }) });
      toast.success('Safety occurrence report submitted'); setShowForm(false); await fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return <div className="page-content occurrence-page">
    <section className="occurrence-hero">
      <div><span>Safety Management System</span><h2>Safety Occurrence Reporting</h2><p>Capture hazards, incidents, bird strikes and corrective actions in one traceable register.</p></div>
      <button className="occurrence-primary" onClick={() => setShowForm(value => !value)}>{showForm ? 'Close form' : '+ New occurrence'}</button>
    </section>
    <section className="occurrence-summary">
      <div><span>Total reports</span><strong>{records.length}</strong></div>
      <div><span>Bird / near strikes</span><strong>{records.filter(r => String(r.occurrenceType || '').includes('Strike')).length}</strong></div>
      <div><span>This month</span><strong>{records.filter(r => String(r.date || '').startsWith(today().slice(0, 7))).length}</strong></div>
    </section>

    {showForm && <form className="occurrence-form" onSubmit={handleSubmit}>
      <header><div><span>New occurrence</span><h3>Safety report details</h3></div><small>* Required fields</small></header>
      <section><h4>Reporter and classification</h4><div className="occurrence-grid two">
        <label>Reporter name *<input value={form.reporterName} onChange={e => setForm({...form, reporterName:e.target.value})} required /></label>
        <label>Contact number<input value={form.contactNo} onChange={e => setForm({...form, contactNo:e.target.value})} /></label>
        <label>Organization / airport<input value={form.organization} onChange={e => setForm({...form, organization:e.target.value})} /></label>
        <label>Email<input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></label>
        <label>Category *<select value={form.category} onChange={e => setForm({...form, category:e.target.value})} required><option value="">Select category</option>{CATEGORIES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Occurrence type *<select value={form.occurrenceType} onChange={e => setForm({...form, occurrenceType:e.target.value})} required><option value="">Select type</option>{OCCURRENCE_TYPES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Date *<input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} required /></label>
        <label>Time *<input type="time" value={form.time} onChange={e => setForm({...form, time:e.target.value})} required /></label>
        <label>Place *<select value={form.place} onChange={e => setForm({...form, place:e.target.value})} required><option value="">Select place</option>{PLACES.map(v=><option key={v}>{v}</option>)}</select></label>
        {form.occurrenceType.includes('Strike') && <label>Bird size<select value={form.birdSize} onChange={e => setForm({...form, birdSize:e.target.value})}><option>Small</option><option>Medium</option><option>Large</option></select></label>}
      </div></section>
      <section><h4>Conditions and people involved</h4><label>Meteorological conditions<textarea rows={2} value={form.metConditions} onChange={e=>setForm({...form,metConditions:e.target.value})} /></label>
        {people.map((person,index)=><div className="occurrence-grid four" key={index}><input placeholder="Name" value={person.name} onChange={e=>updatePerson(index,'name',e.target.value)} /><input placeholder="NID" value={person.nid} onChange={e=>updatePerson(index,'nid',e.target.value)} /><input placeholder="Organization" value={person.org} onChange={e=>updatePerson(index,'org',e.target.value)} /><input placeholder="Contact" value={person.contact} onChange={e=>updatePerson(index,'contact',e.target.value)} /></div>)}
        <button type="button" className="occurrence-add" onClick={()=>setPeople(current=>[...current,emptyPerson()])}>+ Add person</button>
      </section>
      <section><h4>Aircraft or equipment</h4><div className="occurrence-grid two"><input placeholder="Registration" value={aircraft.regNo} onChange={e=>setAircraft({...aircraft,regNo:e.target.value})}/><input placeholder="Aircraft type" value={aircraft.type} onChange={e=>setAircraft({...aircraft,type:e.target.value})}/><input placeholder="Owner / operator" value={aircraft.owner} onChange={e=>setAircraft({...aircraft,owner:e.target.value})}/><input placeholder="Flight number" value={aircraft.flightNo} onChange={e=>setAircraft({...aircraft,flightNo:e.target.value})}/></div></section>
      <section><h4>Explanation and action</h4><label>Occurrence explanation *<textarea rows={4} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})} required /></label><label>Suggested corrective action<textarea rows={3} value={form.correctiveAction} onChange={e=>setForm({...form,correctiveAction:e.target.value})} /></label><label>Supporting image (maximum 2 MB)<input type="file" accept="image/*" onChange={handlePhoto} /></label><div className="occurrence-grid two"><label>Submitted by<input value={form.submittedBy} onChange={e=>setForm({...form,submittedBy:e.target.value})}/></label><label>Designation<input value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})}/></label></div></section>
      <button className="occurrence-submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit occurrence report'}</button>
    </form>}

    <section className="occurrence-register-head"><div><h3>Occurrence register</h3><p>{filtered.length} report{filtered.length === 1 ? '' : 's'} shown</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search report, type, place or reporter" /></section>
    <div className="staff-list occurrence-register">{loading ? <p className="occurrence-empty">Loading safety records...</p> : filtered.length === 0 ? <p className="occurrence-empty">No matching occurrence reports.</p> : <table><thead><tr><th>Reference</th><th>Date / time</th><th>Classification</th><th>Place</th><th>Reported by</th><th>Action</th></tr></thead><tbody>{filtered.map(record=><tr key={record.id}><td><strong>{record.reportNo || 'Pending'}</strong></td><td>{record.date}<small>{record.time}</small></td><td><strong className={String(record.occurrenceType || '').includes('Strike') ? 'occurrence-danger' : ''}>{record.occurrenceType || 'Unclassified'}</strong><small>{record.category}</small></td><td>{record.place || '—'}</td><td>{record.reporterName || '—'}</td><td>{canDelete ? <button className="delete-btn" onClick={()=>setDeleteTarget(record.id)}>Delete</button> : <span className="occurrence-readonly">Recorded</span>}</td></tr>)}</tbody></table>}</div>
    <ConfirmDialog isOpen={!!deleteTarget} title="Delete report?" message="This removes the occurrence report permanently." confirmText="Delete" isDanger onConfirm={async()=>{if(!deleteTarget)return;try{await apiFetch(`/birdstrikes/${deleteTarget}`,{method:'DELETE'});toast.success('Report deleted');setDeleteTarget(null);await fetchData();}catch(err:any){toast.error(err.message);}}} onCancel={()=>setDeleteTarget(null)} />
  </div>;
}