import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function ApprovalStep({ execution }) {
  const { accessToken } = useAuthStore();

  const handleDecision = async (decision) => {
    try {
      await api.post(`/approvals/${execution._id}/${decision}`, null, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.error('Failed to submit decision', err);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold">Approval Required</h3>
      <p className="mt-2">{execution.humanApproval.context}</p>
      <div className="mt-4 flex gap-4">
        <button
          onClick={() => handleDecision('approved')}
          className="px-4 py-2 bg-green-500 text-white rounded-lg"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecision('rejected')}
          className="px-4 py-2 bg-red-500 text-white rounded-lg"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
