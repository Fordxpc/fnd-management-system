import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ConversationsPage() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: '', description: '', department: '' });
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updatingMember, setUpdatingMember] = useState('');
  const canCreateChannel = ['developer', 'admin', 'manager', 'owner'].includes(String(profile?.role || '').toLowerCase());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiFetch('/chat/groups');
      setGroups(data);
      setActiveGroup((current: any) => current && data.some((group: any) => group.id === current.id) ? current : data[0] || null);
    } catch (err: any) { toast.error(err.message || 'Unable to load channels'); }
    finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (quiet = false) => {
    if (!activeGroup) return;
    if (!quiet) setLoadingMessages(true);
    try { setMessages(await apiFetch(`/chat/groups/${activeGroup.id}/messages`)); }
    catch (err: any) { if (!quiet) toast.error(err.message || 'Unable to load messages'); }
    finally { setLoadingMessages(false); }
  }, [activeGroup]);

  useEffect(() => { void fetchGroups(); }, [fetchGroups]);
  useEffect(() => {
    setMessages([]); void fetchMessages();
    const interval = window.setInterval(() => void fetchMessages(true), 10000);
    return () => window.clearInterval(interval);
  }, [fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = newMessage.trim();
    if (!message || !activeGroup || sending) return;
    setSending(true);
    try {
      await apiFetch(`/chat/groups/${activeGroup.id}/messages`, { method: 'POST', body: JSON.stringify({ message }) });
      setNewMessage(''); await fetchMessages(true);
    } catch (err: any) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !activeGroup) return;
    if (!file.type.startsWith('image/')) { toast.error('Select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be 2 MB or smaller'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onerror = () => { setUploading(false); toast.error('Unable to read this image'); };
    reader.onloadend = async () => {
      try {
        await apiFetch(`/chat/groups/${activeGroup.id}/messages`, { method: 'POST', body: JSON.stringify({ message: '', imageUrl: String(reader.result || '') }) });
        await fetchMessages(true);
      } catch (err: any) { toast.error(err.message); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreateChannel || creatingChannel) return;
    setCreatingChannel(true);
    try {
      const result = await apiFetch('/chat/groups', { method: 'POST', body: JSON.stringify(channelForm) });
      toast.success('Channel created');
      setChannelForm({ name: '', description: '', department: '' });
      setShowCreateChannel(false);
      await fetchGroups();
      if (result?.id) setActiveGroup((await apiFetch('/chat/groups')).find((group: any) => group.id === result.id) || null);
    } catch (err: any) { toast.error(err.message || 'Unable to create channel'); }
    finally { setCreatingChannel(false); }
  };
  const visibleGroups = groups.filter(group => String(group.name || '').toLowerCase().includes(channelSearch.toLowerCase()));
const visibleMembers = members.filter(member => [member.name, member.sn, member.department, member.role].some(value => String(value || '').toLowerCase().includes(memberSearch.toLowerCase())));
  const openMembers = async () => {
    if (!activeGroup || !canCreateChannel) return;
    setShowMembers(true); setLoadingMembers(true); setMemberSearch('');
    try { setMembers(await apiFetch(`/chat/groups/${activeGroup.id}/members`)); }
    catch (err: any) { toast.error(err.message || 'Unable to load channel members'); }
    finally { setLoadingMembers(false); }
  };
  const toggleMember = async (member: any) => {
    if (!activeGroup || updatingMember) return;
    setUpdatingMember(member.staffId);
    try {
      await apiFetch(`/chat/groups/${activeGroup.id}/members${member.isMember ? `/${member.staffId}` : ''}`, member.isMember ? { method: 'DELETE' } : { method: 'POST', body: JSON.stringify({ staffId: member.staffId }) });
      setMembers(current => current.map(item => item.staffId === member.staffId ? { ...item, isMember: !item.isMember } : item));
    } catch (err: any) { toast.error(err.message || 'Unable to update membership'); }
    finally { setUpdatingMember(''); }
  };
  if (loading) return <div className="page-content"><p>Loading conversations…</p></div>;

  return <div className="page-content conversations-page">
    <aside className="conversations-sidebar">
      <header><div><span>Internal communications</span><h2>Channels</h2><p>{groups.length} available</p></div>{canCreateChannel && <button className="conversation-create-button" type="button" onClick={() => setShowCreateChannel(true)}>+ Create</button>}</header>
      <div className="conversation-search"><input value={channelSearch} onChange={event => setChannelSearch(event.target.value)} placeholder="Find a channel" /></div>
      <nav>{visibleGroups.map(group => <button key={group.id} className={activeGroup?.id === group.id ? 'active' : ''} onClick={() => setActiveGroup(group)}><span>#</span><div><strong>{group.name}</strong><small>{group.department || 'All departments'}</small></div></button>)}{visibleGroups.length === 0 && <p>No matching channels.</p>}</nav>
    </aside>

    <main className="conversation-panel">
      {activeGroup ? <>
        <header className="conversation-header"><div><span>#</span><div><h3>{activeGroup.name}</h3><p>{activeGroup.description || activeGroup.department || 'Team conversation'}</p></div></div><div className="conversation-header-actions">{canCreateChannel && <button onClick={() => void openMembers()}>Manage people</button>}<button onClick={() => void fetchMessages()} disabled={loadingMessages}>{loadingMessages ? 'Refreshing…' : 'Refresh'}</button></div></header>
        <section className="conversation-messages">{loadingMessages && messages.length === 0 ? <p className="conversation-empty">Loading messages…</p> : messages.length === 0 ? <div className="conversation-empty"><strong>No messages yet</strong><span>Start the conversation in #{activeGroup.name}.</span></div> : messages.map(message => {
          const isMe = message.senderId === profile?.id;
          return <article className={isMe ? 'mine' : ''} key={message.id}><div className="conversation-avatar">{String(message.senderName || '?').charAt(0).toUpperCase()}</div><div><header><strong>{isMe ? 'You' : message.senderName || 'Unknown user'}</strong><time>{formatTime(message.createdAt)}</time></header><div className="conversation-bubble">{message.message && <p>{message.message}</p>}{message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><img src={message.imageUrl} alt="Shared attachment" /></a>}</div></div></article>;
        })}<div ref={messagesEndRef} /></section>
        <form className="conversation-composer" onSubmit={handleSend}><button type="button" className="attach" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Attach image">{uploading ? '…' : '+'}</button><input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} hidden /><div><input value={newMessage} maxLength={2000} onChange={event => setNewMessage(event.target.value)} placeholder={`Message #${activeGroup.name}`} disabled={sending} /><small>{newMessage.length}/2000</small></div><button className="send" disabled={sending || !newMessage.trim()}>{sending ? 'Sending…' : 'Send'}</button></form>
      </> : <div className="conversation-empty large"><strong>No channel selected</strong><span>Choose a channel to view its messages.</span></div>}
    </main>
    {showCreateChannel && <div className="modal-backdrop" onClick={() => setShowCreateChannel(false)}><form className="modal-content conversation-create-modal" onSubmit={handleCreateChannel} onClick={event => event.stopPropagation()}><span>New conversation space</span><h3>Create channel</h3><p>Create an airport-wide channel or limit it to one operational department.</p><label><span>Channel name</span><input value={channelForm.name} minLength={2} maxLength={60} onChange={event => setChannelForm({...channelForm, name: event.target.value})} placeholder="e.g. Flight Operations" required /></label><label><span>Description</span><textarea value={channelForm.description} maxLength={180} onChange={event => setChannelForm({...channelForm, description: event.target.value})} placeholder="What should this channel be used for?" rows={3} /></label><label><span>Visibility</span><select value={channelForm.department} onChange={event => setChannelForm({...channelForm, department: event.target.value})}><option value="">All FND staff</option><option>Ground Operations</option><option>Maintenance</option><option>Security</option><option>Fire & Rescue</option></select></label><div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setShowCreateChannel(false)}>Cancel</button><button className="submit-btn" disabled={creatingChannel}>{creatingChannel ? 'Creating…' : 'Create channel'}</button></div></form></div>}
    {showMembers && <div className="modal-backdrop" onClick={() => setShowMembers(false)}><section className="modal-content conversation-members-modal" onClick={event => event.stopPropagation()}><header><div><span>Channel access</span><h3>{activeGroup?.name}</h3><p>{members.filter(member => member.isMember).length} people selected</p></div><button type="button" onClick={() => setShowMembers(false)} aria-label="Close">×</button></header><div className="conversation-member-search"><input value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Filter by name, SN, role or department" /></div><div className="conversation-member-list">{loadingMembers ? <p>Loading people…</p> : visibleMembers.map(member => <button type="button" key={member.staffId} className={member.isMember ? 'selected' : ''} disabled={updatingMember === member.staffId} onClick={() => void toggleMember(member)}><span className="conversation-member-check">{updatingMember === member.staffId ? '…' : member.isMember ? '✓' : '+'}</span><div><strong>{member.name}</strong><small>{member.sn || 'No SN'} · {member.department || 'No department'} · {String(member.role || 'staff').toUpperCase()}</small></div></button>)}{!loadingMembers && visibleMembers.length === 0 && <p>No matching people.</p>}</div><footer><span>Recommended people are selected automatically. Managers can change them here.</span><button type="button" className="submit-btn" onClick={() => setShowMembers(false)}>Done</button></footer></section></div>}  </div>;
}