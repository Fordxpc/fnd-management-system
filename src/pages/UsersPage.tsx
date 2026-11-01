import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';
import { UserEditModal } from '../components/UserEditModal';

const VIEW_ROLES = ['developer', 'manager', 'admin', 'owner', 'smt'];
const EDIT_ROLES = ['developer', 'manager', 'admin', 'owner'];
const ALL_ROLES = ['developer', 'manager', 'admin', 'smt', 'staff'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

const selectStyle: CSSProperties = {
  padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px',
  background: '#ffffff', color: '#1e293b', colorScheme: 'light',
};

function UsersPage() {
  const { profile } = useAuth();
  const role = profile?.role || '';
  
  const canView = VIEW_ROLES.includes(role) || profile?.isSMT === true;
  const canEdit = EDIT_ROLES.includes(role);

  const [users, setUsers] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [resetPwTarget, setResetPwTarget] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string, email: string } | null>(null);
  const [deletePresetTarget, setDeletePresetTarget] = useState<{ id: string, email: string } | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [showPresetForm, setShowPresetForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', position: '', role: 'staff', department: 'Ground Operations'
  });
  const [savingPreset, setSavingPreset] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    try {
      const [usersData, presetsData, staffData] = await Promise.all([
        apiFetch('/users'), apiFetch('/user-presets'), apiFetch('/staff')
      ]);
      setUsers(usersData); 
      setPresets(presetsData); 
      setStaffList(staffData); 
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ... (Keep all your fetch, handleChangeRole, handleCreateUser functions here, they are fine) ...

  if (loading) return <div className="page-content"><p>Loading Users...</p></div>;

  return (
    <div className="page-content">
      {/* ... (Keep your tables and forms here) ... */}

      <ConfirmDialog isOpen={!!resetPwTarget} title="Send Password Reset?" message={`Send a password reset email to ${resetPwTarget}?`} confirmText="Send" isDanger={false} onConfirm={async () => {
          if (!resetPwTarget) return;
          try { 
            // Cast to any to bypass TS error
            await (authClient as any).forgetPassword({ email: resetPwTarget, redirectTo: '/reset-password' }); 
            toast.success(`Reset email sent.`); 
          } catch (err: any) { toast.error(err.message); }
          setResetPwTarget(null);
        }} onCancel={() => setResetPwTarget(null)} />

      {/* Keep your other ConfirmDialogs here */}
    </div>
  );
}

export default UsersPage;