import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function UsageWidget() {
  const [usage, setUsage] = useState<any>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await api.get('/billing/usage', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setUsage(response.data);
      } catch (err) {
        console.error('Failed to fetch usage', err);
      }
    };
    fetchUsage();
  }, [accessToken]);

  if (!usage) {
    return <div className="card p-4">Loading usage...</div>;
  }

  return (
    <div className="card p-4">
      <h3 className="font-bold">This Month's Usage</h3>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400">Executions</p>
          <p className="text-2xl font-bold">{usage.executions.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Tokens</p>
          <p className="text-2xl font-bold">{usage.tokens.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
