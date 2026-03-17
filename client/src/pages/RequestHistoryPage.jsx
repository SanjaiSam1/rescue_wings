import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { rescueAPI } from '../services/api';

const STATUS_LABELS = {
  rescued: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES = {
  rescued: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

function StarRating({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl ${star <= value ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-400`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function RequestHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState('');
  const [ratingDrafts, setRatingDrafts] = useState({});

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await rescueAPI.getHistory();
      setRequests(data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const submitRating = async (requestId) => {
    const draft = ratingDrafts[requestId];
    if (!draft?.rating) return;

    setSubmittingId(requestId);
    try {
      await rescueAPI.rateVolunteer(requestId, {
        rating: draft.rating,
        feedback: draft.feedback || '',
      });
      await loadHistory();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit rating');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <DashboardLayout title="Request History">
      <div className="max-w-5xl mx-auto">
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900">Past SOS Requests</h2>
          <p className="text-sm text-gray-500 mt-1">
            View all completed or cancelled missions, assigned volunteer, and mission outcomes.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : requests.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🗂️</div>
            <p>No history yet. Your completed SOS requests will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const draft = ratingDrafts[request._id] || { rating: 0, feedback: '' };
              const canRate = request.status === 'rescued' && request.assignedVolunteer && !request.citizenFeedback?.rating;

              return (
                <div key={request._id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-bold text-gray-900 capitalize">
                        {request.disasterType} Mission
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Requested on {new Date(request.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        Volunteer: {request.assignedVolunteer?.name || 'Not assigned'}
                      </div>
                    </div>
                    <span className={`status-badge ${STATUS_STYLES[request.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[request.status] || request.status}
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-gray-700">
                    <span className="font-semibold">Description:</span> {request.description}
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <Link to={`/track/${request._id}`} className="btn-secondary py-2 text-sm">
                      View Details
                    </Link>
                  </div>

                  {request.citizenFeedback?.rating && (
                    <div className="mt-5 p-4 rounded-xl border bg-yellow-50 border-yellow-200">
                      <div className="text-sm font-semibold text-gray-800">Your Rating</div>
                      <div className="text-sm text-gray-700 mt-1">
                        {'★'.repeat(request.citizenFeedback.rating)}{'☆'.repeat(5 - request.citizenFeedback.rating)}
                      </div>
                      {request.citizenFeedback.feedback && (
                        <div className="text-sm text-gray-600 mt-2">"{request.citizenFeedback.feedback}"</div>
                      )}
                    </div>
                  )}

                  {canRate && (
                    <div className="mt-5 p-4 rounded-xl border bg-blue-50 border-blue-200">
                      <div className="text-sm font-semibold text-gray-800 mb-2">Rate your volunteer</div>
                      <StarRating
                        value={draft.rating}
                        onChange={(value) => setRatingDrafts((prev) => ({
                          ...prev,
                          [request._id]: { ...draft, rating: value },
                        }))}
                      />
                      <textarea
                        className="input-field mt-3 min-h-[90px]"
                        placeholder="Share your feedback (optional)"
                        value={draft.feedback}
                        onChange={(e) => setRatingDrafts((prev) => ({
                          ...prev,
                          [request._id]: { ...draft, feedback: e.target.value },
                        }))}
                      />
                      <button
                        onClick={() => submitRating(request._id)}
                        disabled={!draft.rating || submittingId === request._id}
                        className="btn-primary mt-3 py-2 text-sm disabled:opacity-60"
                      >
                        {submittingId === request._id ? 'Submitting...' : 'Submit Rating'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
