/**
 * Rescue Request Tracking Page
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { rescueAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

const STATUS_STEPS = ['pending', 'accepted', 'in-progress', 'rescued'];
const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  'in-progress': 'In Progress',
  rescued: 'Completed',
};
const DISASTER_ICONS = { flood: '🌊', earthquake: '🏔️', fire: '🔥', landslide: '⛰️', cyclone: '🌪️', tsunami: '🌊', other: '⚠️' };

export default function TrackingPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    rescueAPI.getById(id).then(({ data }) => setRequest(data.request)).finally(() => setLoading(false));
    const socket = getSocket();
    if (socket) {
      socket.emit('join_rescue_room', id);
      socket.on('rescue_request_updated', (updated) => {
        if (updated._id === id) setRequest(updated);
      });
      return () => { socket.emit('leave_rescue_room', id); socket.off('rescue_request_updated'); };
    }
  }, [id]);

  if (loading) return <DashboardLayout title="Tracking"><div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"/></div></DashboardLayout>;
  if (!request) return <DashboardLayout title="Not Found"><div className="card text-center py-12">Request not found</div></DashboardLayout>;

  const currentStep = STATUS_STEPS.indexOf(request.status);
  const canCancel = user?.role === 'citizen' && ['pending', 'accepted', 'in-progress'].includes(request.status);
  const canRate = user?.role === 'citizen' && request.status === 'rescued' && request.assignedVolunteer && !request.citizenFeedback?.rating;

  const handleCancel = async () => {
    if (!window.confirm('Cancel this SOS request?')) return;
    setCancelling(true);
    try {
      const { data } = await rescueAPI.cancel(request._id, { note: 'Citizen cancelled from tracker page' });
      setRequest(data.request);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!rating) return;
    setRatingSubmitting(true);
    try {
      const { data } = await rescueAPI.rateVolunteer(request._id, { rating, feedback });
      setRequest(data.request);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Track Your Rescue">
      <div className="max-w-2xl mx-auto">
        {/* Status hero */}
        <div className={`rounded-2xl p-8 mb-6 text-center ${request.status === 'rescued' ? 'bg-green-600' : request.status === 'in-progress' ? 'bg-orange-500' : request.status === 'cancelled' ? 'bg-gray-600' : 'bg-primary'} text-white`}>
          <div className="text-5xl mb-3">
            {request.status === 'rescued' ? '✅' : request.status === 'in-progress' ? '🚁' : request.status === 'accepted' ? '🦺' : request.status === 'cancelled' ? '🛑' : '⏳'}
          </div>
          <h1 className="font-display text-4xl tracking-widest mb-2">{request.status === 'cancelled' ? 'Cancelled' : (STATUS_LABELS[request.status] || request.status)}</h1>
          <p className="opacity-90 capitalize">{DISASTER_ICONS[request.disasterType]} {request.disasterType} Emergency</p>
        </div>

        {/* Progress tracker */}
        <div className="card mb-6">
          <h2 className="font-bold text-gray-900 mb-6">Rescue Progress</h2>
          <div className="relative">
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200">
              <div className="h-full bg-primary transition-all duration-500" style={{width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`}}/>
            </div>
            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all ${
                    i <= currentStep ? 'bg-primary text-white shadow-md' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {i < currentStep ? '✓' : i + 1}
                  </div>
                  <div className="text-xs text-center text-gray-500 max-w-[70px]">{STATUS_LABELS[step]}</div>
                </div>
              ))}
            </div>
          </div>
          {canCancel && (
            <div className="mt-6 pt-4 border-t">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 disabled:opacity-60"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          )}
        </div>

        {/* Request details */}
        <div className="card mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Request Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Disaster Type</span>
              <span className="font-semibold capitalize">{DISASTER_ICONS[request.disasterType]} {request.disasterType}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Urgency Level</span>
              <span className={`font-bold capitalize ${request.urgencyLevel === 'critical' ? 'text-red-600' : request.urgencyLevel === 'high' ? 'text-orange-600' : 'text-yellow-600'}`}>
                {request.urgencyLevel}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">People Affected</span>
              <span className="font-semibold">{request.numberOfPeople}</span>
            </div>
            <div className="py-2 border-b">
              <div className="text-gray-500 mb-1">Description</div>
              <div className="font-medium">{request.description}</div>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Submitted</span>
              <span>{new Date(request.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Assigned volunteer */}
        {request.assignedVolunteer && (
          <div className="card mb-6 bg-blue-50 border-2 border-blue-200">
            <h2 className="font-bold text-gray-900 mb-4">🦺 Your Rescue Volunteer</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {request.assignedVolunteer.name?.[0]}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{request.assignedVolunteer.name}</div>
                  <div className="text-sm text-gray-500">📞 {request.assignedVolunteer.phone}</div>
                </div>
              </div>
              <Link to={`/chat/${request.assignedVolunteer._id}`}
                className="btn-secondary py-2 text-sm">💬 Chat</Link>
            </div>
          </div>
        )}

        {/* Status history */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">Status History</h2>
          <div className="space-y-3">
            {request.statusHistory?.map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"/>
                <div>
                  <div className="font-semibold text-sm capitalize">{entry.status}</div>
                  <div className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</div>
                  {entry.note && <div className="text-xs text-gray-500 mt-0.5">{entry.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {canRate && (
          <div className="card mt-6 border-2 border-yellow-200 bg-yellow-50">
            <h2 className="font-bold text-gray-900 mb-2">Rate Volunteer</h2>
            <p className="text-sm text-gray-600 mb-4">Your feedback helps improve response quality.</p>

            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="input-field min-h-[110px]"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Write optional feedback for your volunteer"
            />

            <button
              onClick={handleSubmitRating}
              disabled={!rating || ratingSubmitting}
              className="btn-primary mt-3 py-2 text-sm disabled:opacity-60"
            >
              {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
