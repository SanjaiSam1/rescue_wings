// src/pages/LiveMapPage.jsx - Real-time rescue map
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import socketService from '../services/socket';
import { MapPin, RefreshCw, Filter, Users, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom marker icons
const createIcon = (color, emoji) => L.divIcon({
  html: `<div style="background:${color};border:3px solid white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${emoji}</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const icons = {
  pending: createIcon('#EF4444', '🆘'),
  accepted: createIcon('#3B82F6', '✅'),
  'in-progress': createIcon('#F97316', '🚨'),
  rescued: createIcon('#22C55E', '🎉'),
  user: createIcon('#6366F1', '👤'),
  volunteer: createIcon('#10B981', '🦺'),
  shelter: createIcon('#8B5CF6', '🏠'),
};

// Map bounds updater
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 12);
  }, [center, map]);
  return null;
}

const shelters = [
  { name: 'City Community Center', lat: 11.0168, lng: 76.9558, capacity: 500 },
  { name: 'Government High School', lat: 11.0100, lng: 76.9620, capacity: 300 },
  { name: 'District Stadium', lat: 11.0230, lng: 76.9480, capacity: 1000 },
];

export default function LiveMapPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([11.0168, 76.9558]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showShelters, setShowShelters] = useState(true);

  useEffect(() => {
    fetchRequests();
    getUserLocation();

    // Real-time updates
    socketService.on('new-rescue-request', (req) => {
      setRequests(prev => [req, ...prev]);
      toast('🆘 New emergency request!', { icon: '🚨' });
    });

    socketService.on('request-updated', (updated) => {
      setRequests(prev => prev.map(r => r._id === updated._id ? updated : r));
    });

    return () => {
      socketService.off('new-rescue-request');
      socketService.off('request-updated');
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const endpoint = user.role === 'citizen' ? '/rescue/my-requests' : '/rescue/all';
      const { data } = await api.get(endpoint);
      setRequests(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setMapCenter(loc);
      },
      () => console.log('Location not available')
    );
  };

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const validRequests = filteredRequests.filter(r =>
    r.location?.coordinates?.[0] !== 0 || r.location?.coordinates?.[1] !== 0
  );

  const statusCounts = {
    pending: requests.filter(r => r.status === 'pending').length,
    'in-progress': requests.filter(r => r.status === 'in-progress').length,
    rescued: requests.filter(r => r.status === 'rescued').length,
  };

  return (
    <DashboardLayout title="Live Operations Map">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { status: 'pending', label: 'Pending', color: 'bg-red-50 text-red-700 border-red-200' },
          { status: 'in-progress', label: 'Active', color: 'bg-orange-50 text-orange-700 border-orange-200' },
          { status: 'rescued', label: 'Rescued', color: 'bg-green-50 text-green-700 border-green-200' },
        ].map(({ status, label, color }) => (
          <div key={status} className={`p-3 rounded-xl border ${color} text-center cursor-pointer ${filter === status ? 'ring-2 ring-current' : ''}`}
            onClick={() => setFilter(filter === status ? 'all' : status)}>
            <div className="text-2xl font-bold">{statusCounts[status] || 0}</div>
            <div className="text-xs font-medium mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Map controls */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {['all', 'pending', 'accepted', 'in-progress', 'rescued'].map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === s ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {s === 'all' ? 'All' : s.replace('-', ' ')}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
          <input type="checkbox" checked={showShelters} onChange={e => setShowShelters(e.target.checked)}
            className="accent-red-600" />
          Show Shelters
        </label>

        <button onClick={fetchRequests}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw size={16} className="text-gray-600" />
        </button>

        <button onClick={getUserLocation}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <MapPin size={16} className="text-red-600" />
        </button>
      </div>

      {/* Map */}
      <div className="card p-0 overflow-hidden" style={{ height: '500px' }}>
        {loading ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading map...</p>
            </div>
          </div>
        ) : (
          <MapContainer center={mapCenter} zoom={12} className="h-full w-full">
            <MapController center={mapCenter} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* User's current location */}
            {userLocation && (
              <>
                <Marker position={userLocation} icon={icons.user}>
                  <Popup>
                    <div className="text-center p-2">
                      <strong>📍 Your Location</strong>
                      <p className="text-xs text-gray-500 mt-1">Current GPS position</p>
                    </div>
                  </Popup>
                </Marker>
                <Circle center={userLocation} radius={1000}
                  pathOptions={{ color: '#6366F1', fillColor: '#6366F1', fillOpacity: 0.05 }} />
              </>
            )}

            {/* Rescue requests */}
            {validRequests.map(req => {
              const [lng, lat] = req.location.coordinates;
              if (!lat || !lng) return null;
              return (
                <Marker key={req._id} position={[lat, lng]} icon={icons[req.status] || icons.pending}>
                  <Popup maxWidth={260}>
                    <div className="p-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">
                          {req.disasterType === 'flood' ? '🌊' : req.disasterType === 'fire' ? '🔥' : '⚠️'}
                        </span>
                        <div>
                          <strong className="text-sm capitalize">{req.disasterType?.replace('_', ' ')}</strong>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                            req.status === 'pending' ? 'bg-red-100 text-red-700' :
                            req.status === 'rescued' ? 'bg-green-100 text-green-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>{req.status}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{req.description?.slice(0, 100)}...</p>
                      <div className="text-xs text-gray-500">
                        <div>👤 {req.userId?.name || 'Anonymous'}</div>
                        <div>📞 {req.userId?.phone || 'N/A'}</div>
                        <div>👥 {req.numberOfPeople} people affected</div>
                      </div>
                      {user.role !== 'citizen' && req.status === 'pending' && (
                        <a href={`/api/rescue/update/${req._id}`}
                          className="mt-2 block text-center text-xs bg-red-600 text-white py-1.5 rounded-lg">
                          Accept Mission
                        </a>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Safe shelters */}
            {showShelters && shelters.map(shelter => (
              <Marker key={shelter.name} position={[shelter.lat, shelter.lng]} icon={icons.shelter}>
                <Popup>
                  <div className="p-1">
                    <strong className="text-sm">🏠 {shelter.name}</strong>
                    <p className="text-xs text-gray-500 mt-1">Capacity: {shelter.capacity} people</p>
                    <p className="text-xs text-green-600 font-medium">✅ Safe Shelter</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="card mt-3 p-3">
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          {[
            { color: 'bg-red-500', label: 'Pending Emergency' },
            { color: 'bg-blue-500', label: 'Accepted' },
            { color: 'bg-orange-500', label: 'In Progress' },
            { color: 'bg-green-500', label: 'Rescued' },
            { color: 'bg-purple-500', label: 'Safe Shelter' },
            { color: 'bg-indigo-500', label: 'Your Location' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
