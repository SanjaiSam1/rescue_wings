import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

const DEFAULT_CENTER = [13.0827, 80.2707];

const getColor = (count) => {
  if (count >= 12) return '#B91C1C';
  if (count >= 8) return '#DC2626';
  if (count >= 5) return '#F97316';
  if (count >= 3) return '#F59E0B';
  return '#22C55E';
};

export default function DisasterHeatmap({ heatpoints }) {
  const center = heatpoints?.length ? [heatpoints[0].lat, heatpoints[0].lng] : DEFAULT_CENTER;

  return (
    <div className="h-[360px] rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {(heatpoints || []).map((point) => (
          <CircleMarker
            key={`${point.lat}-${point.lng}`}
            center={[point.lat, point.lng]}
            radius={Math.max(8, point.count * 2)}
            color={getColor(point.count)}
            fillColor={getColor(point.count)}
            fillOpacity={0.5}
            weight={2}
          >
            <Popup>
              <div className="text-sm">
                <div><strong>SOS Frequency Zone</strong></div>
                <div>Total SOS: {point.count}</div>
                <div>Critical SOS: {point.criticalCount}</div>
                <div>Last Incident: {new Date(point.latestAt).toLocaleString()}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
