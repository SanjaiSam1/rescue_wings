import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { adminAPI, alertAPI, authAPI, rescueAPI, volunteerAPI } from '../services/api';
import { getSocket } from '../services/socket';
import DisasterHeatmap from '../components/admin/DisasterHeatmap';

const TABS = [
  'operations',
  'analytics',
  'volunteer-performance',
  'approval-workflow',
  'broadcast',
  'activity-log',
  'heatmap',
  'reports',
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-orange-100 text-orange-700',
  rescued: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-700',
};

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.includes(queryTab) ? queryTab : 'operations');
  const [requests, setRequests] = useState([]);
  const [availableVolunteers, setAvailableVolunteers] = useState([]);
  const [pendingVolunteers, setPendingVolunteers] = useState([]);
  const [volunteerPerformance, setVolunteerPerformance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [analyticsRange, setAnalyticsRange] = useState('week');
  const [analytics, setAnalytics] = useState({ totals: {}, timeline: [], byDisaster: {}, byPriority: {} });
  const [escalations, setEscalations] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [heatpoints, setHeatpoints] = useState([]);
  const [usersSummary, setUsersSummary] = useState({ totalUsers: 0, activeUsers: 0, byRole: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [alertForm, setAlertForm] = useState({
    title: '',
    message: '',
    type: 'warning',
    severity: 'high',
    targetRole: 'all',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        requestsRes,
        availableRes,
        pendingRes,
        performanceRes,
        alertsRes,
        analyticsRes,
        escalationRes,
        logRes,
        heatmapRes,
        usersSummaryRes,
      ] = await Promise.all([
        rescueAPI.getAll(),
        adminAPI.getAvailableVolunteers(),
        adminAPI.getPendingVolunteers(),
        adminAPI.getVolunteerPerformance(),
        alertAPI.getAll(),
        adminAPI.getAnalytics({ range: analyticsRange }),
        adminAPI.getEscalations(),
        adminAPI.getActivityLog({ limit: 100 }),
        adminAPI.getHeatmap(),
        authAPI.getUsersSummary(),
      ]);

      setRequests(requestsRes.data.requests || []);
      setAvailableVolunteers(availableRes.data.volunteers || []);
      setPendingVolunteers(pendingRes.data.volunteers || []);
      setVolunteerPerformance(performanceRes.data.performance || []);
      setAlerts(alertsRes.data.alerts || []);
      setAnalytics(analyticsRes.data || {});
      setEscalations(escalationRes.data.requests || []);
      setActivityLogs(logRes.data.logs || []);
      setHeatpoints(heatmapRes.data.heatpoints || []);
      setUsersSummary(usersSummaryRes.data || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryTab && TABS.includes(queryTab) && queryTab !== tab) {
      setTab(queryTab);
    }
  }, [queryTab]);

  useEffect(() => {
    if (searchParams.get('tab') !== tab) {
      setSearchParams({ tab });
    }
  }, [tab]);

  useEffect(() => {
    loadAll().catch(() => {});
  }, [analyticsRange]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onRequestUpsert = (incoming) => {
      setRequests((prev) => {
        const idx = prev.findIndex((request) => request._id === incoming._id);
        if (idx === -1) return [incoming, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      });
    };

    const onAlert = (incoming) => {
      setAlerts((prev) => [incoming, ...prev]);
    };

    const onEscalation = (incoming) => {
      setEscalations((prev) => [incoming, ...prev]);
    };

    const onVolunteerChange = () => {
      adminAPI.getPendingVolunteers().then(({ data }) => setPendingVolunteers(data.volunteers || [])).catch(() => {});
      adminAPI.getAvailableVolunteers().then(({ data }) => setAvailableVolunteers(data.volunteers || [])).catch(() => {});
      adminAPI.getVolunteerPerformance().then(({ data }) => setVolunteerPerformance(data.performance || [])).catch(() => {});
    };

    socket.on('new_rescue_request', onRequestUpsert);
    socket.on('rescue_request_updated', onRequestUpsert);
    socket.on('emergency_alert', onAlert);
    socket.on('escalation_alert', onEscalation);
    socket.on('mission_rejected', onRequestUpsert);
    socket.on('volunteer_status_changed', onVolunteerChange);
    socket.on('volunteer_availability_changed', onVolunteerChange);

    return () => {
      socket.off('new_rescue_request', onRequestUpsert);
      socket.off('rescue_request_updated', onRequestUpsert);
      socket.off('emergency_alert', onAlert);
      socket.off('escalation_alert', onEscalation);
      socket.off('mission_rejected', onRequestUpsert);
      socket.off('volunteer_status_changed', onVolunteerChange);
      socket.off('volunteer_availability_changed', onVolunteerChange);
    };
  }, []);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests]);

  const assignVolunteer = async (requestId, isOverride = false) => {
    const volunteerId = assignments[requestId];
    if (!volunteerId) {
      alert('Select a volunteer first.');
      return;
    }

    const note = window.prompt(isOverride ? 'Override reason (required):' : 'Assignment note (optional):', '') || '';
    if (isOverride && !note.trim()) {
      alert('Override reason is required.');
      return;
    }

    setActionLoading(true);
    try {
      await rescueAPI.assignVolunteer(requestId, { volunteerId, override: isOverride, note });
      await loadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to assign volunteer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveVolunteer = async (volunteerId, action) => {
    setActionLoading(true);
    try {
      await volunteerAPI.approve(volunteerId, action);
      await loadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Volunteer action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await alertAPI.create(alertForm);
      setAlertForm({ title: '', message: '', type: 'warning', severity: 'high', targetRole: 'all' });
      await loadAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Broadcast failed');
    } finally {
      setActionLoading(false);
    }
  };

  const exportReport = async (format) => {
    setActionLoading(true);
    try {
      const { data } = await adminAPI.exportReport(format);
      downloadBlob(data, format === 'pdf' ? 'operations-report.pdf' : 'operations-report.xlsx');
    } catch (error) {
      alert(error.response?.data?.error || 'Export failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Admin Command Center">
        <div className="flex justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Command Center">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="rounded-2xl p-4 bg-blue-50 text-blue-700">
          <div className="text-2xl font-bold">{usersSummary.totalUsers || 0}</div>
          <div className="text-xs font-semibold">Total Users</div>
        </div>
        <div className="rounded-2xl p-4 bg-green-50 text-green-700">
          <div className="text-2xl font-bold">{analytics.totals?.resolved || 0}</div>
          <div className="text-xs font-semibold">Resolved SOS</div>
        </div>
        <div className="rounded-2xl p-4 bg-yellow-50 text-yellow-700">
          <div className="text-2xl font-bold">{analytics.totals?.pending || 0}</div>
          <div className="text-xs font-semibold">Pending SOS</div>
        </div>
        <div className="rounded-2xl p-4 bg-red-50 text-red-700">
          <div className="text-2xl font-bold">{analytics.totals?.failed || 0}</div>
          <div className="text-xs font-semibold">Failed/Cancelled</div>
        </div>
        <div className="rounded-2xl p-4 bg-orange-50 text-orange-700">
          <div className="text-2xl font-bold">{escalations.length}</div>
          <div className="text-xs font-semibold">Escalations</div>
        </div>
        <div className="rounded-2xl p-4 bg-purple-50 text-purple-700">
          <div className="text-2xl font-bold">{pendingVolunteers.length}</div>
          <div className="text-xs font-semibold">Pending Volunteers</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === item ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item.replace('-', ' ')}
          </button>
        ))}
      </div>

      {tab === 'operations' && (
        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Manual Volunteer Assignment</h2>
              <span className="text-xs text-gray-500">Assign any pending SOS</span>
            </div>
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-sm text-gray-500">No pending SOS right now.</div>
              ) : pendingRequests.map((request) => (
                <div key={request._id} className="p-4 rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold capitalize">{request.disasterType} | {request.userId?.name}</div>
                    <span className={`status-badge ${STATUS_COLORS[request.status] || 'bg-gray-100 text-gray-700'}`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">{request.description}</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="input-field max-w-xs"
                      value={assignments[request._id] || ''}
                      onChange={(e) => setAssignments((prev) => ({ ...prev, [request._id]: e.target.value }))}
                    >
                      <option value="">Select available volunteer</option>
                      {availableVolunteers.map((volunteer) => (
                        <option key={volunteer._id} value={volunteer.userId?._id}>
                          {volunteer.userId?.name} ({volunteer.availability})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => assignVolunteer(request._id, false)}
                      className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Escalation System</h2>
            <p className="text-xs text-gray-500 mb-3">
              SOS with no acceptance in 10 minutes are escalated automatically.
            </p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {escalations.length === 0 ? (
                <div className="text-sm text-gray-500">No active escalations.</div>
              ) : escalations.map((item, idx) => (
                <div key={item._id || item.requestId || idx} className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="font-semibold text-sm text-red-700 capitalize">{item.disasterType || item.disasterType}</div>
                  <div className="text-xs text-red-600 mt-1">Citizen: {item.userId?.name || item.citizenName}</div>
                  <div className="text-xs text-red-600">Urgency: {item.urgencyLevel}</div>
                  <div className="text-xs text-red-500 mt-1">{new Date(item.createdAt || item.escalationNotifiedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-3 card">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Mission Override</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {requests.filter((request) => ['accepted', 'in-progress'].includes(request.status)).slice(0, 8).map((request) => (
                <div key={request._id} className="p-4 rounded-xl border border-gray-200">
                  <div className="text-sm font-semibold">{request.userId?.name} | {request.disasterType}</div>
                  <div className="text-xs text-gray-500 mb-2">Current volunteer: {request.assignedVolunteer?.name || 'None'}</div>
                  <div className="flex gap-2">
                    <select
                      className="input-field"
                      value={assignments[request._id] || ''}
                      onChange={(e) => setAssignments((prev) => ({ ...prev, [request._id]: e.target.value }))}
                    >
                      <option value="">Reassign to volunteer</option>
                      {availableVolunteers.map((volunteer) => (
                        <option key={volunteer._id} value={volunteer.userId?._id}>
                          {volunteer.userId?.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => assignVolunteer(request._id, true)}
                      disabled={actionLoading}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
                    >
                      Override
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Advanced Analytics Dashboard</h2>
              <select
                className="input-field max-w-[180px]"
                value={analyticsRange}
                onChange={(e) => setAnalyticsRange(e.target.value)}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>

            <div className="grid md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-700"><div className="text-2xl font-bold">{analytics.totals?.raised || 0}</div><div className="text-xs">SOS Raised</div></div>
              <div className="p-3 rounded-xl bg-green-50 text-green-700"><div className="text-2xl font-bold">{analytics.totals?.resolved || 0}</div><div className="text-xs">Resolved</div></div>
              <div className="p-3 rounded-xl bg-yellow-50 text-yellow-700"><div className="text-2xl font-bold">{analytics.totals?.pending || 0}</div><div className="text-xs">Pending</div></div>
              <div className="p-3 rounded-xl bg-red-50 text-red-700"><div className="text-2xl font-bold">{analytics.totals?.failed || 0}</div><div className="text-xs">Failed</div></div>
            </div>

            <div className="space-y-2">
              {(analytics.timeline || []).map((item) => {
                const max = Math.max(1, ...(analytics.timeline || []).map((row) => row.raised || 0));
                const width = ((item.raised || 0) / max) * 100;
                return (
                  <div key={item.bucket}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{item.bucket}</span>
                      <span>Raised {item.raised} | Resolved {item.resolved} | Pending {item.pending} | Failed {item.failed}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'volunteer-performance' && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Volunteer Performance Report</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Volunteer</th>
                  <th>Total Missions</th>
                  <th>Completed</th>
                  <th>Avg Response (min)</th>
                  <th>Rating</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {volunteerPerformance.map((row) => (
                  <tr key={row.volunteerId} className="border-b last:border-b-0">
                    <td className="py-2 font-semibold">{row.name}</td>
                    <td>{row.totalMissions}</td>
                    <td>{row.completed}</td>
                    <td>{row.avgResponseTime}</td>
                    <td>{row.rating} ({row.ratingCount})</td>
                    <td className="capitalize">{row.availability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'approval-workflow' && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Volunteer Approval Workflow</h2>
          <div className="space-y-3">
            {pendingVolunteers.length === 0 ? (
              <div className="text-sm text-gray-500">No pending volunteer registrations.</div>
            ) : pendingVolunteers.map((volunteer) => (
              <div key={volunteer._id} className="p-4 rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{volunteer.userId?.name}</div>
                    <div className="text-xs text-gray-500">{volunteer.userId?.email}</div>
                    <div className="text-xs text-gray-500">Phone: {volunteer.userId?.phone || '-'}</div>
                    <div className="text-xs text-gray-500">Age: {volunteer.userId?.age || '-'}</div>
                    <div className="text-xs text-gray-500">Specification: {volunteer.userId?.specificationType || '-'}</div>
                    <div className="text-xs text-gray-500">ID Number: {volunteer.userId?.idNumber || '-'}</div>
                    <div className="text-xs text-gray-500">Address: {volunteer.userId?.address || '-'}</div>
                    {volunteer.userId?.proofDocumentUrl && (
                      <a
                        href={volunteer.userId.proofDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        View Proof Document
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApproveVolunteer(volunteer._id, 'approve')}
                      className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApproveVolunteer(volunteer._id, 'reject')}
                      className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'broadcast' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Broadcast Alert with Target</h2>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <input
                className="input-field"
                placeholder="Alert title"
                value={alertForm.title}
                onChange={(e) => setAlertForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="input-field min-h-[110px]"
                placeholder="Alert message"
                value={alertForm.message}
                onChange={(e) => setAlertForm((prev) => ({ ...prev, message: e.target.value }))}
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <select className="input-field" value={alertForm.type} onChange={(e) => setAlertForm((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                  <option value="info">Info</option>
                  <option value="evacuation">Evacuation</option>
                </select>
                <select className="input-field" value={alertForm.severity} onChange={(e) => setAlertForm((prev) => ({ ...prev, severity: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <select className="input-field" value={alertForm.targetRole} onChange={(e) => setAlertForm((prev) => ({ ...prev, targetRole: e.target.value }))}>
                  <option value="all">All Users</option>
                  <option value="citizen">Only Citizens</option>
                  <option value="volunteer">Only Volunteers</option>
                </select>
              </div>
              <button className="btn-primary w-full" disabled={actionLoading}>
                {actionLoading ? 'Broadcasting...' : 'Broadcast'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Alerts</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {alerts.map((alert) => (
                <div key={alert._id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="font-semibold text-sm">{alert.title}</div>
                  <div className="text-xs text-gray-600 mt-1">{alert.message}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    target={alert.targetRole || 'all'} | severity={alert.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'activity-log' && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">User Activity Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">When</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => (
                  <tr key={log._id} className="border-b last:border-b-0">
                    <td className="py-2 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.userId?.name || 'Unknown'}</td>
                    <td className="capitalize">{log.role}</td>
                    <td>{log.action}</td>
                    <td className="text-xs text-gray-600">{log.details || '-'}</td>
                    <td className="text-xs">{log.userId?.lastSeen ? new Date(log.userId.lastSeen).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'heatmap' && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Disaster Heatmap (30 days)</h2>
          <DisasterHeatmap heatpoints={heatpoints} />
        </div>
      )}

      {tab === 'reports' && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Export Reports</h2>
          <p className="text-sm text-gray-500 mb-4">
            Download operations reports as PDF or Excel for external reporting.
          </p>
          <div className="flex gap-3">
            <button onClick={() => exportReport('excel')} disabled={actionLoading} className="btn-secondary">Export Excel</button>
            <button onClick={() => exportReport('pdf')} disabled={actionLoading} className="btn-primary">Export PDF</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
