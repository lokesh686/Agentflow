import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Spinner, StatusBadge } from '../components/ui';

export default function MonitorPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { accessToken } = useAuthStore();

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/analytics', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, [accessToken]);

  if (isLoading && !data) return <div className="flex justify-center items-center py-32"><Spinner size="lg" /></div>;
  if (!data) return <div className="p-8 text-center text-[#8891a8]">Failed to load monitor data.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e8eaf0]">System Monitor</h1>
        <p className="text-[#8891a8] text-sm mt-1">Live queue health and execution analytics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-xs font-medium text-[#8891a8] uppercase tracking-wider mb-2">Total Executions</p>
          <p className="text-3xl font-bold text-[#e8eaf0]">{data.executions.total}</p>
          <p className="text-xs text-[#8891a8] mt-1">{data.executions.today} today</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-[#8891a8] uppercase tracking-wider mb-2">Success Rate</p>
          <p className={`text-3xl font-bold ${data.executions.success_rate && data.executions.success_rate < 95 ? 'text-red-400' : 'text-green-400'}`}>
            {data.executions.success_rate !== null ? `${data.executions.success_rate}%` : '—'}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-[#8891a8] uppercase tracking-wider mb-2">Avg Duration</p>
          <p className="text-3xl font-bold text-[#e8eaf0]">{Math.round(data.executions.avg_duration_ms / 1000)}s</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-[#8891a8] uppercase tracking-wider mb-2">Queue Depth</p>
          <p className="text-3xl font-bold text-blue-400">{data.queue.queue_depth || 0}</p>
          <p className="text-xs text-[#8891a8] mt-1">Oldest job: {Math.round((data.queue.oldest_job_age_ms || 0) / 1000)}s</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2e3347]">
            <h2 className="font-semibold text-[#e8eaf0]">Most Active Workflows</h2>
          </div>
          <div className="p-4 space-y-3">
            {data.workflows.most_active.length === 0 ? (
              <p className="text-[#8891a8] text-sm">No active workflows</p>
            ) : (
              data.workflows.most_active.map((wf: any) => (
                <div key={wf._id} className="flex justify-between items-center bg-[#21263a] p-3 rounded-lg border border-[#2e3347]">
                  <div>
                    <p className="text-sm font-medium text-[#e8eaf0]">{wf.name}</p>
                    <p className="text-xs text-[#8891a8] mt-0.5">{wf.stats?.totalExecutions || 0} executions</p>
                  </div>
                  <StatusBadge status={wf.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
