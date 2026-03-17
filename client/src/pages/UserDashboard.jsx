/**
 * Citizen Dashboard
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { rescueAPI, alertAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-orange-100 text-orange-700',
  rescued: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const STATUS_PROGRESS = ['pending', 'accepted', 'in-progress', 'rescued'];
const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  'in-progress': 'In Progress',
  rescued: 'Completed',
  cancelled: 'Cancelled',
};

const DISASTER_ICONS = { flood: '🌊', earthquake: '🏔️', fire: '🔥', landslide: '⛰️', cyclone: '🌪️', tsunami: '🌊', other: '⚠️' };

export default function UserDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      rescueAPI.getAll(),
      alertAPI.getAll({ active: true }),
    ]).then(([rRes, aRes]) => {
      setRequests(rRes.data.requests);
      setAlerts(aRes.data.alerts);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOwnRequestUpdate = (incoming) => {
      setRequests(prev => {
        const idx = prev.findIndex(r => r._id === incoming._id);
        if (idx === -1) return [incoming, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      });
    };

    const handleEmergencyAlert = (incoming) => {
      setAlerts(prev => {
        if (prev.some(a => a._id === incoming._id)) return prev;
        return [incoming, ...prev];
      });
    };

    socket.on('your_request_updated', handleOwnRequestUpdate);
    socket.on('emergency_alert', handleEmergencyAlert);

    return () => {
      socket.off('your_request_updated', handleOwnRequestUpdate);
      socket.off('emergency_alert', handleEmergencyAlert);
    };
  }, []);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    active: requests.filter(r => ['accepted', 'in-progress'].includes(r.status)).length,
    rescued: requests.filter(r => r.status === 'rescued').length,
  };

  const activeRequests = requests.filter(r => ['pending', 'accepted', 'in-progress'].includes(r.status));
  const historyRequests = requests.filter(r => ['rescued', 'cancelled'].includes(r.status));

  if (loading) return <DashboardLayout title="Dashboard"><div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"/></div></DashboardLayout>;

  return (
    <DashboardLayout title="My Dashboard">
      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 bg-red-600 text-white rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl animate-pulse">⚠️</span>
          <span className="text-xl">🔐</span>
          <div>
            <div className="font-bold">Live Alert | {alerts[0].title}</div>
            <div className="text-red-100 text-sm">{alerts[0].message}</div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: stats.total, icon: '📋', color: 'bg-blue-50 text-blue-700' },
          { label: 'Pending', value: stats.pending, icon: '⏳', color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Active', value: stats.active, icon: '🚨', color: 'bg-orange-50 text-orange-700' },
          { label: 'Rescued', value: stats.rescued, icon: '✅', color: 'bg-green-50 text-green-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-5`}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm font-medium opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">My Profile Snapshot</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-gray-50 p-3"><span className="font-semibold">Name:</span> {user?.name || '-'}</div>
          <div className="rounded-xl bg-gray-50 p-3"><span className="font-semibold">Email:</span> {user?.email || '-'}</div>
          <div className="rounded-xl bg-gray-50 p-3"><span className="font-semibold">Phone:</span> {user?.phone || '-'}</div>
          <div className="rounded-xl bg-gray-50 p-3"><span className="font-semibold">Age:</span> {user?.age || '-'}</div>
          <div className="rounded-xl bg-gray-50 p-3"><span className="font-semibold">Specification:</span> {user?.specificationType || '-'}</div>
          <div className="rounded-xl bg-gray-50 p-3"><span className="font-semibold">ID Number:</span> {user?.idNumber || '-'}</div>
          <div className="rounded-xl bg-gray-50 p-3 md:col-span-2"><span className="font-semibold">Address:</span> {user?.address || '-'}</div>
          {user?.proofDocumentUrl && (
            <a
              href={user.proofDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary font-semibold hover:underline md:col-span-2"
            >
              View Uploaded Proof Document
            </a>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Link to="/emergency" className="card hover:shadow-md transition-shadow group cursor-pointer border-2 border-red-100 hover:border-primary">
          <div className="text-4xl mb-3">🆘</div>
          <div className="font-bold text-lg text-gray-900 mb-1">SOS Emergency</div>
          <div className="text-gray-500 text-sm">Send an emergency rescue request immediately</div>
        </Link>
        <Link to="/chat" className="card hover:shadow-md transition-shadow group cursor-pointer border-2 border-green-100 hover:border-green-500">
          <div className="text-4xl mb-3">💬</div>
          <div className="font-bold text-lg text-gray-900 mb-1">Chat</div>
          <div className="text-gray-500 text-sm">Message your assigned rescue team</div>
        </Link>
        <Link to="/history" className="card hover:shadow-md transition-shadow group cursor-pointer border-2 border-yellow-100 hover:border-yellow-400">
          <div className="text-4xl mb-3">🕘</div>
          <div className="font-bold text-lg text-gray-900 mb-1">Request History</div>
          <div className="text-gray-500 text-sm">Review completed missions and rate volunteers</div>
        </Link>
      </div>

      {/* Active Requests */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Active Rescue Requests</h2>
          <Link to="/emergency" className="text-primary text-sm font-semibold hover:underline">+ New Request</Link>
        </div>
        {activeRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p>No active rescue requests</p>
            <Link to="/emergency" className="btn-primary mt-4 inline-block text-sm">Create Your First Request</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeRequests.map(req => (
              <Link key={req._id} to={`/track/${req._id}`}
                className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                  <span className="text-2xl">{DISASTER_ICONS[req.disasterType] || '⚠️'}</span>
                  <div>
                    <div className="font-semibold text-gray-900 capitalize">{req.disasterType} Emergency</div>
                    <div className="text-sm text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</div>
                  </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`status-badge ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                    <span className="text-gray-400">→</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.max(0, STATUS_PROGRESS.indexOf(req.status)) / (STATUS_PROGRESS.length - 1) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Live Status: Pending → Accepted → In Progress → Completed
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Request History */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Request History</h2>
          <Link to="/history" className="text-primary text-sm font-semibold hover:underline">View All</Link>
        </div>
        {historyRequests.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-3">🕘</div>
            <p>No completed request history yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyRequests.map(req => (
              <Link
                key={req._id}
                to={`/track/${req._id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{DISASTER_ICONS[req.disasterType] || '⚠️'}</span>
                  <div>
                    <div className="font-semibold text-gray-900 capitalize">{req.disasterType} Emergency</div>
                    <div className="text-sm text-gray-500">
                      Outcome: {req.status === 'rescued' ? 'Rescued successfully' : 'Request cancelled'}
                    </div>
                  </div>
                </div>
                <span className={`status-badge ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[req.status] || req.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
