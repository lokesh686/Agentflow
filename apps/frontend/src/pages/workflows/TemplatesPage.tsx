import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Spinner, ErrorBanner } from '../../components/ui';

interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  usageCount: number;
  rating: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const response = await api.get(`/templates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setTemplates(response.data.data);
    } catch (err: any) {
      setError('Failed to fetch templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [category, accessToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemplates();
  };

  const handleClone = async (id: string) => {
    try {
      const response = await api.post(`/templates/${id}/clone`, null, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      navigate(`/workflows/${response.data.data._id}/builder`);
    } catch (err: any) {
      alert('Failed to clone template');
    }
  };

  const categories = ['Research', 'Writing', 'Code', 'Data', 'Support', 'Other'];

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf0]">Template Library</h1>
          <p className="text-[#8891a8] text-sm mt-1">Discover and clone pre-built agent workflows</p>
        </div>
      </div>

      {error && <ErrorBanner message={error} className="mb-6" />}

      <div className="flex gap-8 flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-48 flex-shrink-0">
          <h3 className="text-xs font-semibold text-[#8891a8] uppercase tracking-wider mb-4">Categories</h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setCategory('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${category === '' ? 'bg-brand-500/10 text-brand-500' : 'text-[#e8eaf0] hover:bg-[#21263a]'}`}
              >
                All Templates
              </button>
            </li>
            {categories.map((c) => (
              <li key={c}>
                <button
                  onClick={() => setCategory(c.toLowerCase())}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${category === c.toLowerCase() ? 'bg-brand-500/10 text-brand-500' : 'text-[#e8eaf0] hover:bg-[#21263a]'}`}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pr-2 pb-8">
          <form onSubmit={handleSearch} className="mb-6 flex gap-2">
            <input
              type="text"
              placeholder="Search templates..."
              className="input flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-secondary">Search</button>
          </form>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : templates.length === 0 ? (
            <div className="card py-20 text-center text-[#8891a8]">
              No templates found. Try a different search or category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div key={template._id} className="card p-5 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <span className="badge bg-[#21263a] text-[#8891a8] border border-[#2e3347]">{template.category}</span>
                    <div className="flex items-center gap-1 text-yellow-500 text-xs">
                      <span>★</span> {template.rating.toFixed(1)}
                    </div>
                  </div>
                  <h3 className="font-bold text-[#e8eaf0] text-lg mb-2">{template.name}</h3>
                  <p className="text-sm text-[#8891a8] mb-4 flex-1 line-clamp-3">
                    {template.description || 'No description provided.'}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#21263a] rounded-full text-[#8891a8]">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#2e3347]">
                    <span className="text-xs text-[#8891a8]">{template.usageCount} uses</span>
                    <button onClick={() => handleClone(template._id)} className="btn-primary text-xs py-1.5 px-3">
                      Clone Workflow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
