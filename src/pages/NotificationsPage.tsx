import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import '../styles/notifications.css';

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  targetPage: string;
  sourceId?: string | null;
  createdAt?: string | null;
  readAt?: string | null;
};

type NotificationResponse = { items: NotificationItem[]; unread: number };
type PushKey = { enabled: boolean; publicKey: string };

const fromBase64Url = (value: string): ArrayBuffer => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  const key = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) key[i] = bytes.charCodeAt(i);
  return key.buffer;
};

const formatDate = (date?: string | null) => {
  if (!date) return '';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? String(date) : value.toLocaleString();
};

const safeTarget = (value: string) => {
  const destinations = new Set(['leave', 'overtime', 'settings', 'notifications', 'resignations']);
  return destinations.has(value) ? value : 'notifications';
};

export default function NotificationsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [pushHint, setPushHint] = useState('');

  const load = useCallback(async (quiet = false) => {
    try {
      const result: NotificationResponse = await apiFetch('/notifications');
      setItems(Array.isArray(result.items) ? result.items : []);
      setUnread(Number(result.unread || 0));
      window.dispatchEvent(new CustomEvent('fnd-notifications-updated', { detail: result.unread || 0 }));
    } catch (error: any) { if (!quiet) toast.error(error.message || 'Could not load notifications'); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config: PushKey = await apiFetch('/push/public-key');
        if (cancelled) return;
        setPushReady(!!config.enabled);
        setPublicKey(config.publicKey || '');
        if (!config.enabled) { setPushHint('Phone push is not configured by an administrator yet. In-app alerts still work.'); return; }
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !window.isSecureContext) {
          setPushHint('This browser does not support phone push on this device. In-app alerts still work.'); return;
        }
        if (Notification.permission === 'denied') {
          setPushHint('Notifications are blocked in browser settings. Allow them to enable phone alerts.'); return;
        }
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) setPushActive(!!subscription);
      } catch {
        if (!cancelled) setPushHint('Cannot check phone push settings right now. In-app alerts still work.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enablePhone = async () => {
    if (busy || !pushReady || !publicKey) return;
    setBusy(true);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('This browser does not support push notifications');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Allow notifications in your browser settings to enable phone alerts');
      }
      const registration = await navigator.serviceWorker.register('/fnd-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const oldSubscription = await registration.pushManager.getSubscription();
      const subscription = oldSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey),
      });
      await apiFetch('/push/subscriptions', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
      setPushActive(true);
      setPushHint('Phone alerts enabled on this device. They contain no private staff information.');
      toast.success('Phone notifications enabled');
    } catch (error: any) { toast.error(error.message || 'Could not enable phone alerts'); }
    finally { setBusy(false); }
  };

  const disablePhone = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiFetch('/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setPushActive(false);
      setPushHint('Phone alerts disabled for this device. You can still see in-app notifications.');
      toast.success('Phone notifications disabled');
    } catch (error: any) { toast.error(error.message || 'Could not disable phone alerts'); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true);
    try { await apiFetch('/notifications/test', { method: 'POST' }); toast.success('Test notification created'); await load(true); }
    catch (error: any) { toast.error(error.message || 'Could not send notification test'); }
    finally { setBusy(false); }
  };

  const markRead = async (item: NotificationItem) => {
    if (!item.readAt) {
      try { await apiFetch(`/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST' }); await load(true); }
      catch (error: any) { toast.error(error.message || 'Could not mark as read'); }
    }
    onNavigate(safeTarget(item.targetPage));
  };

  const markAllRead = async () => {
    setBusy(true);
    try { await apiFetch('/notifications/read-all', { method: 'POST' }); await load(true); toast.success('All notifications marked as read'); }
    catch (error: any) { toast.error(error.message || 'Could not mark notifications as read'); }
    finally { setBusy(false); }
  };

  return <div className="notification-page page-content">
    <section className="notification-intro">
      <div><small>FND MANAGEMENT SYSTEM</small><h2>Notifications</h2><p>Leave, overtime, resignations, password-reset and system alerts — newest first.</p></div>
      <span className="notification-unread">{unread} unread</span>
    </section>
    <section className="notification-phone-settings" aria-label="Phone push notifications">
      <div><h3>Phone notifications</h3><p>Receive a generic alert on your subscribed device. Open FND to read details securely.</p>
      {!!pushHint && <small>{pushHint}</small>}</div>
      <div className="notification-action-row">
        {!pushActive ? <button type="button" onClick={enablePhone} disabled={busy || !pushReady}>Enable phone alerts</button>
          : <button type="button" onClick={disablePhone} disabled={busy}>Disable phone alerts</button>}
        <button type="button" className="secondary" onClick={sendTest} disabled={busy}>Send test</button>
      </div>
    </section>
    <div className="notification-toolbar"><h3>Recent notifications</h3><div>
      <button type="button" className="secondary" onClick={() => void load()} disabled={busy}>Refresh</button>
      <button type="button" onClick={markAllRead} disabled={busy || unread === 0}>Mark all as read</button>
    </div></div>
    <section className="notification-list" aria-live="polite">
      {loading && <p className="notification-empty">Loading notifications…</p>}
      {!loading && items.length === 0 && <p className="notification-empty">No notifications yet. New requests and decisions will appear here.</p>}
      {!loading && items.map(item => <button key={item.id} type="button"
        className={`notification-item ${!item.readAt ? 'unread' : ''}`} onClick={() => void markRead(item)}>
        <span className="notification-item-symbol" aria-hidden="true">{item.kind.includes('leave') ? 'LV' : item.kind.includes('ot') ? 'OT' : item.kind.includes('password') ? 'PW' : 'FN'}</span>
        <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></span>
        {!item.readAt && <span className="notification-dot" aria-label="Unread" />}
      </button>)}
    </section>
  </div>;
}
