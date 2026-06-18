import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useWorkflowStore } from '@/store/workflowStore';

interface PromptVersion {
  _id: string;
  version: number;
  content: string;
  createdAt: string;
}

interface Props {
  nodeId: string;
  initialContent?: string;
  onChange: (newContent: string) => void;
  abTestConfig?: {
    variantA: number;
    variantB: number;
    splitPercent: number;
  };
  onAbTestChange?: (config: any) => void;
}

export default function PromptEditor({ nodeId, initialContent = '', onChange, abTestConfig, onAbTestChange }: Props) {
  const { currentWorkflow } = useWorkflowStore();
  const [content, setContent] = useState(initialContent);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [view, setView] = useState<'edit' | 'history' | 'ab_test'>('edit');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (view === 'history' || view === 'ab_test') {
      fetchVersions();
    }
  }, [view, nodeId, currentWorkflow?._id]);

  const fetchVersions = async () => {
    if (!currentWorkflow) return;
    try {
      setLoading(true);
      const res = await api.get(`/prompts/${currentWorkflow._id}/${nodeId}`);
      if (res.data.success) {
        setVersions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch prompt versions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentWorkflow) return;
    try {
      onChange(content);
      await api.post(`/prompts/${currentWorkflow._id}/${nodeId}`, { content });
      alert('Prompt saved and new version created.');
    } catch (err) {
      console.error('Failed to save prompt version', err);
    }
  };

  const handleRollback = (versionContent: string) => {
    setContent(versionContent);
    onChange(versionContent);
    setView('edit');
  };

  return (
    <div className="flex flex-col space-y-4 border border-[#2b3142] rounded-lg p-4 bg-[#1b202e] text-[#e0e5f2]">
      <div className="flex items-center justify-between border-b border-[#2b3142] pb-2">
        <h3 className="font-semibold text-sm">Prompt & A/B Testing</h3>
        <div className="space-x-1">
          <button onClick={() => setView('edit')} className={`px-2 py-1 text-xs rounded transition-colors ${view === 'edit' ? 'bg-[#4d73ff] text-white' : 'text-[#8891a8] hover:text-[#e0e5f2] hover:bg-[#2b3142]'}`}>Edit</button>
          <button onClick={() => setView('history')} className={`px-2 py-1 text-xs rounded transition-colors ${view === 'history' ? 'bg-[#4d73ff] text-white' : 'text-[#8891a8] hover:text-[#e0e5f2] hover:bg-[#2b3142]'}`}>History</button>
          <button onClick={() => setView('ab_test')} className={`px-2 py-1 text-xs rounded transition-colors ${view === 'ab_test' ? 'bg-[#4d73ff] text-white' : 'text-[#8891a8] hover:text-[#e0e5f2] hover:bg-[#2b3142]'}`}>A/B Test</button>
        </div>
      </div>

      {view === 'edit' && (
        <div className="flex flex-col space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-40 p-3 bg-[#0d1117] border border-[#2b3142] rounded-md font-mono text-xs text-[#e0e5f2] resize-none focus:outline-none focus:border-[#4d73ff]"
            placeholder="Enter system prompt here..."
          />
          <button
            onClick={handleSave}
            className="self-end px-3 py-1.5 bg-[#4d73ff] text-white text-xs font-medium rounded hover:bg-[#3b5bdb] transition"
          >
            Save & Create Version
          </button>
        </div>
      )}

      {view === 'history' && (
        <div className="flex flex-col space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          {loading ? <p className="text-xs text-[#8891a8]">Loading versions...</p> : null}
          {versions.map(v => (
            <div key={v._id} className="p-3 border border-[#2b3142] rounded-md flex flex-col justify-between items-start bg-[#0d1117]">
              <div className="flex justify-between items-center w-full mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white">v{v.version}</span>
                  <span className="text-[10px] text-[#8891a8]">{new Date(v.createdAt).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => handleRollback(v.content)}
                  className="px-2 py-1 bg-[#2b3142] hover:bg-[#3b4152] text-[#e0e5f2] text-[10px] rounded"
                >
                  Rollback
                </button>
              </div>
              <pre className="text-[10px] text-[#a0a8b8] whitespace-pre-wrap font-mono truncate max-w-full">{v.content.substring(0, 150)}{v.content.length > 150 ? '...' : ''}</pre>
            </div>
          ))}
          {versions.length === 0 && !loading && <p className="text-xs text-[#8891a8]">No versions found.</p>}
        </div>
      )}

      {view === 'ab_test' && (
        <div className="flex flex-col space-y-4">
          <p className="text-xs text-[#8891a8]">Configure A/B testing between two prompt versions.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8891a8] font-semibold mb-1">Variant A</label>
              <select 
                className="w-full bg-[#0d1117] border border-[#2b3142] text-[#e0e5f2] p-1.5 rounded-md text-xs focus:outline-none focus:border-[#4d73ff]"
                value={abTestConfig?.variantA || ''}
                onChange={(e) => onAbTestChange?.({ ...abTestConfig, variantA: Number(e.target.value) })}
              >
                <option value="">Select version</option>
                {versions.map(v => <option key={v._id} value={v.version}>v{v.version}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8891a8] font-semibold mb-1">Variant B</label>
              <select 
                className="w-full bg-[#0d1117] border border-[#2b3142] text-[#e0e5f2] p-1.5 rounded-md text-xs focus:outline-none focus:border-[#4d73ff]"
                value={abTestConfig?.variantB || ''}
                onChange={(e) => onAbTestChange?.({ ...abTestConfig, variantB: Number(e.target.value) })}
              >
                <option value="">Select version</option>
                {versions.map(v => <option key={v._id} value={v.version}>v{v.version}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8891a8] font-semibold mb-1">Split % (Variant A)</label>
            <input 
              type="range" min="0" max="100" 
              value={abTestConfig?.splitPercent || 50}
              onChange={(e) => onAbTestChange?.({ ...abTestConfig, splitPercent: Number(e.target.value) })}
              className="w-full h-1 bg-[#2b3142] rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#8891a8] mt-2">
              <span>{abTestConfig?.splitPercent || 50}% Variant A</span>
              <span>{100 - (abTestConfig?.splitPercent || 50)}% Variant B</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
