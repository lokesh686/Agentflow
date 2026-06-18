import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Spinner, ErrorBanner } from '../../components/ui';

export default function TeamJoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No invite token provided.');
      return;
    }

    if (!accessToken) {
      // Must be logged in to accept invite
      navigate(`/login?redirect=/team/join?token=${token}`);
      return;
    }

    const joinTeam = async () => {
      try {
        await api.post('/teams/join', { token }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        setStatus('success');
        setTimeout(() => navigate('/'), 2000);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || 'Failed to join team');
      }
    };

    joinTeam();
  }, [token, accessToken, navigate]);

  return (
    <div className="flex justify-center items-center h-screen bg-[#0f1117]">
      <div className="card p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Joining Team</h1>
        {status === 'loading' && <Spinner size="lg" className="mx-auto" />}
        {status === 'error' && <ErrorBanner message={errorMsg} />}
        {status === 'success' && (
          <p className="text-green-400 font-medium">Successfully joined the team! Redirecting to dashboard...</p>
        )}
      </div>
    </div>
  );
}
