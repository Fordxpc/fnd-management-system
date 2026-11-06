import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import '../styles/resignations.css';

type Resignation = {
  id:string; staffId:string; staffSn:string; staffName:string; department:string;
  requestedLastDay:string; status:string; createdAt:string; reviewedAt?:string|null;
  reviewerName?:string|null; reviewNote?:string|null; attachmentName:string;
  submittedByUserId:string; canReview:boolean; canOffboard:boolean;
  offboardingStatus?:string|null;
};

const formatDate = (iso?:string|null) => iso ? new Date(iso).toLocaleDateString('en-GB', {year:'numeric',month:'short',day:'numeric'}) : '—';
const statusName = (value:string) => value === 'pending'?'Awaiting approval':value==='approved'?'Accepted':value==='rejected'?'Returned':value;
const MAX_UPLOAD=2*1024*1024;

export default function ResignationsPage() {
  const { user } = useAuth();
  const [items,setItems] = useState<Resignation[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [lastDay,setLastDay] = useState('');
  const [attachmentName,setAttachmentName] = useState('');
  const [letterDataUrl,setLetterDataUrl] = useState('');
  const [review,setReview] = useState<{id:string;action:'approve'|'reject'|'offboard'}|null>(null);
  const [reviewNote,setReviewNote] = useState('');
  const [expanded,setExpanded] = useState<string|null>(null);
  const [letterText,setLetterText] = useState<Record<string,string>>({});

  const load = useCallback(async () => {
    try {
      const rows:Resignation[] = await apiFetch('/resignations');
      setItems(Array.isArray(rows)?rows:[]);
    } catch(error:any) { toast.error(error.message||'Could not load resignations'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load();},[load]);

  const chooseFile = (event:ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!['application/pdf','image/png','image/jpeg'].includes(file.type) || file.size>MAX_UPLOAD){
      toast.error('Upload a PDF, JPG or PNG letter up to 2 MB');return;
    }
    const reader=new FileReader();
    reader.onerror=()=>toast.error('Could not read resignation letter');
    reader.onload=()=>{setLetterDataUrl(String(reader.result||''));setAttachmentName(file.name);};
    reader.readAsDataURL(file);
  };
  const submit = async(event:FormEvent) => {
    event.preventDefault();
    if(!lastDay || !letterDataUrl){toast.error('Last working day and resignation letter are required');return;}
    setSaving(true);
    try{
      await apiFetch('/resignations',{method:'POST',body:JSON.stringify({requestedLastDay:lastDay,letterDataUrl,attachmentName})});
      toast.success('Resignation submitted to authorized reviewers');
      setLastDay('');setLetterDataUrl('');setAttachmentName('');
      await load();
    }catch(error:any){toast.error(error.message||'Submission failed');}
    finally{setSaving(false);}
  };
  const downloadOriginal = async(item:Resignation) => {
    try{
      const attachment:{name:string;dataUrl:string}=await apiFetch(`/resignations/${encodeURIComponent(item.id)}/attachment`);
      const anchor=document.createElement('a');anchor.href=attachment.dataUrl;anchor.download=attachment.name;
      document.body.append(anchor);anchor.click();anchor.remove();
    }catch(error:any){toast.error(error.message||'Could not download letter');}
  };
  const getAcceptance = async(item:Resignation) => {
    try{
      const result:{text:string}=await apiFetch(`/resignations/${encodeURIComponent(item.id)}/letter`);
      setLetterText(prev=>({...prev,[item.id]:result.text}));setExpanded(item.id);
    }catch(error:any){toast.error(error.message||'Acceptance letter unavailable');}
  };
  const saveAcceptance = (item:Resignation) => {
    const text=letterText[item.id];if(!text)return;
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`FND_Resignation_Acceptance_${(item.staffSn||'staff').replace(/[^a-z0-9-]/gi,'')}.txt`;
    document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
  };
  const printAcceptance= (item:Resignation) => {
    const text=letterText[item.id];if(!text)return;
    const win=window.open('','_blank','width=800,height=880');
    if(!win){toast.error('Allow pop-ups to print this letter');return;}
    win.opener = null;
    const pre=win.document.createElement('pre');pre.textContent=text;
    pre.style.cssText='white-space:pre-wrap;font:16px/1.65 Georgia,serif;margin:15mm;max-width:750px';
    win.document.title='Resignation Acceptance';win.document.body.appendChild(pre);win.focus();win.print();
  };
  const confirmDecision=async()=>{
    if(!review)return;
    setSaving(true);
    try{
      await apiFetch(`/resignations/${encodeURIComponent(review.id)}/${review.action}`,{
        method:'POST',body:JSON.stringify({note:reviewNote})
      });
      toast.success(review.action==='approve'?'Resignation approved; acceptance letter generated':review.action==='offboard'?'Offboarding recorded; staff account deactivated':'Resignation returned');
      setReview(null);setReviewNote('');await load();
    }catch(error:any){toast.error(error.message||'Action failed');}
    finally{setSaving(false);}
  };
  const ownPending=items.some(item=>item.submittedByUserId===user?.id&&item.status==='pending');
  const todayMaldives=new Intl.DateTimeFormat('sv-SE',{timeZone:'Indian/Maldives'}).format(new Date());
  return <div className="resignation-page page-content">
    <header className="resignation-hero">
      <div><span>ROSTER & HR</span><h2>Resignations & offboarding</h2><p>Department review, signed resignation letters, acceptance letters and final account clearance.</p></div>
      <button type="button" onClick={()=>void load()}>Refresh</button>
    </header>
    <div className="resignation-columns">
      <section className="resignation-panel">
        <h3>Submit a resignation</h3>
        <p>Staff must attach their resignation letter. Your Department In-Charge and authorized management will be notified.</p>
        <form onSubmit={submit} className="resignation-form">
          <label>Last working day
            <input type="date" value={lastDay} onChange={event=>setLastDay(event.target.value)} required min={todayMaldives} />
          </label>
          <label>Resignation letter (PDF/JPG/PNG, up to 2 MB)
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFile} required={!letterDataUrl} />
          </label>
          {attachmentName&&<small>Selected: {attachmentName}</small>}
          <button type="submit" disabled={saving||ownPending||!lastDay||!letterDataUrl}>{saving?'Submitting…':'Submit resignation'}</button>
          {ownPending&&<small>You already have a resignation awaiting review.</small>}
        </form>
      </section>
      <section className="resignation-panel">
        <h3>Privacy and approval</h3>
        <p>The letter is available only to the employee and authorized reviewers. Department In-Charges may approve requests from their own department. Admin/Manager receives an offboarding reminder after approval.</p>
        <p>Acceptance letters are generated from an approved template. A responsible officer must verify the wording and apply any official signature required.</p>
        <p>Historical roster, Leave and OT records are retained. Deactivation happens only through an Admin/Manager offboarding action after the last working day.</p>
      </section>
    </div>
    <section className="resignation-panel">
      <h3>Resignation requests</h3>
      {loading?<p>Loading requests…</p>:items.length===0?<p>No resignation requests to display.</p>:
      <div className="resignation-list">
        {items.map(item=><article key={item.id} className="resignation-entry">
          <div className="resignation-entry-header"><div><strong>{item.staffName}</strong> <small>{item.staffSn} · {item.department}</small></div><span className={`resignation-status status-${item.status}`}>{statusName(item.status)}</span></div>
          <div className="resignation-meta"><span>Last working day: <strong>{item.requestedLastDay}</strong></span><span>Submitted: {formatDate(item.createdAt)}</span>{item.reviewerName&&<span>Reviewed by: {item.reviewerName}</span>}</div>
          {item.reviewNote&&<p className="resignation-note">Review note: {item.reviewNote}</p>}
          {item.status==='approved'&&<p className="resignation-note">Offboarding: {item.offboardingStatus==='completed'?'Completed':'Admin/Manager follow-up required'}</p>}
          <div className="resignation-actions">
            <button type="button" className="outline" onClick={()=>void downloadOriginal(item)}>Download resignation letter</button>
            {item.status==='approved'&&<button type="button" className="outline" onClick={()=>void getAcceptance(item)}>View acceptance letter</button>}
            {item.canReview&&<><button type="button" onClick={()=>setReview({id:item.id,action:'approve'})}>Approve</button><button type="button" className="danger" onClick={()=>setReview({id:item.id,action:'reject'})}>Return</button></>}
            {item.canOffboard&&<button type="button" className="outline" onClick={()=>setReview({id:item.id,action:'offboard'})}>Complete offboarding</button>}
          </div>
          {expanded===item.id&&letterText[item.id]&&<div className="resignation-letter"><pre>{letterText[item.id]}</pre><div className="resignation-actions"><button type="button" onClick={()=>printAcceptance(item)}>Print / Save PDF</button><button type="button" className="outline" onClick={()=>saveAcceptance(item)}>Download text</button></div></div>}
        </article>)}
      </div>}
    </section>
    {review&&<div className="resignation-modal-backdrop" role="presentation"><div role="dialog" aria-modal="true" aria-label="Confirm resignation decision" className="resignation-modal">
      <h3>{review.action==='approve'?'Approve resignation':review.action==='reject'?'Return resignation for correction':'Complete staff offboarding'}</h3>
      <p>{review.action==='approve'?'This approval generates an acceptance letter and notifies the employee.':review.action==='offboard'?'This archives the staff record and revokes current sessions. This must only happen after the confirmed last working day.':'Explain why the resignation cannot be accepted.'}</p>
      {review.action!=='offboard'&&<label>Review note<textarea value={reviewNote} onChange={event=>setReviewNote(event.target.value)} rows={3}/></label>}
      <div className="resignation-actions"><button type="button" className="outline" onClick={()=>{setReview(null);setReviewNote('');}}>Cancel</button><button type="button" disabled={saving||(review.action==='reject'&&reviewNote.trim().length<5)} onClick={()=>void confirmDecision()}>{saving?'Processing…':'Confirm'}</button></div>
    </div></div>}
  </div>;
}
