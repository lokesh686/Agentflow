import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function WebhookSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [webhook, setWebhook] = useState<any>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const fetchWebhook = async () => {
      try {
        const response = await api.get(`/workflows/${id}/webhook`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setWebhook(response.data);
      } catch (err) {
        console.error('Failed to fetch webhook', err);
      }
    };
    fetchWebhook();
  }, [id, accessToken]);

  const rotateSecret = async () => {
    try {
      const response = await api.post(`/workflows/${id}/webhook/rotate`, null, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setWebhook(response.data);
    } catch (err) {
      console.error('Failed to rotate secret', err);
    }
  };

  if (!webhook) {
    return <div>Loading...</div>;
  }

  const webhookUrl = `${window.location.origin}/v1/webhooks/${webhook.workflowId}/${webhook.secret}`;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Webhook Settings</h1>
      <div className="mt-4">
        <h3 className="font-bold">Webhook URL</h3>
        <input
          type="text"
          readOnly
          value={webhookUrl}
          className="w-full p-2 mt-2 bg-gray-800 border border-gray-700 rounded"
        />
      </div>
      <div className="mt-4">
        <h3 className="font-bold">Secret</h3>
        <input
          type="text"
          readOnly
          value={webhook.secret}
          className="w-full p-2 mt-2 bg-gray-800 border border-gray-700 rounded"
        />
      </div>
      <div className="mt-4">
        <button
          onClick={rotateSecret}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          Rotate Secret
        </button>
      </div>
    </div>
  );
}
