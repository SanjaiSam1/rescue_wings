/**
 * Leaflet Map Component
 */
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLORS = {
  pending: '#EAB308',
  accepted: '#3B82F6',
  'in-progress': '#F97316',
  rescued: '#22C55E',
};

function SetCenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 12); }, [center]);
  return null;
}

export default function MapComponent({ requests, userLocation, highlightedRequestId }) {
  const defaultCenter = userLocation || [13.0827, 80.2707];

  return (
    <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <SetCenter center={defaultCenter} />
      {userLocation && (
        <CircleMarker center={userLocation} radius={10} color="#1D4ED8" fillColor="#3B82F6" fillOpacity={0.8}>
          <Popup><strong>📍 Your Location</strong></Popup>
        </CircleMarker>
      )}
      {requests.map(req => {
        const coords = req.location?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        const isHighlighted = highlightedRequestId && req._id === highlightedRequestId;
        return (
          <CircleMarker key={req._id} center={[lat, lng]}
            radius={isHighlighted ? 15 : 12} color={STATUS_COLORS[req.status] || '#6B7280'}
            fillColor={STATUS_COLORS[req.status] || '#6B7280'} fillOpacity={0.8} weight={2}>
            <Popup>
              <div style={{minWidth: '180px'}}>
                <div style={{fontWeight:'bold', textTransform:'capitalize', marginBottom:'4px'}}>{req.disasterType} Emergency</div>
                <div style={{fontSize:'12px', color:'#6B7280', marginBottom:'8px'}}>{req.description?.substring(0, 100)}</div>
                <div style={{fontSize:'12px'}}>● {req.status} | 👥 {req.numberOfPeople} | 👤 {req.userId?.name}</div>
                {isHighlighted && <div style={{fontSize:'12px', marginTop:'4px', color:'#DC2626'}}>Active mission</div>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
