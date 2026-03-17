import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

export default function CitizenLocationMap({ mission }) {
  const coords = mission?.location?.coordinates;
  if (!coords || coords.length !== 2) {
    return <div className="text-sm text-gray-500">Citizen GPS location unavailable.</div>;
  }

  const center = [coords[1], coords[0]];

  return (
    <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={center} radius={12} color="#DC2626" fillColor="#EF4444" fillOpacity={0.85}>
          <Popup>
            <div className="text-sm">
              <div><strong>Citizen Location</strong></div>
              <div>{mission.userId?.name || 'Unknown Citizen'}</div>
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
