import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';

export default function ConversationsPage() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiFetch('/chat/groups');
      setGroups(data);
      if (data.length > 0 && !activeGroup) setActiveGroup(data[0]);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [activeGroup]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const fetchMessages = useCallback(async () => {
    if (!activeGroup) return;
    try {
      const data = await apiFetch(`/chat/groups/${activeGroup.id}/messages`);
      setMessages(data);
    } catch (err) { console.error(err); }
  }, [activeGroup]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeGroup) return;
    const msg = newMessage;
    setNewMessage('');
    try {
      await apiFetch(`/chat/groups/${activeGroup.id}/messages`, {
        method: 'POST', body: JSON.stringify({ message: msg })
      });
      fetchMessages();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await apiFetch(`/chat/groups/${activeGroup.id}/messages`, {
          method: 'POST', body: JSON.stringify({ message: "Uploaded an image", imageUrl: reader.result })
        });
        fetchMessages();
      } catch (err: any) { toast.error(err.message); }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="page-content"><p>Loading chats...</p></div>;

  return (
    <div className="page-content" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '20px' }}>
      <div style={{ width: '300px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '16px' }}>💬 Channels</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {groups.map(g => (
            <div key={g.id} onClick={() => setActiveGroup(g)}
              style={{ padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', background: activeGroup?.id === g.id ? '#eff6ff' : 'transparent', color: activeGroup?.id === g.id ? '#1d4ed8' : '#475569', fontWeight: activeGroup?.id === g.id ? 700 : 500 }}>
              # {g.name}
            </div>
          ))}
          {groups.length === 0 && <p style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>No groups available.</p>}
        </div>
      </div>

      <div style={{ flex: 1, background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        {activeGroup ? (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '18px', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              {activeGroup.name}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
              {messages.map(m => {
                const isMe = m.senderId === profile?.id;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', marginLeft: isMe ? 0 : '8px', marginRight: isMe ? '8px' : 0 }}>{m.senderName}</span>
                    <div style={{ background: isMe ? '#2563eb' : 'white', color: isMe ? 'white' : '#1e293b', padding: '10px 16px', borderRadius: '12px', borderBottomRightRadius: isMe ? 0 : '12px', borderBottomLeftRadius: isMe ? '12px' : 0, maxWidth: '70%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: isMe ? 'none' : '1px solid #e2e8f0' }}>
                      {m.message}
                      {m.imageUrl && <img src={m.imageUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px', display: 'block' }} />}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
              <label style={{ cursor: 'pointer', background: '#f1f5f9', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                📎 <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ background: '#2563eb', color: 'white', padding: '0 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>Send</button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Select a channel to start chatting</div>
        )}
      </div>
    </div>
  );
}