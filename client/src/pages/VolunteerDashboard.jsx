import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { rescueAPI, volunteerAPI } from '../services/api';
import { getSocket } from '../services/socket';
import AvailabilityToggle from '../components/volunteer/AvailabilityToggle';
import MissionStatusUpdater from '../components/volunteer/MissionStatusUpdater';
import CitizenLocationMap from '../components/volunteer/CitizenLocationMap';
import { useSocket } from '../context/SocketContext';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  accepted: 'bg-blue-100 text-blue-700 border-blue-200',
  'in-progress': 'bg-orange-100 text-orange-700 border-orange-200',
  rescued: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
};

function playSosAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch {
    // Ignore sound errors caused by autoplay/browser restrictions.
  }
}

export default function VolunteerDashboard() {
  const { notifications } = useSocket();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('open');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [disasterFilter, setDisasterFilter] = useState('all');
  const [distanceKm, setDistanceKm] = useState(50);
  const [userLocation, setUserLocation] = useState(null);
  const [availability, setAvailability] = useState('offline');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [updatingMission, setUpdatingMission] = useState(false);
  const [stats, setStats] = useState({
    totalMissions: 0,
    completedMissions: 0,
    cancelledMissions: 0,
    activeMissions: 0,
    avgResponseMinutes: 0,
    rating: 0,
    ratingCount: 0,
  });
  const [latestSosBanner, setLatestSosBanner] = useState('');

  useEffect(() => {
    const latestSos = notifications.find((n) => n.type === 'sos');
    if (latestSos && latestSos.message !== latestSosBanner) {
      setLatestSosBanner(latestSos.message);
    }
  }, [notifications]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ longitude: pos.coords.longitude, latitude: pos.coords.latitude }),
      () => setUserLocation(null)
    );
  }, []);

  const loadVolunteerMeta = async () => {
    const [meRes, statsRes] = await Promise.all([volunteerAPI.getMe(), volunteerAPI.getStats()]);
    setAvailability(meRes.data?.volunteer?.availability || 'offline');
    setStats(statsRes.data?.stats || {});
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = {
        scope,
      };

      if (scope === 'open') {
        params.status = 'pending';
      } else {
        params.status = statusFilter;
      }

      if (urgencyFilter !== 'all') params.urgencyLevel = urgencyFilter;
      if (disasterFilter !== 'all') params.disasterType = disasterFilter;
      if (scope === 'open' && userLocation && distanceKm > 0) {
        params.longitude = userLocation.longitude;
        params.latitude = userLocation.latitude;
        params.maxDistance = Number(distanceKm) * 1000;
      }

      const { data } = await rescueAPI.getAll(params);
      setRequests(data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [scope, statusFilter, urgencyFilter, disasterFilter, distanceKm, userLocation]);

  useEffect(() => {
    loadVolunteerMeta().catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewRescueRequest = (incoming) => {
      playSosAlertSound();
      if (scope === 'open') {
        setRequests((prev) => [incoming, ...prev]);
      }
    };

    const onRescueRequestUpdated = (updated) => {
      setRequests((prev) => {
        const idx = prev.findIndex((req) => req._id === updated._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    };

    const onAssignedMissionUpdated = (updated) => {
      setRequests((prev) => {
        const idx = prev.findIndex((req) => req._id === updated._id);
        if (idx === -1) return [updated, ...prev];
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      loadVolunteerMeta().catch(() => {});
    };

    socket.on('new_rescue_request', onNewRescueRequest);
    socket.on('rescue_request_updated', onRescueRequestUpdated);
    socket.on('assigned_mission_updated', onAssignedMissionUpdated);

    return () => {
      socket.off('new_rescue_request', onNewRescueRequest);
      socket.off('rescue_request_updated', onRescueRequestUpdated);
      socket.off('assigned_mission_updated', onAssignedMissionUpdated);
    };
  }, [scope]);

  const handleAvailabilityChange = async (value) => {
    if (value === availability) return;
    setAvailabilitySaving(true);
    try {
      await volunteerAPI.updateAvailability(value);
      setAvailability(value);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update availability');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleAccept = async (requestId) => {
    if (!window.confirm('Accept this mission now?')) return;
    setUpdatingMission(true);
    try {
      await rescueAPI.update(requestId, { status: 'accepted', note: 'Mission accepted by volunteer' });
      await loadRequests();
      await loadVolunteerMeta();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to accept mission');
    } finally {
      setUpdatingMission(false);
    }
  };

  const handleAdvanceStatus = async (mission, nextStatus) => {
    if (!window.confirm(`Update mission to ${nextStatus}?`)) return;
    setUpdatingMission(true);
    try {
      await rescueAPI.update(mission._id, {
        status: nextStatus,
        note: `Volunteer updated mission to ${nextStatus}`,
      });
      await loadRequests();
      await loadVolunteerMeta();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update mission');
    } finally {
      setUpdatingMission(false);
    }
  };

  const handleRejectMission = async (mission) => {
    const reason = window.prompt('Enter rejection reason for admin review:');
    if (!reason || !reason.trim()) return;
    if (!window.confirm('Reject this mission and return it to open queue?')) return;

    setUpdatingMission(true);
    try {
      await rescueAPI.reject(mission._id, { reason: reason.trim() });
      await loadRequests();
      await loadVolunteerMeta();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reject mission');
    } finally {
      setUpdatingMission(false);
    }
  };

  const activeMission = useMemo(() => {
    return requests.find((request) => ['accepted', 'in-progress'].includes(request.status)) || null;
  }, [requests]);

  return (
    <DashboardLayout title="Volunteer Dashboard">
      {latestSosBanner && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 text-red-700 p-4 flex items-center justify-between gap-3">
          <div className="font-semibold text-sm">{latestSosBanner}</div>
          <button type="button" className="text-xs font-semibold hover:underline" onClick={() => setLatestSosBanner('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Link to="/map" className="card border-2 border-blue-100 hover:border-secondary hover:shadow-md transition-all">
          <div className="text-3xl mb-2">🗺️</div>
          <div className="font-bold text-gray-900">Rescue Map</div>
          <div className="text-sm text-gray-500">Live request visualization and nearby calls</div>
        </Link>
        <Link to="/chat" className="card border-2 border-green-100 hover:border-green-500 hover:shadow-md transition-all">
          <div className="text-3xl mb-2">💬</div>
          <div className="font-bold text-gray-900">Team Chat</div>
          <div className="text-sm text-gray-500">Coordinate with citizens and admin</div>
        </Link>
        <Link to="/volunteer/history" className="card border-2 border-yellow-100 hover:border-yellow-400 hover:shadow-md transition-all">
          <div className="text-3xl mb-2">🕘</div>
          <div className="font-bold text-gray-900">Mission History</div>
          <div className="text-sm text-gray-500">Review outcomes and completed missions</div>
        </Link>
      </div>

      <AvailabilityToggle
        value={availability}
        onChange={handleAvailabilityChange}
        disabled={availabilitySaving}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-6">
        <div className="rounded-2xl p-5 bg-blue-50 text-blue-700">
          <div className="text-3xl font-bold">{stats.totalMissions || 0}</div>
          <div className="text-sm font-medium">Total Missions</div>
        </div>
        <div className="rounded-2xl p-5 bg-green-50 text-green-700">
          <div className="text-3xl font-bold">{stats.completedMissions || 0}</div>
          <div className="text-sm font-medium">Completed</div>
        </div>
        <div className="rounded-2xl p-5 bg-orange-50 text-orange-700">
          <div className="text-3xl font-bold">{stats.avgResponseMinutes || 0}m</div>
          <div className="text-sm font-medium">Avg Response Time</div>
        </div>
        <div className="rounded-2xl p-5 bg-purple-50 text-purple-700">
          <div className="text-3xl font-bold">{stats.rating || 0}</div>
          <div className="text-sm font-medium">Rating ({stats.ratingCount || 0})</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Active Mission Panel</h2>
            <span className="text-xs text-gray-500">Current mission details</span>
          </div>
          {activeMission ? (
            <>
              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <div><strong>Citizen:</strong> {activeMission.userId?.name || 'Unknown'}</div>
                <div><strong>Phone:</strong> {activeMission.userId?.phone || 'N/A'}</div>
                <div><strong>Disaster:</strong> <span className="capitalize">{activeMission.disasterType}</span></div>
                <div><strong>Priority:</strong> <span className="uppercase">{activeMission.urgencyLevel}</span></div>
                <div><strong>Address:</strong> {activeMission.location?.address || 'Coordinates only'}</div>
              </div>
              <MissionStatusUpdater
                mission={activeMission}
                onAdvance={handleAdvanceStatus}
                onReject={handleRejectMission}
                busy={updatingMission}
              />
            </>
          ) : (
            <div className="text-sm text-gray-500">No active mission assigned currently.</div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Citizen Location Map</h2>
            <span className="text-xs text-gray-500">GPS from accepted mission</span>
          </div>
          {activeMission ? <CitizenLocationMap mission={activeMission} /> : <div className="text-sm text-gray-500">Accept a mission to view citizen location on map.</div>}
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { value: 'open', label: 'Open Requests' },
            { value: 'mine', label: 'My Missions' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setScope(item.value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${scope === item.value ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {scope === 'mine' && (
          <div className="flex flex-wrap gap-2 mb-3">
            {['accepted', 'in-progress', 'rescued', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusFilter === status ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <select
            className="input-field"
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            className="input-field"
            value={disasterFilter}
            onChange={(e) => setDisasterFilter(e.target.value)}
          >
            <option value="all">All Disaster Types</option>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="fire">Fire</option>
            <option value="landslide">Landslide</option>
            <option value="cyclone">Cyclone</option>
            <option value="tsunami">Tsunami</option>
            <option value="other">Other</option>
          </select>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Distance (km)</label>
            <input
              type="number"
              min="1"
              max="300"
              className="input-field"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              disabled={scope !== 'open'}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-5xl mb-4">🧭</div>
          <p>No missions match your current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req._id} className={`card border-l-4 ${STATUS_COLORS[req.status] || 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-gray-900 capitalize">{req.disasterType} Emergency</span>
                    <span className="text-xs font-bold uppercase text-red-600">{req.urgencyLevel}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{req.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>👤 {req.userId?.name || 'N/A'}</span>
                    <span>📞 {req.userId?.phone || 'N/A'}</span>
                    <span>👥 {req.numberOfPeople}</span>
                    <span>🕐 {new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-w-fit">
                  {req.status === 'pending' && scope === 'open' && (
                    <button
                      onClick={() => handleAccept(req._id)}
                      className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
                      disabled={updatingMission}
                    >
                      Accept Mission
                    </button>
                  )}
                  <Link
                    to={`/chat/${req.userId?._id}`}
                    className="bg-secondary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 text-center"
                  >
                    Chat
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
