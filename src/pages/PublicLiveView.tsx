import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import RampForm from './RampForm';
import '../styles/RampCheck.css';

export default function PublicLiveView() {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    const fetchDraft = async () => {
      try {
        const data = await apiFetch('/ramp/draft');
        setFormData(data);
      } catch (err) {
        console.error("Failed to load live draft", err);
      }
    };

    fetchDraft();
    const interval = setInterval(fetchDraft, 3000); // Poll every 3 seconds for near real-time
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: '#e2e8f0', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b' }}>✈️ Live Flight Operation View</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>This page updates automatically as the supervisor fills the form.</p>
        </div>
        <span style={{ background: '#dc2626', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
          🔴 LIVE VIEW ONLY
        </span>
      </div>

      <div className="ramp-container" style={{ background: 'transparent', padding: 0 }}>
        <RampForm
          formData={formData}
          handleChange={() => {}} // Read-only
          isManager={false} // Disables editing
          acTypes={[]}
          routeCodes={[]}
          handleAddAcType={() => {}}
          handleAddRoute={() => {}}
          appendRoute={() => {}}
          isViewOnlyMode={true}
        />
      </div>
    </div>
  );
}