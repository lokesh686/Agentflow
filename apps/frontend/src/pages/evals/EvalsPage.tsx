import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function EvalsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Dataset State
  const [showNewDataset, setShowNewDataset] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetCases, setNewDatasetCases] = useState([{ input: '', expected: '' }]);

  // New Run State
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedScorer, setSelectedScorer] = useState('llm_judge');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dsRes, wfRes] = await Promise.all([
        api.get('/evals/datasets'),
        api.get('/workflows')
      ]);
      if (dsRes.data.success) setDatasets(dsRes.data.data);
      if (wfRes.data.success) setWorkflows(wfRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunsForWorkflow = async (workflowId: string) => {
    try {
      const res = await api.get(`/evals/runs/${workflowId}`);
      if (res.data.success) {
        setRuns(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDataset = async () => {
    try {
      const res = await api.post('/evals/datasets', {
        name: newDatasetName,
        cases: newDatasetCases.filter(c => c.input && c.expected)
      });
      if (res.data.success) {
        setDatasets([res.data.data, ...datasets]);
        setShowNewDataset(false);
        setNewDatasetName('');
        setNewDatasetCases([{ input: '', expected: '' }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartRun = async () => {
    if (!selectedWorkflow || !selectedDataset) return;
    try {
      const res = await api.post('/evals/runs', {
        workflowId: selectedWorkflow,
        datasetId: selectedDataset,
        scorer: selectedScorer
      });
      if (res.data.success) {
        alert('Eval run started!');
        fetchRunsForWorkflow(selectedWorkflow);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Agent Evaluation Framework</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Datasets Section */}
        <div className="bg-white p-6 rounded-lg shadow border border-[#2b3142]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Datasets</h2>
            <button 
              onClick={() => setShowNewDataset(!showNewDataset)}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
            >
              + New Dataset
            </button>
          </div>

          {showNewDataset && (
            <div className="mb-6 border p-4 rounded bg-gray-50">
              <input 
                type="text" 
                placeholder="Dataset Name" 
                className="w-full border p-2 rounded mb-4"
                value={newDatasetName}
                onChange={e => setNewDatasetName(e.target.value)}
              />
              <h4 className="font-semibold text-sm mb-2">Test Cases</h4>
              {newDatasetCases.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    placeholder="Input data/prompt" 
                    className="flex-1 border p-1 rounded text-sm"
                    value={c.input}
                    onChange={e => {
                      const newCases = [...newDatasetCases];
                      newCases[i].input = e.target.value;
                      setNewDatasetCases(newCases);
                    }}
                  />
                  <input 
                    type="text" 
                    placeholder="Expected output" 
                    className="flex-1 border p-1 rounded text-sm"
                    value={c.expected}
                    onChange={e => {
                      const newCases = [...newDatasetCases];
                      newCases[i].expected = e.target.value;
                      setNewDatasetCases(newCases);
                    }}
                  />
                </div>
              ))}
              <button 
                onClick={() => setNewDatasetCases([...newDatasetCases, { input: '', expected: '' }])}
                className="text-xs text-blue-600 mb-4"
              >
                + Add Case
              </button>
              <div className="flex justify-end">
                <button onClick={handleCreateDataset} className="bg-green-600 text-white px-4 py-1 text-sm rounded hover:bg-green-700">Save Dataset</button>
              </div>
            </div>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="space-y-2">
              {datasets.map(ds => (
                <div key={ds._id} className="p-3 border rounded flex justify-between items-center">
                  <div>
                    <p className="font-medium">{ds.name}</p>
                    <p className="text-xs text-gray-500">{ds.cases.length} cases</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(ds.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {datasets.length === 0 && <p className="text-sm text-gray-500">No datasets found.</p>}
            </div>
          )}
        </div>

        {/* Eval Runs Section */}
        <div className="bg-white p-6 rounded-lg shadow border border-[#2b3142]">
          <h2 className="text-lg font-medium mb-4">Run Evaluation</h2>
          
          <div className="space-y-4 mb-6 border-b pb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Select Workflow</label>
              <select 
                className="w-full border p-2 rounded"
                value={selectedWorkflow}
                onChange={e => {
                  setSelectedWorkflow(e.target.value);
                  if (e.target.value) fetchRunsForWorkflow(e.target.value);
                }}
              >
                <option value="">-- Choose Workflow --</option>
                {workflows.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Select Dataset</label>
              <select 
                className="w-full border p-2 rounded"
                value={selectedDataset}
                onChange={e => setSelectedDataset(e.target.value)}
              >
                <option value="">-- Choose Dataset --</option>
                {datasets.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Scoring Method</label>
              <select 
                className="w-full border p-2 rounded"
                value={selectedScorer}
                onChange={e => setSelectedScorer(e.target.value)}
              >
                <option value="llm_judge">LLM Judge (GPT-4o)</option>
                <option value="exact_match">Exact Match</option>
                <option value="regex">Regex Match</option>
              </select>
            </div>
            
            <button 
              onClick={handleStartRun}
              disabled={!selectedWorkflow || !selectedDataset}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Start Eval Run
            </button>
          </div>

          <div>
            <h3 className="font-medium mb-3">Recent Runs (for selected workflow)</h3>
            {!selectedWorkflow && <p className="text-sm text-gray-500">Select a workflow to view runs.</p>}
            {selectedWorkflow && runs.length === 0 && <p className="text-sm text-gray-500">No runs found.</p>}
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {runs.map(run => (
                <div key={run._id} className="border p-3 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm">v{run.workflowVersion} run against {run.datasetId?.name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${run.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold text-blue-600">{(run.score * 100).toFixed(0)}%</span>
                    <span className="text-xs text-gray-500">{new Date(run.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
