import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Spinner } from '../../components/ui';

export default function TeamSettingsPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const { accessToken } = useAuthStore();

  const fetchKeys = async () => {
    try {
      const response = await api.get('/auth/apikeys', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setKeys(response.data.keys);
    } catch (err) {
      console.error('Failed to fetch API keys', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [accessToken]);

  const generateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;
    try {
      const response = await api.post('/auth/apikeys', { name: keyName }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setNewKey(response.data.key);
      setKeyName('');
      fetchKeys();
    } catch (err) {
      console.error('Failed to generate key', err);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await api.delete(`/auth/apikeys/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      fetchKeys();
    } catch (err) {
      console.error('Failed to revoke key', err);
    }
  };

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      await api.post('/teams/invite', { email, role }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setInviteStatus('Invite sent successfully!');
      setEmail('');
    } catch (err: any) {
      setInviteStatus(err.response?.data?.error || 'Failed to send invite');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#e8eaf0] mb-6">Team & API Settings</h1>

      <div className="card p-6 mb-8">
        <h2 className="text-lg font-semibold text-[#e8eaf0] mb-4">Invite Team Member</h2>
        <p className="text-sm text-[#8891a8] mb-6">
          Invite a new member to your team. They will receive an email with an invitation link.
        </p>
        
        {inviteStatus && (
          <div className="mb-4 text-sm font-medium text-brand-400">{inviteStatus}</div>
        )}

        <form onSubmit={inviteMember} className="flex gap-3 mb-6">
          <input
            type="email"
            placeholder="Email address"
            className="input flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input w-32">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" disabled={!email} className="btn-primary">
            Send Invite
          </button>
        </form>
      </div>

      <div className="card p-6 mb-8">
        <h2 className="text-lg font-semibold text-[#e8eaf0] mb-4">API Keys</h2>
        <p className="text-sm text-[#8891a8] mb-6">
          Generate API keys to authenticate programmatic requests to the AgentFlow Pro API.
        </p>

        {newKey && (
          <div className="mb-6 p-4 border border-green-500/30 bg-green-500/10 rounded-lg">
            <p className="text-sm text-green-400 font-semibold mb-2">New API Key Generated</p>
            <p className="text-xs text-[#8891a8] mb-2">Please copy this key now. You won't be able to see it again.</p>
            <code className="block p-2 bg-black/40 rounded text-sm text-[#e8eaf0] break-all">
              {newKey}
            </code>
          </div>
        )}

        <form onSubmit={generateKey} className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Key Name (e.g. Production n8n Server)"
            className="input flex-1"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
          />
          <button type="submit" disabled={!keyName} className="btn-primary">
            Generate Key
          </button>
        </form>

        {isLoading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-[#8891a8] py-4">No API keys generated yet.</p>
        ) : (
          <div className="divide-y divide-[#2e3347] border border-[#2e3347] rounded-lg">
            {keys.map((key) => (
              <div key={key._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#e8eaf0]">{key.name}</p>
                  <p className="text-xs text-[#8891a8] font-mono mt-1">{key.keyPrefix}••••••••••••••••••••••••</p>
                  <p className="text-xs text-[#8891a8] mt-1">
                    Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <button
                  onClick={() => revokeKey(key._id)}
                  className="btn-ghost text-red-400 hover:bg-red-500/10 text-xs px-3 py-1.5"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
