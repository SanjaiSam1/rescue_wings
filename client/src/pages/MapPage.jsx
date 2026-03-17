/**
 * Live Map Page - Shows rescue requests, volunteers, disaster zones
 */
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { rescueAPI } from '../services/api';
import { getSocket } from '../services/socket';

// Dynamic import to avoid SSR issues
const MapComponent = React.lazy(() => import('../components/map/MapComponent'));

export default function MapPage() {
  const [requests, setRequests] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Get user location
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setUserLocation([13.0827, 80.2707]) // Default: Chennai
    );

    rescueAPI.getAll().then(({ data }) => {
      setRequests(data.requests);
    }).finally(() => setLoading(false));

    // Real-time updates
    const socket = getSocket();
    if (socket) {
      socket.on('new_rescue_request', req => setRequests(prev => [req, ...prev]));
      socket.on('rescue_request_updated', updated =>
        setRequests(prev => prev.map(r => r._id === updated._id ? updated : r))
      );
    }
    return () => {
      if (socket) {
        socket.off('new_rescue_request');
        socket.off('rescue_request_updated');
      }
    };
  }, []);

  const filteredRequests = filter === 'all' ? requests
    : requests.filter(r => r.status === filter);

  return (
    <DashboardLayout title="Live Disaster Map">
      <div className="flex flex-col gap-4 h-full">
        {/* Filter bar */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'pending', 'accepted', 'in-progress', 'rescued'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                filter === s ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:text-primary hover:border-primary'
              }`}>
              {s === 'all' ? `All (${requests.length})` : `${s} (${requests.filter(r => r.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Map Legend */}
        <div className="flex gap-4 flex-wrap text-sm">
          {[
            { color: 'bg-yellow-400', label: 'Pending' },
            { color: 'bg-blue-500', label: 'Accepted' },
            { color: 'bg-orange-500', label: 'In Progress' },
            { color: 'bg-green-500', label: 'Rescued' },
            { color: 'bg-blue-700', label: 'Your Location' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Map container */}
        <div className="flex-1 min-h-[500px] bg-gray-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <React.Suspense fallback={<div className="h-full flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"/></div>}>
              <MapComponent requests={filteredRequests} userLocation={userLocation} />
            </React.Suspense>
          )}
        </div>

        {/* Request list alongside map */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRequests.slice(0, 6).map(req => (
            <div key={req._id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm capitalize">{req.disasterType}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  req.status === 'rescued' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>{req.status}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{req.description}</p>
              <div className="text-xs text-gray-400 mt-1">👤 {req.userId?.name}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
